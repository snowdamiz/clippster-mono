defmodule ClippsterServer.AI.WhisperAPI do
  @moduledoc """
  Interface to the Whisper AI API for speech-to-text transcription.
  Documentation: https://www.lemonfox.ai/apis/speech-to-text
  """

  @whisper_api_url "https://api.lemonfox.ai/v1/audio/transcriptions"

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
          IO.puts("[WhisperAPI] File size: #{byte_size(file_content)} bytes")

          # Use Finch HTTP client
          IO.puts("[WhisperAPI] Sending request to Whisper API...")

          # Create multipart boundary
          boundary = "----WebKitFormBoundary#{:crypto.strong_rand_bytes(16) |> Base.encode16()}"

          # Build multipart body
          multipart_body = build_multipart_body(file_content, audio_upload.filename, audio_upload.content_type, boundary)

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

  defp build_multipart_body(file_content, filename, content_type, boundary) do
    parts = [
      # File part
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"file\"; filename=\"#{filename}\"\r\n",
      "Content-Type: #{content_type}\r\n\r\n",
      file_content,
      "\r\n",
      # Language part
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"language\"\r\n\r\n",
      "english\r\n",
      # Response format part
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"response_format\"\r\n\r\n",
      "verbose_json\r\n",
      # Temperature part
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"temperature\"\r\n\r\n",
      "0.0\r\n",
      # Timestamp granularities part
      "--#{boundary}\r\n",
      "Content-Disposition: form-data; name=\"timestamp_granularities[]\"\r\n\r\n",
      "word,segment\r\n",
      # End boundary
      "--#{boundary}--\r\n"
    ]

    body = IO.iodata_to_binary(parts)
    IO.puts("[WhisperAPI] Multipart body length: #{byte_size(body)} bytes")
    IO.puts("[WhisperAPI] First 200 chars: #{String.slice(body, 0, 200)}")
    body
  end
end