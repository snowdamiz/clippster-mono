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

  # X API v2 media upload endpoint (NOT v1.1 upload.twitter.com)
  @upload_url "https://api.x.com/2/media/upload"

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

    with {:ok, _} <- VideoValidator.validate(video_binary, opts),
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

    body = URI.encode_query(%{
      "command" => "INIT",
      "media_type" => media_type,
      "total_bytes" => total_bytes,
      "media_category" => "tweet_video"
    })

    headers = [
      {"Authorization", "Bearer #{access_token}"},
      {"Content-Type", "application/x-www-form-urlencoded"}
    ]

    http_options = [timeout: @http_timeout, recv_timeout: @http_timeout]

    case HTTPoison.post(@upload_url, body, headers, http_options) do
      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} when status in 200..299 ->
        case Jason.decode(response_body) do
          {:ok, %{"media_id_string" => media_id}} ->
            Logger.info("[TwitterUpload] INIT success: media_id=#{media_id}")
            {:ok, media_id}

          {:ok, response} ->
            Logger.error("[TwitterUpload] INIT response missing media_id: #{inspect(response)}")
            {:error, {:init_failed, :invalid_response}}

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
    # Multipart form-data body
    body = {:multipart, [
      {"command", "APPEND"},
      {"media_id", media_id},
      {"segment_index", "#{segment_index}"},
      {:file, chunk_binary, {"form-data", [name: "media"]}, []}
    ]}

    headers = [
      {"Authorization", "Bearer #{access_token}"}
      # Do NOT set Content-Type -- HTTPoison sets it for multipart
    ]

    http_options = [timeout: @append_timeout, recv_timeout: @append_timeout]

    case HTTPoison.post(@upload_url, body, headers, http_options) do
      {:ok, %HTTPoison.Response{status_code: status}} when status in [200, 202, 204] ->
        :ok

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        error = extract_error(response_body)
        Logger.error("[TwitterUpload] APPEND segment #{segment_index} failed: status=#{status}, error=#{inspect(error)}")
        {:error, {:append_failed, segment_index, status, error}}

      {:error, reason} ->
        Logger.error("[TwitterUpload] APPEND segment #{segment_index} HTTP error: #{inspect(reason)}")
        {:error, {:append_failed, segment_index, reason}}
    end
  end

  # ============================================================================
  # FINALIZE Command
  # ============================================================================

  defp finalize_upload(access_token, media_id) do
    Logger.info("[TwitterUpload] FINALIZE upload: media_id=#{media_id}")

    body = URI.encode_query(%{
      "command" => "FINALIZE",
      "media_id" => media_id
    })

    headers = [
      {"Authorization", "Bearer #{access_token}"},
      {"Content-Type", "application/x-www-form-urlencoded"}
    ]

    http_options = [timeout: @http_timeout, recv_timeout: @http_timeout]

    case HTTPoison.post(@upload_url, body, headers, http_options) do
      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} when status in 200..299 ->
        case Jason.decode(response_body) do
          {:ok, %{"processing_info" => processing_info}} ->
            Logger.info("[TwitterUpload] FINALIZE success: requires async processing")
            {:ok, processing_info}

          {:ok, _response} ->
            # No processing_info means immediate success
            Logger.info("[TwitterUpload] FINALIZE success: no async processing needed")
            {:ok, nil}

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
        {:ok, %{"processing_info" => %{"state" => "succeeded"}}} ->
          Logger.info("[TwitterUpload] STATUS succeeded after #{attempt + 1} attempts")
          {:ok, :ready}

        {:ok, %{"processing_info" => %{"state" => "failed"} = info}} ->
          error = Map.get(info, "error", %{})
          Logger.error("[TwitterUpload] STATUS failed: #{inspect(error)}")
          {:error, {:processing_failed, error}}

        {:ok, %{"processing_info" => %{"state" => state} = info}} when state in ["pending", "in_progress"] ->
          next_check_after = Map.get(info, "check_after_secs", wait_seconds)
          Logger.debug("[TwitterUpload] STATUS #{state}: attempt #{attempt + 1}/#{@max_poll_attempts}, next check in #{next_check_after}s")
          do_poll(access_token, media_id, next_check_after, attempt + 1)

        {:ok, response} ->
          Logger.warning("[TwitterUpload] STATUS unexpected response: #{inspect(response)}")
          # Retry with same interval
          do_poll(access_token, media_id, wait_seconds, attempt + 1)

        {:error, reason} ->
          Logger.error("[TwitterUpload] STATUS check error: #{inspect(reason)}")
          {:error, {:status_check_failed, reason}}
      end
    end
  end

  defp get_status(access_token, media_id) do
    url = "#{@upload_url}?command=STATUS&media_id=#{media_id}"

    headers = [
      {"Authorization", "Bearer #{access_token}"}
    ]

    http_options = [timeout: @http_timeout, recv_timeout: @http_timeout]

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
      {:ok, %{"error" => %{"message" => message}}} -> message
      {:ok, %{"error" => error}} when is_binary(error) -> error
      {:ok, %{"errors" => [%{"message" => message} | _]}} -> message
      {:ok, response} -> response
      {:error, _} -> body
    end
  end

  defp extract_error(error), do: error
end
