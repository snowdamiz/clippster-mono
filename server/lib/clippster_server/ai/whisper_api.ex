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

          # Use Req library for better HTTP handling
          IO.puts("[WhisperAPI] Sending request to Whisper API...")

          # Create multipart form data (matching JavaScript prototype)
          multipart_form = [
            {:file, file_content,
             {"form-data", [{"name", "file"}, {"filename", audio_upload.filename}]},
             [{"Content-Type", audio_upload.content_type}]},
            {"language", "english"},  # Use "english" instead of "en" to match prototype
            {"response_format", "verbose_json"},
            {"temperature", "0.0"},
            {"timestamp_granularities[]", "word,segment"}  # Match prototype format
          ]

          request_opts = [
            method: :post,
            url: @whisper_api_url,
            headers: build_headers(api_key),
            form: {:multipart, multipart_form},
            auth: {:bearer, api_key}
          ]

          case Req.request(request_opts) do
            {:ok, %{status: 200, body: body}} ->
              IO.puts("[WhisperAPI] Received response from API")
              IO.puts("[WhisperAPI] Response body type: #{inspect(body)}")

              case body do
                %{} = response ->
                  IO.puts("[WhisperAPI] Successfully received structured response")
                  IO.puts("[WhisperAPI] Response keys: #{inspect(Map.keys(response))}")
                  {:ok, response}

                raw_body when is_binary(raw_body) ->
                  IO.puts("[WhisperAPI] Received raw string, attempting JSON decode")
                  case Jason.decode(raw_body) do
                    {:ok, response} ->
                      IO.puts("[WhisperAPI] Successfully decoded JSON response")
                      {:ok, response}
                    {:error, reason} ->
                      IO.puts("[WhisperAPI] Failed to decode JSON: #{inspect(reason)}")
                      IO.puts("[WhisperAPI] Response body: #{String.slice(raw_body, 0, 500)}...")
                      {:error, "Invalid JSON response: #{inspect(reason)}"}
                  end

                _ ->
                  IO.puts("[WhisperAPI] Unexpected response body type: #{inspect(body)}")
                  {:error, "Unexpected response format"}
              end

            {:ok, %{status: status_code, body: body}} ->
              IO.puts("[WhisperAPI] API returned error status: #{status_code}")
              IO.puts("[WhisperAPI] Error body: #{inspect(body)}")
              {:error, "Whisper API error (#{status_code}): #{inspect(body)}"}

            {:error, exception} ->
              IO.puts("[WhisperAPI] Request failed: #{inspect(exception)}")
              IO.puts("[WhisperAPI] Exception type: #{inspect(Exception.message(exception))}")
              {:error, "Network error: #{inspect(Exception.message(exception))}"}
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

  defp build_headers(api_key) do
    [
      {"Authorization", "Bearer #{api_key}"},
      {"User-Agent", "Clippster/1.0"}
    ]
  end
end