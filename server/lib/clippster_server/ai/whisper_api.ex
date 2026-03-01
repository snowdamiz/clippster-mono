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
        content_length = byte_size(multipart_body)
        chunked_body = chunk_binary_for_streaming(multipart_body)
        headers_with_length = headers ++ [{"Content-Length", Integer.to_string(content_length)}]
        execute_request_with_retry(headers_with_length, {:stream, chunked_body}, 0)
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

        # Read the uploaded file
        file_path = audio_upload.path
        IO.puts("[WhisperAPI] File path: #{file_path}")

        # Check if file exists before reading
        if not File.exists?(file_path) do
          IO.puts("[WhisperAPI] File does not exist at path: #{file_path}")
          {:error, "Uploaded file not found"}
        else
          IO.puts("[WhisperAPI] File exists, reading...")
          file_content = File.read!(file_path)
          actual_size = byte_size(file_content)
          IO.puts("[WhisperAPI] File size: #{actual_size} bytes")

          # Debug: Check if file size matches expected MP3 size
          # 5MB threshold
          if actual_size > 5_000_000 do
            IO.puts("[WhisperAPI] WARNING: File seems too large for MP3 (#{actual_size} bytes)")
          end

          # Use Finch HTTP client with retry logic
          IO.puts("[WhisperAPI] Sending request to Whisper API...")

          # Create multipart boundary
          boundary = "----WebKitFormBoundary#{:crypto.strong_rand_bytes(16) |> Base.encode16()}"

          # Build multipart body EXACTLY matching the prototype
          multipart_body =
            build_prototype_multipart_body(
              file_content,
              audio_upload.filename,
              audio_upload.content_type,
              boundary
            )

          headers = [
            {"Authorization", "Bearer #{api_key}"},
            {"User-Agent", "Clippster/1.0"},
            {"Content-Type", "multipart/form-data; boundary=#{boundary}"}
          ]

          IO.puts("[WhisperAPI] Making Finch request with retry logic...")
          content_length = byte_size(multipart_body)
          chunked_body = chunk_binary_for_streaming(multipart_body)
          headers_with_length = headers ++ [{"Content-Length", Integer.to_string(content_length)}]
          execute_request_with_retry(headers_with_length, {:stream, chunked_body}, 0)
        end
    end
  rescue
    error ->
      IO.puts("[WhisperAPI] Error in rescue: #{inspect(error)}")
      IO.puts("[WhisperAPI] Error type: #{inspect(Exception.format(:error, error, []))}")
      IO.puts("[WhisperAPI] Stacktrace: #{inspect(__STACKTRACE__)}")
      {:error, "Unexpected error: #{inspect(error)}"}
  end

  # Execute HTTP request with retry logic for transient network errors
  defp execute_request_with_retry(headers, body, attempt) do
    request = Finch.build(:post, @whisper_api_url, headers, body)

    # Use pool_timeout to fail fast if connection pool is exhausted
    # and receive_timeout for the actual request
    case Finch.request(request, ClippsterFinch, receive_timeout: 120_000, pool_timeout: 10_000) do
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
        # Rate limited - retry with longer delay
        if attempt < @max_retries do
          # Use longer delay for rate limiting (at least 5 seconds)
          delay = max(calculate_backoff_delay(attempt), 5000)

          IO.puts(
            "[WhisperAPI] Rate limited (429), retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})..."
          )

          Process.sleep(delay)
          execute_request_with_retry(headers, body, attempt + 1)
        else
          IO.puts("[WhisperAPI] Rate limited after #{@max_retries} retries")
          {:error, "Whisper API rate limited (429): #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}}
      when status_code in [500, 502, 503, 504] ->
        # Server errors that are retryable
        if attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)

          IO.puts(
            "[WhisperAPI] Server error #{status_code}, retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})..."
          )

          Process.sleep(delay)
          execute_request_with_retry(headers, body, attempt + 1)
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
          execute_request_with_retry(headers, body, attempt + 1)
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
      _ -> false
    end
  end

  defp retryable_error?(_), do: false

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
