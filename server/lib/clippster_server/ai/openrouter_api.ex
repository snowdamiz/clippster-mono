defmodule ClippsterServer.AI.OpenRouterAPI do
  @moduledoc """
  Interface to the OpenRouter API for AI-powered clip generation.
  Uses the Chat Completions API for broad model compatibility (Gemini, DeepSeek, etc.).

  All clip detection (VOD standard, VOD enhanced, and livestream `detect_realtime`) uses
  `clip_detection_model/0` — pinned to `google/gemini-3.1-flash-lite` (not `OPENROUTER_MODEL`).
  """

  @clip_detection_model "google/gemini-3.1-flash-lite"
  @chat_completions_url "https://openrouter.ai/api/v1/chat/completions"
  @clip_output_max_tokens 32_000
  @full_vod_recv_timeout_ms 600_000
  @enhanced_vod_recv_timeout_ms 900_000

  def clip_detection_model, do: @clip_detection_model

  def generate_clips(transcript, system_prompt, user_prompt_input, project_id \\ nil) do
    model = clip_detection_model()
    IO.puts("[OpenRouterAPI] Starting clip generation with model: #{model}")
    generate_clips_with_model(transcript, system_prompt, user_prompt_input, model, project_id)
  end

  @doc """
  Enhanced VOD detection: transcript + video (with embedded audio) in one multimodal pass.
  Returns `{:ok, ai_response, usage}` or `{:error, reason}`.
  """
  def generate_clips_enhanced(
        transcript,
        video_base64,
        system_prompt,
        user_prompt_input,
        project_id \\ nil,
        chunk_start_time \\ 0,
        chunk_end_time \\ 0
      ) do
    model = clip_detection_model()
    IO.puts("[OpenRouterAPI] Starting ENHANCED clip generation with model: #{model}")

    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY environment variable not set"}
    else
      generate_clips_enhanced_retry(
        transcript,
        video_base64,
        system_prompt,
        user_prompt_input,
        model,
        api_key,
        0,
        [],
        project_id,
        chunk_start_time,
        chunk_end_time
      )
    end
  rescue
    reason ->
      IO.puts("[OpenRouterAPI] Rescue error in generate_clips_enhanced: #{inspect(reason)}")
      {:error, "Exception: #{inspect(reason)}"}
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
      transcript_json = Jason.encode!(transcript)

      retry_message =
        if attempt > 0 do
          """

          **⚠️ RETRY NOTICE:** Previous response was missing required fields. Please ensure ALL required fields are included in your response, especially the socialMediaPost field for each clip.
          """
        else
          ""
        end

      """
      **USER INSTRUCTIONS:**

      #{user_prompt}

      **TRANSCRIPT:**

      #{transcript_json}

      Please analyze this transcript and generate viral clips according to the user instructions and system prompt.#{retry_message}

      Return compact valid JSON only. Keep titles, reasons, transcripts, and social captions concise.
      """
    rescue
      e ->
        IO.puts("[OpenRouterAPI] Error encoding transcript: #{inspect(e)}")

        # Fallback: try to encode just the essential parts
        simplified_transcript = %{
          "duration" => Map.get(transcript, "duration"),
          "language" => Map.get(transcript, "language"),
          "text" => Map.get(transcript, "text"),
          "segments" =>
            Map.get(transcript, "segments", [])
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

        transcript_json = Jason.encode!(simplified_transcript)

        retry_message =
          if attempt > 0 do
            """

            **⚠️ RETRY NOTICE:** Previous response was missing required fields. Please ensure ALL required fields are included in your response, especially the socialMediaPost field for each clip.
            """
          else
            ""
          end

        """
        **USER INSTRUCTIONS:**

        #{user_prompt}

        **TRANSCRIPT:**

        #{transcript_json}

        Please analyze this transcript and generate viral clips according to the user instructions and system prompt.#{retry_message}

        Return compact valid JSON only. Keep titles, reasons, transcripts, and social captions concise.
        """
    end
  end

  # Validate clips response structure
  defp validate_clips_response(clips) do
    case clips do
      # Empty clips array is valid - means no clip-worthy content was found
      %{"clips" => clips_array} when is_list(clips_array) and length(clips_array) == 0 ->
        IO.puts("[OpenRouterAPI] AI returned empty clips array - no clip-worthy content found")
        :ok

      %{"clips" => clips_array} when is_list(clips_array) and length(clips_array) > 0 ->
        required_clip_fields = [
          "id",
          "title",
          "filename",
          "type",
          "segments",
          "total_duration",
          "combined_transcript",
          "virality_score",
          "reason",
          "socialMediaPost"
        ]

        # Check each clip for required fields
        missing_fields =
          clips_array
          |> Enum.with_index()
          |> Enum.reduce([], fn {clip, index}, acc ->
            clip_missing =
              Enum.filter(required_clip_fields, fn field ->
                not Map.has_key?(clip, field) or is_nil(Map.get(clip, field)) or
                  Map.get(clip, field) == ""
              end)

            if length(clip_missing) > 0 do
              formatted_missing =
                Enum.map(clip_missing, fn field ->
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

      # clips key exists but is not a list
      %{"clips" => _} ->
        {:error, ["clips must be an array"]}

      # Real-time detection format: {context_change, pending_clip} - valid response
      %{"context_change" => _} ->
        IO.puts("[OpenRouterAPI] AI returned real-time detection format (context_change) - valid")
        :ok

      _ ->
        {:error, ["clips array is missing"]}
    end
  end

  # Build field-specific guidance for missing fields
  defp build_field_guidance(missing_fields) do
    field_guidance =
      Enum.map(missing_fields, fn field ->
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
            - Number from 0-100 (weighted composite score)
            - **Hook Power (30%)**: Does the first 1-2 seconds STOP THE SCROLL? No hook = cap at 40.
            - **Emotional Arousal (25%)**: High-arousal only (anger, awe, humor, outrage, surprise, cringe). Monotone/calm = low.
            - **Shareability (20%)**: Would someone send this to a friend? Quotable, meme-worthy, debate-starting.
            - **Retention Curve (15%)**: Does tension escalate? Open loops? Satisfying payoff? Dead spots = -15 penalty.
            - **Platform Fit (10%)**: Duration sweet spots, works on mute with captions, energy matches format.
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

          "compact_valid_json" ->
            """
            **compact valid JSON (REQUIRED):**
            - Return ONLY a single JSON object: {"clips":[...]}
            - Do not use markdown fences or commentary.
            - Return at most 4 clips for this retry.
            - Keep "reason", "combined_transcript", and "socialMediaPost" concise so the response does not truncate.
            - Every clip object must be complete and include all required fields.
            """

          _ ->
            "**#{field} (REQUIRED):** Please ensure this field is included and properly formatted."
        end
      end)

    Enum.join(field_guidance, "\n\n")
  end

  @doc """
  Generate clips using a specific model.
  Returns {:ok, ai_response, usage} or {:error, reason}.
  """
  def generate_clips_with_model(
        transcript,
        system_prompt,
        user_prompt_input,
        model,
        project_id \\ nil
      ) do
    IO.puts("[OpenRouterAPI] Starting clip generation with model: #{model}")

    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY environment variable not set"}
    else
      generate_clips_with_model_retry(
        transcript,
        system_prompt,
        user_prompt_input,
        model,
        api_key,
        0,
        [],
        project_id
      )
    end
  rescue
    reason ->
      IO.puts("[OpenRouterAPI] Rescue error in generate_clips_with_model: #{inspect(reason)}")
      {:error, "Exception: #{inspect(reason)}"}
  end

  defp generate_clips_with_model_retry(
         transcript,
         system_prompt,
         user_prompt_input,
         model,
         api_key,
         attempt,
         missing_fields,
         project_id
       ) do
    max_attempts = 3

    IO.puts("[OpenRouterAPI] Model #{model} - Attempt #{attempt + 1}/#{max_attempts}")

    user_prompt = build_user_prompt(transcript, user_prompt_input, attempt)

    # Build payload - use chat completions API for broader model compatibility
    payload = build_chat_payload(model, system_prompt, user_prompt, missing_fields)

    json_payload = Jason.encode!(payload)
    options = [recv_timeout: @full_vod_recv_timeout_ms, timeout: @full_vod_recv_timeout_ms]

    case HTTPoison.post(@chat_completions_url, json_payload, build_headers(api_key), options) do
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

                    generate_clips_with_model_retry(
                      transcript,
                      system_prompt,
                      user_prompt_input,
                      model,
                      api_key,
                      attempt + 1,
                      new_missing_fields,
                      project_id
                    )

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

          generate_clips_with_model_retry(
            transcript,
            system_prompt,
            user_prompt_input,
            model,
            api_key,
            attempt + 1,
            missing_fields,
            project_id
          )
        else
          {:error, "Server error #{status_code}: #{String.slice(body, 0, 200)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        {:error, "API error #{status_code}: #{String.slice(body, 0, 200)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        if attempt < max_attempts - 1 do
          :timer.sleep(2000 * (attempt + 1))

          generate_clips_with_model_retry(
            transcript,
            system_prompt,
            user_prompt_input,
            model,
            api_key,
            attempt + 1,
            missing_fields,
            project_id
          )
        else
          {:error, "Network error: #{inspect(reason)}"}
        end
    end
  end

  defp generate_clips_enhanced_retry(
         transcript,
         video_base64,
         system_prompt,
         user_prompt_input,
         model,
         api_key,
         attempt,
         missing_fields,
         project_id,
         chunk_start_time,
         chunk_end_time
       ) do
    max_attempts = 3

    user_text =
      build_enhanced_user_text(
        transcript,
        user_prompt_input,
        attempt,
        chunk_start_time,
        chunk_end_time
      )

    payload =
      build_enhanced_chat_payload(
        model,
        system_prompt,
        user_text,
        video_base64,
        missing_fields
      )

    json_payload = Jason.encode!(payload)

    options = [
      recv_timeout: @enhanced_vod_recv_timeout_ms,
      timeout: @enhanced_vod_recv_timeout_ms
    ]

    case HTTPoison.post(@chat_completions_url, json_payload, build_headers(api_key), options) do
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
                    IO.puts("[OpenRouterAPI] Enhanced validation failed, retrying...")
                    :timer.sleep(1000)

                    generate_clips_enhanced_retry(
                      transcript,
                      video_base64,
                      system_prompt,
                      user_prompt_input,
                      model,
                      api_key,
                      attempt + 1,
                      new_missing_fields,
                      project_id,
                      chunk_start_time,
                      chunk_end_time
                    )

                  {:error, new_missing_fields} ->
                    {:error, "Missing required fields: #{inspect(new_missing_fields)}"}
                end

              {:error, reason} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, "JSON decode failed: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        {:error, "Enhanced API error #{status_code}: #{String.slice(body, 0, 500)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Enhanced network error: #{inspect(reason)}"}
    end
  end

  defp build_enhanced_user_text(
         transcript,
         user_prompt,
         attempt,
         chunk_start_time,
         chunk_end_time
       ) do
    transcript_json = Jason.encode!(transcript)

    retry_message =
      if attempt > 0 do
        """

        **RETRY NOTICE:** Previous response was missing required fields. Include ALL required fields, especially socialMediaPost for each clip.
        """
      else
        ""
      end

    timing_context =
      if chunk_end_time > chunk_start_time do
        """

        **VIDEO SEGMENT:** This video covers #{Float.round(chunk_start_time, 2)}s to #{Float.round(chunk_end_time, 2)}s of the full VOD.
        All clip timestamps MUST use absolute seconds from the full video (same timebase as the transcript).
        """
      else
        ""
      end

    """
    **USER INSTRUCTIONS:**

    #{user_prompt}
    #{timing_context}

    **TRANSCRIPT (same time range as the attached video):**

    #{transcript_json}

    Watch the attached video, listen to its audio, and read the transcript together.
    Detect viral clips according to the user instructions and system prompt.#{retry_message}

    Return compact valid JSON only. Keep titles, reasons, transcripts, and social captions concise.
    """
  end

  defp build_enhanced_chat_payload(model, system_prompt, user_text, video_base64, missing_fields) do
    video_uri = "data:video/mp4;base64,#{video_base64}"

    %{
      "model" => model,
      "messages" => [
        %{
          "role" => "system",
          "content" => missing_fields_prompt(system_prompt, missing_fields)
        },
        %{
          "role" => "user",
          "content" => [
            %{
              "type" => "video_url",
              "video_url" => %{"url" => video_uri}
            },
            %{
              "type" => "text",
              "text" => user_text
            }
          ]
        }
      ],
      "max_tokens" => @clip_output_max_tokens,
      "temperature" => 0.7
    }
    |> maybe_add_gemini_reasoning(model)
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
      "max_tokens" => @clip_output_max_tokens,
      "temperature" => 0.7
    }
    |> maybe_add_gemini_reasoning(model)
  end

  defp maybe_add_gemini_reasoning(payload, model) when is_binary(model) do
    if String.starts_with?(model, "google/gemini") do
      Map.put(payload, "reasoning", %{"effort" => "low"})
    else
      payload
    end
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
