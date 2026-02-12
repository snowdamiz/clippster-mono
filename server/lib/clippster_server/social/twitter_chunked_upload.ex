defmodule ClippsterServer.Social.TwitterChunkedUpload do
  @moduledoc """
  X API v2 chunked media upload implementation.

  Implements the complete INIT -> APPEND chunks -> FINALIZE -> poll STATUS workflow
  for uploading videos to X (Twitter) using the official v2 media endpoint.

  All HTTP requests use `https://api.x.com/2/media/upload` (v2 endpoint).
  The deprecated v1.1 upload.twitter.com endpoint is NOT used.

  ## Workflow

  1. **INIT**: Initialize upload session, receive media_id
  2. **APPEND**: Upload video in 1MB chunks sequentially
  3. **FINALIZE**: Complete upload and trigger processing
  4. **STATUS**: Poll processing status until succeeded or failed

  ## X API Requirements

  - Videos split into 1MB chunks (lower failure rate than 5MB)
  - Chunks uploaded sequentially (NOT parallel)
  - Processing polling respects check_after_secs from API
  - Maximum 60 polling attempts (~5 minutes)
  - OAuth 2.0 Bearer token required (media.write scope)

  ## Usage

      {:ok, media_id} = TwitterChunkedUpload.upload_video(access_token, video_binary)
  """

  require Logger

  alias ClippsterServer.Social.VideoValidator

  # X API v2 media upload endpoints (separate endpoints per operation)
  @base_url "https://api.x.com/2/media/upload"
  @init_url "https://api.x.com/2/media/upload/initialize"

  # Upload configuration
  @chunk_size 1_024_000  # 1MB chunks (recommended by X)
  @max_poll_attempts 60  # ~5 minutes max polling
  @http_timeout 30_000  # 30 second timeout for INIT/FINALIZE/STATUS
  @append_timeout 60_000  # 60 second timeout for APPEND (larger payloads)

  @doc """
  Upload video to X API using chunked upload workflow.

  Returns `{:ok, media_id}` on success, or `{:error, reason}` on failure.

  ## Options

  - `:media_type` - MIME type (default: "video/mp4")
  - Validation options passed to VideoValidator

  ## Examples

      iex> TwitterChunkedUpload.upload_video(token, video_binary)
      {:ok, "1234567890"}

      iex> TwitterChunkedUpload.upload_video(token, <<>>)
      {:error, {:validation_failed, "Video file is empty"}}
  """
  def upload_video(access_token, video_binary, opts \\ []) do
    media_type = opts[:media_type] || "video/mp4"

    with :ok <- VideoValidator.validate(video_binary, opts),
         {:ok, media_id} <- init_upload(access_token, byte_size(video_binary), media_type),
         :ok <- append_chunks(access_token, media_id, video_binary),
         {:ok, processing_info} <- finalize_upload(access_token, media_id),
         {:ok, :ready} <- poll_until_ready(access_token, media_id, processing_info) do
      {:ok, media_id}
    end
  end

  # ============================================================================
  # INIT Command
  # ============================================================================

  defp init_upload(access_token, total_bytes, media_type) do
    Logger.info("[TwitterUpload] INIT upload: #{total_bytes} bytes, type: #{media_type}")

    body = Jason.encode!(%{
      "media_type" => media_type,
      "total_bytes" => total_bytes,
      "media_category" => "tweet_video"
    })

    headers = [
      {"Authorization", "Bearer #{access_token}"},
      {"Content-Type", "application/json"}
    ]

    http_options = [timeout: @http_timeout, recv_timeout: @http_timeout, hackney: [pool: false]]

    case HTTPoison.post(@init_url, body, headers, http_options) do
      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} when status in 200..299 ->
        Logger.info("[TwitterUpload] INIT raw response: #{response_body}")
        case Jason.decode(response_body) do
          {:ok, parsed} ->
            # v2 wraps in "data", extract the inner object
            inner = Map.get(parsed, "data", parsed)
            media_id = inner["media_id_string"] || inner["id"]
            cond do
              is_binary(media_id) && media_id != "" ->
                Logger.info("[TwitterUpload] INIT success: media_id=#{media_id}")
                {:ok, media_id}
              is_integer(media_id) ->
                media_id_str = Integer.to_string(media_id)
                Logger.info("[TwitterUpload] INIT success: media_id=#{media_id_str}")
                {:ok, media_id_str}
              true ->
                Logger.error("[TwitterUpload] INIT response missing media_id: #{inspect(parsed)}")
                {:error, {:init_failed, :invalid_response}}
            end

          {:error, decode_error} ->
            Logger.error("[TwitterUpload] INIT JSON decode error: #{inspect(decode_error)}")
            {:error, {:init_failed, :json_decode_error}}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        error = extract_error(response_body)
        Logger.error("[TwitterUpload] INIT failed: status=#{status}, error=#{inspect(error)}")
        {:error, {:init_failed, status, error}}

      {:error, reason} ->
        Logger.error("[TwitterUpload] INIT HTTP error: #{inspect(reason)}")
        {:error, {:init_failed, reason}}
    end
  end

  # ============================================================================
  # APPEND Command
  # ============================================================================

  defp append_chunks(access_token, media_id, video_binary) do
    total_size = byte_size(video_binary)
    chunk_count = ceil(total_size / @chunk_size)

    Logger.info("[TwitterUpload] APPEND chunks: #{chunk_count} chunks (#{@chunk_size} bytes each)")

    # Upload chunks sequentially (X requires order)
    Enum.reduce_while(0..(chunk_count - 1), :ok, fn segment_index, _acc ->
      offset = segment_index * @chunk_size
      length = min(@chunk_size, total_size - offset)
      chunk_binary = :binary.part(video_binary, offset, length)

      case append_chunk(access_token, media_id, chunk_binary, segment_index) do
        :ok ->
          Logger.debug("[TwitterUpload] APPEND chunk #{segment_index + 1}/#{chunk_count} success")
          {:cont, :ok}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp append_chunk(access_token, media_id, chunk_binary, segment_index) do
    append_chunk_with_retry(access_token, media_id, chunk_binary, segment_index, 0)
  end

  defp append_chunk_with_retry(_access_token, _media_id, _chunk_binary, segment_index, attempt) when attempt >= 3 do
    Logger.error("[TwitterUpload] APPEND segment #{segment_index} failed after 3 retries")
    {:error, {:append_failed, segment_index, :max_retries}}
  end

  defp append_chunk_with_retry(access_token, media_id, chunk_binary, segment_index, attempt) do
    append_url = "#{@base_url}/#{media_id}/append"

    # Write chunk to temp file — hackney's {:file, path} is the only reliable multipart format
    tmp_dir = System.tmp_dir!()
    tmp_path = Path.join(tmp_dir, "x_upload_#{media_id}_#{segment_index}_#{attempt}.tmp")

    try do
      File.write!(tmp_path, chunk_binary)

      body = {:multipart, [
        {"segment_index", "#{segment_index}"},
        {:file, tmp_path, {"form-data", [name: "media", filename: "video.mp4"]}, [{"Content-Type", "application/octet-stream"}]}
      ]}

      headers = [
        {"Authorization", "Bearer #{access_token}"}
        # Do NOT set Content-Type -- HTTPoison sets it for multipart
      ]

      # Disable connection pooling to prevent :closed errors from stale connections
      http_options = [timeout: @append_timeout, recv_timeout: @append_timeout, hackney: [pool: false]]

      case HTTPoison.post(append_url, body, headers, http_options) do
        {:ok, %HTTPoison.Response{status_code: status}} when status in [200, 202, 204] ->
          :ok

        {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
          error = extract_error(response_body)
          Logger.error("[TwitterUpload] APPEND segment #{segment_index} failed: status=#{status}, error=#{inspect(error)}")
          {:error, {:append_failed, segment_index, status, error}}

        {:error, %HTTPoison.Error{reason: reason}} when reason in [:closed, :timeout, :connect_timeout] ->
          Logger.warning("[TwitterUpload] APPEND segment #{segment_index} transient error: #{inspect(reason)}, retry #{attempt + 1}/3")
          :timer.sleep(1000 * (attempt + 1))
          append_chunk_with_retry(access_token, media_id, chunk_binary, segment_index, attempt + 1)

        {:error, reason} ->
          Logger.error("[TwitterUpload] APPEND segment #{segment_index} HTTP error: #{inspect(reason)}")
          {:error, {:append_failed, segment_index, reason}}
      end
    after
      File.rm(tmp_path)
    end
  end

  # ============================================================================
  # FINALIZE Command
  # ============================================================================

  defp finalize_upload(access_token, media_id) do
    Logger.info("[TwitterUpload] FINALIZE upload: media_id=#{media_id}")

    finalize_url = "#{@base_url}/#{media_id}/finalize"

    headers = [
      {"Authorization", "Bearer #{access_token}"},
      {"Content-Type", "application/json"}
    ]

    http_options = [timeout: @http_timeout, recv_timeout: @http_timeout, hackney: [pool: false]]

    case HTTPoison.post(finalize_url, "{}", headers, http_options) do
      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} when status in 200..299 ->
        Logger.info("[TwitterUpload] FINALIZE raw response: #{response_body}")
        case Jason.decode(response_body) do
          {:ok, parsed} ->
            # v2 wraps in "data"
            inner = Map.get(parsed, "data", parsed)
            processing_info = inner["processing_info"]
            if processing_info do
              Logger.info("[TwitterUpload] FINALIZE success: requires async processing")
              {:ok, processing_info}
            else
              Logger.info("[TwitterUpload] FINALIZE success: no async processing needed")
              {:ok, nil}
            end

          {:error, decode_error} ->
            Logger.error("[TwitterUpload] FINALIZE JSON decode error: #{inspect(decode_error)}")
            {:error, {:finalize_failed, :json_decode_error}}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        error = extract_error(response_body)
        Logger.error("[TwitterUpload] FINALIZE failed: status=#{status}, error=#{inspect(error)}")
        {:error, {:finalize_failed, status, error}}

      {:error, reason} ->
        Logger.error("[TwitterUpload] FINALIZE HTTP error: #{inspect(reason)}")
        {:error, {:finalize_failed, reason}}
    end
  end

  # ============================================================================
  # STATUS Polling
  # ============================================================================

  defp poll_until_ready(_access_token, _media_id, nil) do
    # No processing_info means immediate success
    {:ok, :ready}
  end

  defp poll_until_ready(access_token, media_id, processing_info) do
    check_after_secs = Map.get(processing_info, "check_after_secs", 5)
    Logger.info("[TwitterUpload] STATUS polling: check_after_secs=#{check_after_secs}")
    do_poll(access_token, media_id, check_after_secs, 0)
  end

  defp do_poll(access_token, media_id, wait_seconds, attempt) do
    if attempt >= @max_poll_attempts do
      Logger.error("[TwitterUpload] STATUS timeout: exceeded #{@max_poll_attempts} attempts")
      {:error, :processing_timeout}
    else
      # Wait before polling (respect check_after_secs from X)
      :timer.sleep(wait_seconds * 1000)

      case get_status(access_token, media_id) do
        {:ok, response} ->
          # v2 wraps in "data", extract inner object
          inner = Map.get(response, "data", response)
          processing_info = inner["processing_info"]
          state = processing_info && processing_info["state"]

          case state do
            "succeeded" ->
              Logger.info("[TwitterUpload] STATUS succeeded after #{attempt + 1} attempts")
              {:ok, :ready}

            "failed" ->
              error = Map.get(processing_info, "error", %{})
              Logger.error("[TwitterUpload] STATUS failed: #{inspect(error)}")
              {:error, {:processing_failed, error}}

            s when s in ["pending", "in_progress"] ->
              next_check_after = Map.get(processing_info, "check_after_secs", wait_seconds)
              Logger.debug("[TwitterUpload] STATUS #{s}: attempt #{attempt + 1}/#{@max_poll_attempts}, next check in #{next_check_after}s")
              do_poll(access_token, media_id, next_check_after, attempt + 1)

            _ ->
              Logger.warning("[TwitterUpload] STATUS unexpected response: #{inspect(response)}")
              do_poll(access_token, media_id, wait_seconds, attempt + 1)
          end

        {:error, reason} ->
          Logger.error("[TwitterUpload] STATUS check error: #{inspect(reason)}")
          {:error, {:status_check_failed, reason}}
      end
    end
  end

  defp get_status(access_token, media_id) do
    url = "#{@base_url}?media_id=#{media_id}"

    headers = [
      {"Authorization", "Bearer #{access_token}"}
    ]

    http_options = [timeout: @http_timeout, recv_timeout: @http_timeout, hackney: [pool: false]]

    case HTTPoison.get(url, headers, http_options) do
      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} when status in 200..299 ->
        case Jason.decode(response_body) do
          {:ok, response} -> {:ok, response}
          {:error, decode_error} -> {:error, {:json_decode_error, decode_error}}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        error = extract_error(response_body)
        {:error, {:http_error, status, error}}

      {:error, reason} ->
        {:error, {:http_error, reason}}
    end
  end

  # ============================================================================
  # Error Handling
  # ============================================================================

  defp extract_error(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, %{"detail" => detail}} -> detail
      {:ok, %{"error" => %{"message" => message}}} -> message
      {:ok, %{"error" => error}} when is_binary(error) -> error
      {:ok, %{"errors" => [%{"message" => message} | _]}} -> message
      {:ok, response} -> inspect(response)
      {:error, _} -> body
    end
  end

  defp extract_error(error), do: error
end
