defmodule ClippsterServer.AI.OpenRouterAPI do
  @moduledoc """
  Interface to the OpenRouter API for AI-powered clip generation.
  """

  @openrouter_api_url "https://openrouter.ai/api/v1/chat/completions"

  def generate_clips(transcript, system_prompt) do
    IO.puts("[OpenRouterAPI] Starting clip generation...")

    try do
      # Get API key from environment
      api_key = System.get_env("OPENROUTER_API_KEY")
      IO.puts("[OpenRouterAPI] Checking API key...")

      if not api_key do
        IO.puts("[OpenRouterAPI] OPENROUTER_API_KEY environment variable not set")
        {:error, "OPENROUTER_API_KEY environment variable not set"}
      else

    # Get model from environment or use default
      model = System.get_env("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
      IO.puts("[OpenRouterAPI] API key configured, using model: #{model}")

      # Prepare the request payload
      user_prompt = build_user_prompt(transcript)

      payload = %{
        "model" => model,
        "messages" => [
          %{
            "role" => "system",
            "content" => system_prompt
          },
          %{
            "role" => "user",
            "content" => user_prompt
          }
        ],
        "temperature" => 0.7,
        "max_tokens" => 4000,
        "reasoning" => %{
          "effort" => "high",
          "max_tokens" => 2000
        }
      }

      IO.puts("[OpenRouterAPI] Request payload prepared")
      IO.puts("[OpenRouterAPI] Sending request to OpenRouter API...")

      # Make the HTTP request
      case HTTPoison.post(@openrouter_api_url, Jason.encode!(payload), build_headers(api_key)) do
        {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
          IO.puts("[OpenRouterAPI] Received response from API")
          IO.puts("[OpenRouterAPI] Response body length: #{byte_size(body)} bytes")

          case Jason.decode(body) do
            {:ok, response} ->
              IO.puts("[OpenRouterAPI] Successfully decoded JSON response")

              # Extract the content from the AI response
              case extract_clips_from_response(response) do
                {:ok, clips} ->
                  IO.puts("[OpenRouterAPI] Successfully extracted clips from AI response")
                  {:ok, clips}

                {:error, reason} ->
                  IO.puts("[OpenRouterAPI] Failed to extract clips: #{reason}")
                  {:error, reason}
              end

            {:error, reason} ->
              IO.puts("[OpenRouterAPI] Failed to decode JSON: #{inspect(reason)}")
              IO.puts("[OpenRouterAPI] Response body: #{String.slice(body, 0, 500)}...")
              {:error, "Invalid JSON response: #{inspect(reason)}"}
          end

        {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
          IO.puts("[OpenRouterAPI] API returned error status: #{status_code}")
          IO.puts("[OpenRouterAPI] Error body: #{body}")
          {:error, "OpenRouter API error (#{status_code}): #{body}"}

        {:error, %HTTPoison.Error{reason: reason}} ->
          IO.puts("[OpenRouterAPI] HTTP request failed: #{inspect(reason)}")
          {:error, "Network error: #{inspect(reason)}"}
      end
    end
    else
      other_result ->
        IO.puts("[OpenRouterAPI] Unexpected result from if-else: #{inspect(other_result)}")
        other_result
    end
  catch
    kind, reason ->
      IO.puts("[OpenRouterAPI] Caught error: #{inspect(kind)} - #{inspect(reason)}")
      IO.puts("[OpenRouterAPI] Stacktrace: #{inspect(__STACKTRACE__)}")
      {:error, "Caught exception: #{inspect(kind)} - #{inspect(reason)}"}
  rescue
    reason ->
      IO.puts("[OpenRouterAPI] Rescue error: #{inspect(reason)}")
      IO.puts("[OpenRouterAPI] Stacktrace: #{inspect(__STACKTRACE__)}")
      {:error, "Rescue exception: #{inspect(reason)}"}
  end

defp build_headers(api_key) do
  [
    {"Authorization", "Bearer #{api_key}"},
    {"Content-Type", "application/json"},
    {"HTTP-Referer", "https://clippster.app"},
    {"X-Title", "Clippster"},
    {"User-Agent", "Clippster/1.0"}
  ]
end

defp build_user_prompt(transcript) do
  """
  **TRANSCRIPT CHUNK:**

  #{Jason.encode!(transcript, pretty: true)}

  Please analyze this transcript and generate viral clips according to the system prompt instructions.
  """
end

defp extract_clips_from_response(response) do
  case get_in(response, ["choices"]) do
    [choice | _] ->
      case get_in(choice, ["message", "content"]) do
        content when is_binary(content) ->
          # Try to parse the content as JSON
          case Jason.decode(content) do
            {:ok, clips_data} ->
              {:ok, clips_data}

            {:error, reason} ->
              IO.puts("[OpenRouterAPI] Failed to parse AI response as JSON: #{inspect(reason)}")
              IO.puts("[OpenRouterAPI] AI response content: #{String.slice(content, 0, 1000)}...")
              {:error, "AI response is not valid JSON"}
          end

        nil ->
          {:error, "No content in AI response"}
      end

    nil ->
      {:error, "No choices in AI response"}
  end
end

end