defmodule ClippsterServer.AI.WhisperAPI do
  @moduledoc """
  Interface to the Whisper AI API for speech-to-text transcription.
  Documentation: https://www.lemonfox.ai/apis/speech-to-text
  """

  @whisper_api_url "https://api.lemonfox.ai/v1/audio/transcriptions"

  # Retry configuration for transient network errors
  # Using aggressive retry strategy to handle intermittent connection issues
  @max_retries 5
  @base_delay_ms 1500
  @max_delay_ms 15_000

  def transcribe_binary(audio_binary, upload_metadata) do
    IO.puts("[WhisperAPI] Starting binary transcription...")
    IO.puts("[WhisperAPI] Audio filename: #{upload_metadata.filename}")
    IO.puts("[WhisperAPI] Audio content type: #{upload_metadata.content_type}")
    IO.puts("[WhisperAPI] Audio binary size: #{byte_size(audio_binary)} bytes")

    # Get API key from environment
    api_key = System.get_env("WHIPSER_API_KEY")

    case api_key do
      nil ->
        IO.puts("[WhisperAPI] WHIPSER_API_KEY environment variable not set")
        {:error, "WHIPSER_API_KEY environment variable not set"}

      _ ->
        IO.puts("[WhisperAPI] API key configured")
        IO.puts("[WhisperAPI] API key (first 8 chars): #{String.slice(api_key, 0, 8)}...")

        # Debug: Check if binary size is reasonable
        actual_size = byte_size(audio_binary)
        # 50MB threshold
        if actual_size > 50_000_000 do
          IO.puts("[WhisperAPI] WARNING: Binary seems too large (#{actual_size} bytes)")
        end

        # Use Finch HTTP client with retry logic
        IO.puts("[WhisperAPI] Sending binary request to Whisper API...")

        # Create multipart boundary
        boundary = "----WebKitFormBoundary#{:crypto.strong_rand_bytes(16) |> Base.encode16()}"

        # Build multipart body with binary data
        multipart_body =
          build_prototype_multipart_body(
            audio_binary,
            upload_metadata.filename,
            upload_metadata.content_type,
            boundary
          )

        headers = [
          {"Authorization", "Bearer #{api_key}"},
          {"User-Agent", "Clippster/1.0"},
          {"Content-Type", "multipart/form-data; boundary=#{boundary}"}
        ]

        IO.puts("[WhisperAPI] Making Finch binary request with retry logic...")
        execute_request_with_retry(headers, multipart_body, 0)
    end
  rescue
    error ->
      IO.puts("[WhisperAPI] Error in binary transcription rescue: #{inspect(error)}")
      IO.puts("[WhisperAPI] Error type: #{inspect(Exception.format(:error, error, []))}")
      {:error, "Unexpected error in binary transcription: #{inspect(error)}"}
  end

  def transcribe(audio_upload) do
    IO.puts("[WhisperAPI] Starting transcription...")
    IO.puts("[WhisperAPI] Audio filename: #{audio_upload.filename}")

    # Get API key from environment
    api_key = System.get_env("WHIPSER_API_KEY")

    case api_key do
      nil ->
        IO.puts("[WhisperAPI] WHIPSER_API_KEY environment variable not set")
        {:error, "WHIPSER_API_KEY environment variable not set"}

      _ ->
        IO.puts("[WhisperAPI] API key configured")
        IO.puts("[WhisperAPI] API key (first 8 chars): #{String.slice(api_key, 0, 8)}...")

        case prepare_whisper_media(audio_upload) do
          {:error, reason} ->
            {:error, reason}

          {:ok, %{path: file_path, filename: filename, content_type: content_type, cleanup: cleanup}} ->
            try do
              IO.puts("[WhisperAPI] File path: #{file_path}")

              if not File.exists?(file_path) do
                IO.puts("[WhisperAPI] File does not exist at path: #{file_path}")
                {:error, "Uploaded file not found"}
              else
                IO.puts("[WhisperAPI] File exists, reading...")
                file_content = File.read!(file_path)
                actual_size = byte_size(file_content)
                IO.puts("[WhisperAPI] File size: #{actual_size} bytes (#{filename})")

                IO.puts("[WhisperAPI] Sending request to Whisper API...")

                boundary =
                  "----WebKitFormBoundary#{:crypto.strong_rand_bytes(16) |> Base.encode16()}"

                multipart_body =
                  build_prototype_multipart_body(
                    file_content,
                    filename,
                    content_type,
                    boundary
                  )

                headers = [
                  {"Authorization", "Bearer #{api_key}"},
                  {"User-Agent", "Clippster/1.0"},
                  {"Content-Type", "multipart/form-data; boundary=#{boundary}"}
                ]

                IO.puts("[WhisperAPI] Making Finch request with retry logic...")
                execute_request_with_retry(headers, multipart_body, 0)
              end
            after
              cleanup.()
            end
        end
    end
  rescue
    error ->
      IO.puts("[WhisperAPI] Error in rescue: #{inspect(error)}")
      IO.puts("[WhisperAPI] Error type: #{inspect(Exception.format(:error, error, []))}")
      IO.puts("[WhisperAPI] Stacktrace: #{inspect(__STACKTRACE__)}")
      {:error, "Unexpected error: #{inspect(error)}"}
  end

  # Stream-copied AAC chunks are often 8–15MB. Re-encode speech to mono MP3
  # (desktop uses -q:a 8) so Lemonfox uploads stay small and reliable.
  @compress_above_bytes 1_000_000

  # Mobile HLS downloads may land as MPEG-TS (.ts). Convert / compress with system FFmpeg
  # before calling Lemonfox.
  defp prepare_whisper_media(audio_upload) do
    path = audio_upload.path
    filename = audio_upload.filename || Path.basename(path)
    content_type = audio_upload.content_type || "application/octet-stream"
    ext = filename |> to_string() |> Path.extname() |> String.downcase()

    base =
      if ext in [".ts", ".m2ts", ".mts"] or content_type in ["video/mp2t", "video/MP2T"] do
        remux_mpegts_for_whisper(path)
      else
        {:ok,
         %{
           path: path,
           filename: filename,
           content_type: content_type,
           cleanup: fn -> :ok end
         }}
      end

    case base do
      {:ok, media} -> maybe_compress_for_whisper(media)
      error -> error
    end
  end

  defp maybe_compress_for_whisper(%{path: path, cleanup: cleanup, filename: filename} = media) do
    size =
      case File.stat(path) do
        {:ok, %{size: s}} -> s
        _ -> 0
      end

    ext = filename |> to_string() |> Path.extname() |> String.downcase()

    cond do
      # Desktop already sends compact MP3 chunks — leave small ones alone.
      ext == ".mp3" and size <= 5_000_000 ->
        {:ok, media}

      size > @compress_above_bytes or ext in [".m4a", ".aac", ".wav", ".mp4", ".m4v"] ->
        compress_audio_for_whisper(path, size, cleanup)

      true ->
        {:ok, media}
    end
  end

  defp compress_audio_for_whisper(path, size, cleanup) do
    IO.puts("[WhisperAPI] Compressing #{size}-byte upload for Whisper (mono MP3)...")
    output_path = Path.join(System.tmp_dir!(), "whisper_#{System.unique_integer([:positive])}.mp3")

    args = [
      "-hide_banner",
      "-y",
      "-i",
      path,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "libmp3lame",
      "-q:a",
      "8",
      output_path
    ]

    case System.cmd("ffmpeg", args, stderr_to_stdout: true) do
      {_, 0} ->
        new_size =
          case File.stat(output_path) do
            {:ok, %{size: s}} -> s
            _ -> 0
          end

        IO.puts("[WhisperAPI] Compressed to #{new_size} bytes")

        {:ok,
         %{
           path: output_path,
           filename: "audio.mp3",
           content_type: "audio/mpeg",
           cleanup: fn ->
             _ = File.rm(output_path)
             cleanup.()
           end
         }}

      {out, code} ->
        IO.puts(
          "[WhisperAPI] Compress failed (#{code}), uploading original: #{String.slice(out, -400, 400)}"
        )

        _ = File.rm(output_path)

        {:ok,
         %{
           path: path,
           filename: Path.basename(path),
           content_type: "application/octet-stream",
           cleanup: cleanup
         }}
    end
  end
  defp remux_mpegts_for_whisper(input_path) do
    output_path = Path.join(System.tmp_dir!(), "whisper_#{System.unique_integer([:positive])}.mp4")

    copy_args = [
      "-hide_banner",
      "-y",
      "-fflags",
      "+genpts+igndts",
      "-i",
      input_path,
      "-c",
      "copy",
      "-bsf:a",
      "aac_adtstoasc",
      "-movflags",
      "+faststart",
      output_path
    ]

    IO.puts("[WhisperAPI] Remuxing MPEG-TS for Whisper: #{input_path}")

    case System.cmd("ffmpeg", copy_args, stderr_to_stdout: true) do
      {_, 0} ->
        IO.puts("[WhisperAPI] Remux complete: #{output_path}")

        {:ok,
         %{
           path: output_path,
           filename: "video.mp4",
           content_type: "video/mp4",
           cleanup: fn -> File.rm(output_path) end
         }}

      {copy_out, copy_code} ->
        IO.puts("[WhisperAPI] Stream-copy remux failed (#{copy_code}), trying audio extract…")
        IO.puts("[WhisperAPI] FFmpeg output: #{String.slice(copy_out, -800, 800)}")

        audio_path =
          Path.join(System.tmp_dir!(), "whisper_#{System.unique_integer([:positive])}.m4a")

        audio_args = [
          "-hide_banner",
          "-y",
          "-fflags",
          "+genpts+igndts",
          "-i",
          input_path,
          "-vn",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          audio_path
        ]

        case System.cmd("ffmpeg", audio_args, stderr_to_stdout: true) do
          {_, 0} ->
            File.rm(output_path)

            {:ok,
             %{
               path: audio_path,
               filename: "audio.m4a",
               content_type: "audio/mp4",
               cleanup: fn -> File.rm(audio_path) end
             }}

          {audio_out, audio_code} ->
            File.rm(output_path)
            File.rm(audio_path)

            {:error,
             "Failed to prepare MPEG-TS for transcription (ffmpeg #{audio_code}): #{String.slice(audio_out, -400, 400)}"}
        end
    end
  rescue
    error ->
      {:error, "FFmpeg remux unavailable: #{inspect(error)}"}
  end

  # Pass the multipart binary so each retry can rebuild the request body.
  defp execute_request_with_retry(headers, multipart_body, attempt) when is_binary(multipart_body) do
    content_length = byte_size(multipart_body)

    headers_with_length =
      headers
      |> Enum.reject(fn {k, _} -> String.downcase(to_string(k)) == "content-length" end)
      |> Kernel.++([{"Content-Length", Integer.to_string(content_length)}])

    # Prefer a plain binary body for speech-sized uploads (HTTP/1.1). Streaming was
    # originally used to avoid oversized TLS records under HTTP/2; with http1 +
    # compressed MP3 the binary path matches desktop FormData more closely.
    body =
      if content_length > 16_000_000 do
        {:stream, chunk_binary_for_streaming(multipart_body)}
      else
        multipart_body
      end

    request = Finch.build(:post, @whisper_api_url, headers_with_length, body)

    case Finch.request(request, ClippsterFinch,
           receive_timeout: 300_000,
           pool_timeout: 30_000
         ) do
      {:ok, %Finch.Response{status: 200, body: response_body}} ->
        IO.puts("[WhisperAPI] Received response from API (attempt #{attempt + 1})")
        IO.puts("[WhisperAPI] Response body length: #{byte_size(response_body)} bytes")

        case Jason.decode(response_body) do
          {:ok, response} ->
            IO.puts("[WhisperAPI] Successfully decoded JSON response")
            IO.puts("[WhisperAPI] Response keys: #{inspect(Map.keys(response))}")
            {:ok, response}

          {:error, reason} ->
            IO.puts("[WhisperAPI] Failed to decode JSON: #{inspect(reason)}")
            IO.puts("[WhisperAPI] Response body: #{String.slice(response_body, 0, 500)}...")
            {:error, "Invalid JSON response: #{inspect(reason)}"}
        end

      {:ok, %Finch.Response{status: 429, body: response_body}} ->
        if attempt < @max_retries do
          delay = max(calculate_backoff_delay(attempt), 5000)

          IO.puts(
            "[WhisperAPI] Rate limited (429), retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})..."
          )

          Process.sleep(delay)
          execute_request_with_retry(headers, multipart_body, attempt + 1)
        else
          IO.puts("[WhisperAPI] Rate limited after #{@max_retries} retries")
          {:error, "Whisper API rate limited (429): #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}}
      when status_code in [500, 502, 503, 504] ->
        if attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)

          IO.puts(
            "[WhisperAPI] Server error #{status_code}, retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})..."
          )

          Process.sleep(delay)
          execute_request_with_retry(headers, multipart_body, attempt + 1)
        else
          IO.puts(
            "[WhisperAPI] API returned error status after #{@max_retries} retries: #{status_code}"
          )

          IO.puts("[WhisperAPI] Error body: #{response_body}")
          {:error, "Whisper API error (#{status_code}): #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}} ->
        IO.puts("[WhisperAPI] API returned error status: #{status_code}")
        IO.puts("[WhisperAPI] Error body: #{response_body}")
        {:error, "Whisper API error (#{status_code}): #{response_body}"}

      {:error, reason} ->
        if retryable_error?(reason) and attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)

          IO.puts(
            "[WhisperAPI] Transient error: #{format_error(reason)}, retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})..."
          )

          Process.sleep(delay)
          execute_request_with_retry(headers, multipart_body, attempt + 1)
        else
          IO.puts(
            "[WhisperAPI] HTTP request failed after #{attempt + 1} attempts: #{format_error(reason)}"
          )

          {:error, "Network error after #{attempt + 1} attempts: #{format_error(reason)}"}
        end
    end
  end

  # Format error for logging (handles struct and non-struct errors)
  defp format_error(%{__struct__: struct_name, reason: reason}) do
    "#{inspect(struct_name)}: #{inspect(reason)}"
  end

  defp format_error(error), do: inspect(error)

  # Check if an error is retryable (transient network issues)
  # Comprehensive pattern matching for all known transient error types

  # Mint transport errors (connection level)
  defp retryable_error?(%Mint.TransportError{reason: reason})
       when reason in [
              :closed,
              :timeout,
              :econnrefused,
              :econnreset,
              :ehostunreach,
              :enetunreach,
              :enotconn,
              :epipe,
              :etimedout,
              :econnaborted
            ] do
    true
  end

  # TLS/SSL errors - these are transient network issues that should be retried
  # Includes: bad_record_mac, handshake_failure, unexpected_message, etc.
  defp retryable_error?(%Mint.TransportError{reason: {:tls_alert, _}}) do
    true
  end

  # Generic SSL/TLS closed errors
  defp retryable_error?(%Mint.TransportError{reason: {:ssl_closed, _}}) do
    true
  end

  # Mint HTTP errors (protocol level)
  defp retryable_error?(%Mint.HTTPError{reason: reason})
       when reason in [:closed, :timeout] do
    true
  end

  # Mint HTTP errors with tuple reasons
  defp retryable_error?(%Mint.HTTPError{reason: {:stream_not_found, _}}) do
    true
  end

  # Generic timeout errors
  defp retryable_error?({:error, :timeout}), do: true
  defp retryable_error?(:timeout), do: true

  # Pool timeout (couldn't get connection from pool)
  defp retryable_error?({:error, :pool_timeout}), do: true
  defp retryable_error?(%Finch.Error{reason: :pool_timeout}), do: true

  # Connection closed during checkout
  defp retryable_error?(%Finch.Error{reason: :checkout_timeout}), do: true
  defp retryable_error?(%Finch.Error{reason: {:checkout_timeout, _}}), do: true

  # Catch-all for any error with :closed or :timeout in its structure
  defp retryable_error?(error) when is_map(error) do
    case Map.get(error, :reason) do
      :closed -> true
      :timeout -> true
      {:closed, _} -> true
      {:timeout, _} -> true
      other -> retryable_reason_text?(other)
    end
  end

  defp retryable_error?(error), do: retryable_reason_text?(error)

  defp retryable_reason_text?(reason) do
    text = reason |> inspect() |> String.downcase()
    String.contains?(text, "socket closed") or
      String.contains?(text, ":closed") or
      String.contains?(text, "timeout") or
      String.contains?(text, "econnreset")
  end

  # Calculate exponential backoff delay with jitter
  defp calculate_backoff_delay(attempt) do
    # Exponential backoff: 1.5s, 3s, 6s, 12s, 15s (capped)
    base = @base_delay_ms * :math.pow(2, attempt)
    # Add random jitter (0-30% of base delay) to prevent thundering herd
    jitter = :rand.uniform(round(base * 0.30))
    min(round(base) + jitter, @max_delay_ms)
  end

  # Chunk a binary into 64KB pieces for streaming over TLS.
  # Sending large binaries (>1MB) in a single TLS write causes Bad Record MAC errors
  # because the TLS record layer can't handle oversized writes reliably.
  # IMPORTANT: rebuild this stream on every retry — Stream.unfold is single-consumption.
  @chunk_size 65_536
  defp chunk_binary_for_streaming(binary) do
    Stream.unfold(binary, fn
      <<>> ->
        nil

      data ->
        size = min(byte_size(data), @chunk_size)
        <<chunk::binary-size(size), rest::binary>> = data
        {chunk, rest}
    end)
  end

  # Build multipart body EXACTLY matching the prototype TypeScript implementation
  defp build_prototype_multipart_body(file_content, filename, content_type, boundary) do
    parts = [
      # File part - exactly like prototype form.append('file', fs.createReadStream(audioFilePath))
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"file\"; filename=\"#{filename}\"\r\n",
      "Content-Type: #{content_type}\r\n\r\n",
      file_content,
      "\r\n",
      # Language part - exactly like prototype form.append('language', finalOptions.language || 'english')
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"language\"\r\n\r\n",
      "english\r\n",
      # Response format part - exactly like prototype form.append('response_format', finalOptions.responseFormat || 'verbose_json')
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"response_format\"\r\n\r\n",
      "verbose_json\r\n",
      # Temperature part - exactly like prototype form.append('temperature', finalOptions.temperature?.toString() || '0.0')
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"temperature\"\r\n\r\n",
      "0.0\r\n",
      # Timestamp granularities part - exactly like prototype form.append('timestamp_granularities[]', finalOptions.timestamp_granularities.join(','))
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"timestamp_granularities[]\"\r\n\r\n",
      "word,segment\r\n",
      # Speaker labels part - exactly like prototype form.append('speaker_labels', 'true')
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"speaker_labels\"\r\n\r\n",
      "true\r\n",
      # End boundary
      "--#{boundary}--\r\n"
    ]

    body = IO.iodata_to_binary(parts)
    IO.puts("[WhisperAPI] Multipart body length: #{byte_size(body)} bytes")
    # Note: Removed binary data preview to avoid Unicode issues with OGG files
    body
  end
end
