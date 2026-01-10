defmodule ClippsterServer.AI.OpenRouterAPI do
  @moduledoc """
  Interface to the OpenRouter API for AI-powered clip generation.
  Updated to use the Responses API Beta with reasoning capabilities.
  """

  alias ClippsterServerWeb.ProgressChannel

  @openrouter_api_url "https://openrouter.ai/api/v1/responses"

  def generate_clips(transcript, system_prompt, user_prompt_input, project_id \\ nil) do
    IO.puts("[OpenRouterAPI] Starting clip generation...")

    # Get API key from environment
    api_key = System.get_env("OPENROUTER_API_KEY")

    cond do
      is_nil(api_key) ->
        IO.puts("[OpenRouterAPI] OPENROUTER_API_KEY environment variable not set")
        {:error, "OPENROUTER_API_KEY environment variable not set"}

      true ->
        IO.puts("[OpenRouterAPI] API key configured")

        # Get model from environment or use default
        model = System.get_env("OPENROUTER_MODEL", "z-ai/glm-4.7")
        IO.puts("[OpenRouterAPI] Using model: #{model}")
        IO.puts("[OpenRouterAPI] Using Responses API with high reasoning effort")

        # Start with the initial request
        generate_clips_with_retry(transcript, system_prompt, user_prompt_input, model, api_key, 0, [], project_id)
    end
  rescue
    reason ->
      IO.puts("[OpenRouterAPI] Rescue error: #{inspect(reason)}")
      IO.puts("[OpenRouterAPI] Stacktrace: #{inspect(__STACKTRACE__)}")
      {:error, "Rescue exception: #{inspect(reason)}"}
  end

  defp generate_clips_with_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt, missing_fields, project_id) do
    max_attempts = 3
    
    if attempt > 0 and project_id do
      ProgressChannel.broadcast_progress(project_id, "analyzing", 50, "AI request failed, retrying (Attempt #{attempt + 1}/#{max_attempts})...")
    end

    IO.puts("[OpenRouterAPI] Attempt #{attempt + 1}/#{max_attempts}")

    # Prepare the request payload
    user_prompt = build_user_prompt(transcript, user_prompt_input, attempt)

    payload = %{
      "model" => model,
      "input" => [
        %{
          "type" => "message",
          "role" => "system",
          "content" => [
            %{
              "type" => "input_text",
              "text" => missing_fields_prompt(system_prompt, missing_fields)
            }
          ]
        },
        %{
          "type" => "message",
          "role" => "user",
          "content" => [
            %{
              "type" => "input_text",
              "text" => user_prompt
            }
          ]
        }
      ],
      "reasoning" => %{
        "effort" => "high"
      },
      "max_output_tokens" => 8000
    }

    IO.puts("[OpenRouterAPI] Request payload prepared for Responses API")

    # Make the HTTP request
    json_payload = Jason.encode!(payload)
    # Increase timeout to 120s (120000ms) to avoid premature timeouts
    options = [recv_timeout: 120_000, timeout: 120_000]
    
    case HTTPoison.post(@openrouter_api_url, json_payload, build_headers(api_key), options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        IO.puts("[OpenRouterAPI] Received response from API")

        case Jason.decode(body) do
          {:ok, response} ->
            IO.puts("[OpenRouterAPI] Successfully decoded JSON response")

            # Extract the content from the AI response
            case extract_clips_from_response(response) do
              {:ok, clips} ->
                IO.puts("[OpenRouterAPI] Successfully extracted clips from AI response")

                # Validate the clips structure
                case validate_clips_response(clips) do
                  :ok ->
                    IO.puts("[OpenRouterAPI] Clips validation passed")
                    usage = Map.get(response, "usage", %{})
                    {:ok, clips, usage}

                  {:error, new_missing_fields} when attempt < max_attempts - 1 ->
                    IO.puts("[OpenRouterAPI] Validation failed, missing fields: #{inspect(new_missing_fields)}")
                    IO.puts("[OpenRouterAPI] Retrying with field-specific guidance...")

                    # Retry with field-specific guidance
                    generate_clips_with_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt + 1, new_missing_fields, project_id)

                  {:error, new_missing_fields} ->
                    IO.puts("[OpenRouterAPI] Validation failed after #{max_attempts} attempts, missing fields: #{inspect(new_missing_fields)}")
                    {:error, "Missing required fields: #{Enum.join(new_missing_fields, ", ")}"}
                end

              {:error, reason} ->
                IO.puts("[OpenRouterAPI] Failed to extract clips: #{reason}")
                {:error, reason}
            end

          {:error, reason} ->
            IO.puts("[OpenRouterAPI] Failed to decode JSON: #{inspect(reason)}")
            {:error, "Invalid JSON response: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        IO.puts("[OpenRouterAPI] API returned error status: #{status_code}")
        
        # Retry on server errors (5xx) if we have attempts left
        if status_code >= 500 and attempt < max_attempts - 1 do
          IO.puts("[OpenRouterAPI] Server error #{status_code}, retrying...")
          :timer.sleep(2000 * (attempt + 1)) # Exponential backoff
          generate_clips_with_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt + 1, missing_fields, project_id)
        else
          {:error, "OpenRouter API error (#{status_code}): #{body}"}
        end

      {:error, %HTTPoison.Error{reason: reason}} ->
        IO.puts("[OpenRouterAPI] HTTP request failed: #{inspect(reason)}")
        
        # Retry on network errors if we have attempts left
        if attempt < max_attempts - 1 do
          IO.puts("[OpenRouterAPI] Network error, retrying...")
          if project_id do
             ProgressChannel.broadcast_progress(project_id, "analyzing", 50, "Network error: #{inspect(reason)}. Retrying (Attempt #{attempt + 1}/#{max_attempts})...")
          end
          :timer.sleep(2000 * (attempt + 1)) # Exponential backoff
          generate_clips_with_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt + 1, missing_fields, project_id)
        else
          {:error, "Network error: #{inspect(reason)}"}
        end
    end
  end

  defp missing_fields_prompt(system_prompt, []), do: system_prompt
  defp missing_fields_prompt(system_prompt, missing_fields) do
    # Build field-specific retry prompt
    field_guidance = build_field_guidance(missing_fields)

    # Add field guidance to the system prompt
    system_prompt <> "\n\n**CRITICAL FIELD REQUIREMENTS:**\n" <> field_guidance
  end

  defp build_headers(api_key) do
    [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster-prototype"},
      {"X-Title", "Clippster AI Clip Detection"},
      {"User-Agent", "Clippster/1.0"}
    ]
  end

  defp build_user_prompt(transcript, user_prompt, attempt) do
    try do
      transcript_json = Jason.encode!(transcript, pretty: true)

      retry_message = if attempt > 0 do
        """

        **⚠️ RETRY NOTICE:** Previous response was missing required fields. Please ensure ALL required fields are included in your response, especially the socialMediaPost field for each clip.
        """
      else
        ""
      end

      """
      **USER INSTRUCTIONS:**

      #{user_prompt}

      **TRANSCRIPT CHUNK:**

      #{transcript_json}

      Please analyze this transcript and generate viral clips according to the user instructions and system prompt.#{retry_message}
      """
    rescue
      e ->
        IO.puts("[OpenRouterAPI] Error encoding transcript: #{inspect(e)}")

        # Fallback: try to encode just the essential parts
        simplified_transcript = %{
          "duration" => Map.get(transcript, "duration"),
          "language" => Map.get(transcript, "language"),
          "text" => Map.get(transcript, "text"),
          "segments" => Map.get(transcript, "segments", [])
            |> Enum.map(fn segment ->
              %{
                "id" => Map.get(segment, "id"),
                "start" => Map.get(segment, "start"),
                "end" => Map.get(segment, "end"),
                "text" => Map.get(segment, "text"),
                "speaker" => Map.get(segment, "speaker")
              }
            end)
        }

        transcript_json = Jason.encode!(simplified_transcript, pretty: true)

        retry_message = if attempt > 0 do
          """

          **⚠️ RETRY NOTICE:** Previous response was missing required fields. Please ensure ALL required fields are included in your response, especially the socialMediaPost field for each clip.
          """
        else
          ""
        end

        """
        **USER INSTRUCTIONS:**

        #{user_prompt}

        **TRANSCRIPT CHUNK:**

        #{transcript_json}

        Please analyze this transcript and generate viral clips according to the user instructions and system prompt.#{retry_message}
        """
    end
  end

  defp extract_clips_from_response(response) do
    # Handle new Responses API structure
    case Map.get(response, "output") do
      output when is_list(output) ->
        # Find the message component with output_text
        message_content = output
          |> Enum.find_value(fn
            %{"type" => "message", "content" => content} when is_list(content) ->
              # Find the first output_text part
              Enum.find_value(content, fn
                %{"type" => "output_text", "text" => text} -> text
                _ -> nil
              end)
            _ -> nil
          end)

        if message_content do
          # Try to parse the content as JSON
          case Jason.decode(message_content) do
            {:ok, clips_data} ->
              {:ok, clips_data}

            {:error, reason} ->
              # Try to find JSON block in markdown code fence if pure JSON parse fails
              case Regex.run(~r/```(?:json)?\s*([\s\S]*?)\s*```/, message_content) do
                [_, json_block] ->
                  case Jason.decode(json_block) do
                    {:ok, clips_data} -> {:ok, clips_data}
                    {:error, _} ->
                      IO.puts("[OpenRouterAPI] Failed to parse extracted JSON block: #{inspect(reason)}")
                      {:error, "Invalid JSON in extracted block"}
                  end
                nil ->
                  IO.puts("[OpenRouterAPI] Failed to parse AI response as JSON: #{inspect(reason)}")
                  IO.puts("[OpenRouterAPI] AI response content: #{String.slice(message_content, 0, 1000)}...")
                  {:error, "AI response is not valid JSON"}
              end
          end
        else
           {:error, "No output text found in response"}
        end

      # Handle possible error structure or unexpected format
      _ ->
        # Check for top-level error
        if Map.has_key?(response, "error") do
           {:error, "API Error: #{inspect(response["error"])}"}
        else
           {:error, "Unexpected response format (missing 'output')"}
        end
    end
  end

  # Validate clips response structure
  defp validate_clips_response(clips) do
    case clips do
      %{"clips" => clips_array} when is_list(clips_array) and length(clips_array) > 0 ->
        required_clip_fields = [
          "id", "title", "filename", "type", "segments",
          "total_duration", "combined_transcript", "virality_score",
          "reason", "socialMediaPost"
        ]

        # Check each clip for required fields
        missing_fields = clips_array
        |> Enum.with_index()
        |> Enum.reduce([], fn {clip, index}, acc ->
          clip_missing = Enum.filter(required_clip_fields, fn field ->
            not Map.has_key?(clip, field) or is_nil(Map.get(clip, field)) or Map.get(clip, field) == ""
          end)

          if length(clip_missing) > 0 do
            formatted_missing = Enum.map(clip_missing, fn field ->
              "#{field} (clip #{index + 1})"
            end)
            acc ++ formatted_missing
          else
            acc
          end
        end)

        if length(missing_fields) == 0 do
          :ok
        else
          {:error, missing_fields}
        end

      _ ->
        {:error, ["clips array is missing or empty"]}
    end
  end

  # Build field-specific guidance for missing fields
  defp build_field_guidance(missing_fields) do
    field_guidance = Enum.map(missing_fields, fn field ->
      case field do
        "socialMediaPost" ->
          """
          **socialMediaPost (REQUIRED):** Each clip MUST include a "socialMediaPost" field with:
          - An engaging caption (15-30 words)
          - 2-4 relevant hashtags (e.g., #trading, #crypto, #memes)
          - 2-3 appropriate emojis
          - Example: "🚀 Just made the most insane market call of my life! Could this be the next 100x? 📈 #trading #crypto #investing #memes"
          """

        "reason" ->
          """
          **reason (REQUIRED):** Each clip MUST include a "reason" field explaining:
          - Why this clip could go viral
          - What makes it engaging or noteworthy
          - The key emotional hook or moment
          - Example: "Perfect timing on a controversial market prediction with high conviction"
          """

        "virality_score" ->
          """
          **virality_score (REQUIRED):** Each clip MUST include a "virality_score" field:
          - Number from 0-100
          - Based on engagement potential
          - Consider emotional impact, timing, content density
          - Higher scores for more engaging content
          """

        "combined_transcript" ->
          """
          **combined_transcript (REQUIRED):** Each clip MUST include a "combined_transcript" field:
          - Full text of all segments concatenated
          - Proper spacing between segments
          - Exact transcript from the video
          """

        "total_duration" ->
          """
          **total_duration (REQUIRED):** Each clip MUST include a "total_duration" field:
          - Number (decimal) in seconds
          - Sum of all segment durations
          - Calculate from segments array
          """

        "filename" ->
          """
          **filename (REQUIRED):** Each clip MUST include a "filename" field:
          - Descriptive filename (2-6 words)
          - Lowercase letters, numbers, underscores only
          - Must end with .mp4
          - Example: "epic_market_prediction_100x.mp4"
          """

        _ ->
          "**#{field} (REQUIRED):** Please ensure this field is included and properly formatted."
      end
    end)

    Enum.join(field_guidance, "\n\n")
  end

  @doc """
  Generate clips using a specific model. Used by multimodal detection.
  Returns {:ok, ai_response, usage} or {:error, reason}.
  """
  def generate_clips_with_model(transcript, system_prompt, user_prompt_input, model, project_id \\ nil) do
    IO.puts("[OpenRouterAPI] Starting clip generation with model: #{model}")

    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY environment variable not set"}
    else
      generate_clips_with_model_retry(transcript, system_prompt, user_prompt_input, model, api_key, 0, [], project_id)
    end
  rescue
    reason ->
      IO.puts("[OpenRouterAPI] Rescue error in generate_clips_with_model: #{inspect(reason)}")
      {:error, "Exception: #{inspect(reason)}"}
  end

  defp generate_clips_with_model_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt, missing_fields, project_id) do
    max_attempts = 2  # Fewer retries for multimodal since we have multiple models

    IO.puts("[OpenRouterAPI] Model #{model} - Attempt #{attempt + 1}/#{max_attempts}")

    user_prompt = build_user_prompt(transcript, user_prompt_input, attempt)

    # Build payload - use chat completions API for broader model compatibility
    payload = build_chat_payload(model, system_prompt, user_prompt, missing_fields)

    json_payload = Jason.encode!(payload)
    options = [recv_timeout: 150_000, timeout: 150_000]  # 2.5 min timeout

    # Use chat completions endpoint for broader compatibility
    api_url = "https://openrouter.ai/api/v1/chat/completions"

    case HTTPoison.post(api_url, json_payload, build_headers(api_key), options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            case extract_clips_from_chat_response(response) do
              {:ok, clips} ->
                case validate_clips_response(clips) do
                  :ok ->
                    usage = Map.get(response, "usage", %{})
                    {:ok, clips, usage}

                  {:error, new_missing_fields} when attempt < max_attempts - 1 ->
                    IO.puts("[OpenRouterAPI] Model #{model} validation failed, retrying...")
                    :timer.sleep(1000)
                    generate_clips_with_model_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt + 1, new_missing_fields, project_id)

                  {:error, new_missing_fields} ->
                    {:error, "Missing fields after retries: #{inspect(new_missing_fields)}"}
                end

              {:error, reason} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, "JSON decode failed: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} when status_code >= 500 ->
        if attempt < max_attempts - 1 do
          :timer.sleep(2000 * (attempt + 1))
          generate_clips_with_model_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt + 1, missing_fields, project_id)
        else
          {:error, "Server error #{status_code}: #{String.slice(body, 0, 200)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        {:error, "API error #{status_code}: #{String.slice(body, 0, 200)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        if attempt < max_attempts - 1 do
          :timer.sleep(2000 * (attempt + 1))
          generate_clips_with_model_retry(transcript, system_prompt, user_prompt_input, model, api_key, attempt + 1, missing_fields, project_id)
        else
          {:error, "Network error: #{inspect(reason)}"}
        end
    end
  end

  @doc """
  Run the decider model to synthesize results from multiple detection models.
  Returns {:ok, clips, usage} or {:error, reason}.
  """
  def decide_final_clips(decider_prompt, model, project_id \\ nil) do
    IO.puts("[OpenRouterAPI] Running decider model: #{model}")

    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY environment variable not set"}
    else
      decide_final_clips_impl(decider_prompt, model, api_key, project_id)
    end
  rescue
    reason ->
      IO.puts("[OpenRouterAPI] Rescue error in decide_final_clips: #{inspect(reason)}")
      {:error, "Exception: #{inspect(reason)}"}
  end

  defp decide_final_clips_impl(decider_prompt, model, api_key, _project_id) do
    payload = %{
      "model" => model,
      "messages" => [
        %{
          "role" => "user",
          "content" => decider_prompt
        }
      ],
      "max_tokens" => 8000,
      "temperature" => 0.3  # Lower temperature for more consistent synthesis
    }

    json_payload = Jason.encode!(payload)
    options = [recv_timeout: 180_000, timeout: 180_000]  # 3 min for decider

    api_url = "https://openrouter.ai/api/v1/chat/completions"

    case HTTPoison.post(api_url, json_payload, build_headers(api_key), options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            case extract_clips_from_chat_response(response) do
              {:ok, result} ->
                # Extract clips from the result (decider returns {clips, synthesis_notes})
                clips = Map.get(result, "clips", [])
                usage = Map.get(response, "usage", %{})
                {:ok, clips, usage}

              {:error, reason} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, "JSON decode failed: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        {:error, "Decider API error #{status_code}: #{String.slice(body, 0, 200)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Decider network error: #{inspect(reason)}"}
    end
  end

  # Build payload for chat completions API (broader model compatibility)
  defp build_chat_payload(model, system_prompt, user_prompt, missing_fields) do
    %{
      "model" => model,
      "messages" => [
        %{
          "role" => "system",
          "content" => missing_fields_prompt(system_prompt, missing_fields)
        },
        %{
          "role" => "user",
          "content" => user_prompt
        }
      ],
      "max_tokens" => 8000,
      "temperature" => 0.7
    }
  end

  # Extract clips from chat completions response format
  defp extract_clips_from_chat_response(response) do
    case response do
      %{"choices" => [%{"message" => %{"content" => content}} | _]} when is_binary(content) ->
        # Try to parse the content as JSON
        case Jason.decode(content) do
          {:ok, clips_data} ->
            {:ok, clips_data}

          {:error, _} ->
            # Try to find JSON block in markdown code fence
            case Regex.run(~r/```(?:json)?\s*([\s\S]*?)\s*```/, content) do
              [_, json_block] ->
                case Jason.decode(json_block) do
                  {:ok, clips_data} -> {:ok, clips_data}
                  {:error, _} -> {:error, "Invalid JSON in code block"}
                end
              nil ->
                # Try to find raw JSON object
                case Regex.run(~r/\{[\s\S]*"clips"[\s\S]*\}/, content) do
                  [json_match] ->
                    case Jason.decode(json_match) do
                      {:ok, clips_data} -> {:ok, clips_data}
                      {:error, _} -> {:error, "Could not parse JSON from response"}
                    end
                  nil ->
                    {:error, "No JSON found in response"}
                end
            end
        end

      %{"choices" => []} ->
        {:error, "Empty choices in response"}

      _ ->
        if Map.has_key?(response, "error") do
          {:error, "API Error: #{inspect(response["error"])}"}
        else
          {:error, "Unexpected response format"}
        end
    end
  end

end
