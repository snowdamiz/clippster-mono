defmodule ClippsterServer.AI.WhisperAPI do
  @moduledoc """
  Interface to the Whisper AI API for speech-to-text transcription.
  Documentation: https://www.lemonfox.ai/apis/speech-to-text
  """

  @whisper_api_url "https://api.lemonfox.ai/v1/audio/transcriptions"

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
        if actual_size > 50_000_000 do  # 50MB threshold
          IO.puts("[WhisperAPI] WARNING: Binary seems too large (#{actual_size} bytes)")
        end

        # Use Finch HTTP client
        IO.puts("[WhisperAPI] Sending binary request to Whisper API...")

        # Create multipart boundary
        boundary = "----WebKitFormBoundary#{:crypto.strong_rand_bytes(16) |> Base.encode16()}"

        # Build multipart body with binary data
        multipart_body = build_prototype_multipart_body(audio_binary, upload_metadata.filename, upload_metadata.content_type, boundary)

        request = Finch.build(
          :post,
          @whisper_api_url,
          [
            {"Authorization", "Bearer #{api_key}"},
            {"User-Agent", "Clippster/1.0"},
            {"Content-Type", "multipart/form-data; boundary=#{boundary}"}
          ],
          multipart_body
        )

        IO.puts("[WhisperAPI] Making Finch binary request...")
        case Finch.request(request, ClippsterFinch, receive_timeout: 60_000) do
          {:ok, %Finch.Response{status: 200, body: body}} ->
            IO.puts("[WhisperAPI] Received response from API")
            IO.puts("[WhisperAPI] Response body length: #{byte_size(body)} bytes")

            case Jason.decode(body) do
              {:ok, response} ->
                IO.puts("[WhisperAPI] Successfully decoded JSON response")
                IO.puts("[WhisperAPI] Response keys: #{inspect(Map.keys(response))}")
                {:ok, response}

              {:error, reason} ->
                IO.puts("[WhisperAPI] Failed to decode JSON: #{inspect(reason)}")
                IO.puts("[WhisperAPI] Response body: #{String.slice(body, 0, 500)}...")
                {:error, "Invalid JSON response: #{inspect(reason)}"}
            end

          {:ok, %Finch.Response{status: status_code, body: body}} ->
            IO.puts("[WhisperAPI] API returned error status: #{status_code}")
            IO.puts("[WhisperAPI] Error body: #{body}")
            {:error, "Whisper API error (#{status_code}): #{body}"}

          {:error, reason} ->
            IO.puts("[WhisperAPI] HTTP request failed: #{inspect(reason)}")
            {:error, "Network error: #{inspect(reason)}"}
        end
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
          if actual_size > 5_000_000 do  # 5MB threshold
            IO.puts("[WhisperAPI] WARNING: File seems too large for MP3 (#{actual_size} bytes)")
          end

          # Use Finch HTTP client
          IO.puts("[WhisperAPI] Sending request to Whisper API...")

          # Create multipart boundary
          boundary = "----WebKitFormBoundary#{:crypto.strong_rand_bytes(16) |> Base.encode16()}"

          # Build multipart body EXACTLY matching the prototype
          multipart_body = build_prototype_multipart_body(file_content, audio_upload.filename, audio_upload.content_type, boundary)

          request = Finch.build(
            :post,
            @whisper_api_url,
            [
              {"Authorization", "Bearer #{api_key}"},
              {"User-Agent", "Clippster/1.0"},
              {"Content-Type", "multipart/form-data; boundary=#{boundary}"}
            ],
            multipart_body
          )

          IO.puts("[WhisperAPI] Making Finch request...")
          case Finch.request(request, ClippsterFinch, receive_timeout: 60_000) do
            {:ok, %Finch.Response{status: 200, body: body}} ->
              IO.puts("[WhisperAPI] Received response from API")
              IO.puts("[WhisperAPI] Response body length: #{byte_size(body)} bytes")

              case Jason.decode(body) do
                {:ok, response} ->
                  IO.puts("[WhisperAPI] Successfully decoded JSON response")
                  IO.puts("[WhisperAPI] Response keys: #{inspect(Map.keys(response))}")
                  {:ok, response}

                {:error, reason} ->
                  IO.puts("[WhisperAPI] Failed to decode JSON: #{inspect(reason)}")
                  IO.puts("[WhisperAPI] Response body: #{String.slice(body, 0, 500)}...")
                  {:error, "Invalid JSON response: #{inspect(reason)}"}
              end

            {:ok, %Finch.Response{status: status_code, body: body}} ->
              IO.puts("[WhisperAPI] API returned error status: #{status_code}")
              IO.puts("[WhisperAPI] Error body: #{body}")
              {:error, "Whisper API error (#{status_code}): #{body}"}

            {:error, reason} ->
              IO.puts("[WhisperAPI] HTTP request failed: #{inspect(reason)}")
              {:error, "Network error: #{inspect(reason)}"}
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