defmodule ClippsterServer.AI.ChatComposer do
  @moduledoc """
  Multi-turn conversational AI for video composition generation.
  Manages discovery chat, readiness detection, prompt building, and refinement.
  """

  require Logger

  alias ClippsterServer.AI.ChatSessions

  @openrouter_url "https://openrouter.ai/api/v1/chat/completions"
  @chat_model "anthropic/claude-sonnet-4"
  @max_retries 2
  @valid_aspect_ratios ~w(16:9 9:16 1:1 4:5)

  @discovery_system_prompt """
  You are a professional AI video editor assistant. Your job is to deeply understand the user's creative intent, co-create a concrete scene plan, and only trigger generation after clear approval.

  ## CONVERSATION STYLE (CRITICAL)
  - Be warm, concise, and conversational.
  - Ask exactly ONE focused question per response (unless the user asks for a full plan right now).
  - Never stack multiple questions in one message.
  - Briefly acknowledge what the user said before your next question.
  - Avoid interrogation/checklist tone.

  ## DISCOVERY FLOW
  Use this flow, but skip steps that are already answered:

  ### Phase 1 - Goal and audience (1-2 turns)
  - Purpose, audience, distribution platforms, and desired tone.

  ### Phase 2 - Message depth (1-2 turns)
  Understand the content deeply before planning scenes:
  - Core problem/pain the video addresses.
  - Key differentiators and why this is compelling now.
  - Proof points or outcomes (what makes claims credible).
  - Desired viewer action (CTA).
  - Required copy/text that must appear.

  ### Phase 3 - Visual direction (1-2 turns)
  - Look/feel, color direction, effects intensity, caption style.
  - If reference analysis exists, reflect concrete style choices from it.
  - If media analysis exists, reference specific uploaded files by filename.

  ### Phase 4 - Scene plan (1-3 turns)
  Propose a numbered scene-by-scene breakdown:
  - Reference uploaded media by filename.
  - For each scene include: description, mediaNames, duration, mood, textOverlay (if any), effects.
  - Let the user revise until approved.

  ### Phase 5 - Final confirmation
  Present final summary + scene plan and ask for approval.
  If the user says "looks good", "this is good", "approved", "yes", or equivalent after seeing the plan, treat that as approval.

  ## ASPECT RATIO REQUIREMENT (MANDATORY BEFORE READY)
  You must resolve aspect ratio before ready_to_generate=true.
  Use only: "16:9", "9:16", "1:1", "4:5"

  If not explicitly given:
  - Infer and confirm when obvious:
    - TikTok, Instagram Reels, YouTube Shorts, X vertical posts -> "9:16"
    - YouTube standard video, website/product page/demo -> "16:9"
    - Instagram feed square -> "1:1"
  - If multiple platforms conflict, ask for ONE master aspect ratio.

  ## KEY RULES
  - Skip already-known info and move forward quickly.
  - If user is impatient ("just make it"), propose best-practice defaults with a full scene plan, then ask for one approval message.
  - Never set ready_to_generate=true without a scene plan and approval.
  - Scene durations should add up to target duration.
  - Do NOT ask the user to manually tag media to scenes. You must infer mapping from filenames/content and present the mapping yourself.
  - If critical media is missing for key scenes, ask for it and include structured media_request metadata.

  ## REFERENCE ANALYSIS
  If reference analysis data is provided, you can see the extracted style profile including:
  - Color palette, typography, motion style, visual effects, layout, mood
  Use this to inform your style recommendations in Phase 3 and effects choices in Phase 4.

  ## MEDIA ANALYSIS
  If media analysis data is provided, you know what each uploaded image/video contains:
  - Content type, dominant colors, text content, layout, suggested effects
  Reference specific media items by filename when building the scene plan.

  ## RESPONSE FORMAT
  Always respond with ONLY a valid JSON object (no markdown, no extra text):
  {
    "message": "Your conversational response to the user",
    "ready_to_generate": false,
    "summary": null,
    "media_request": null
  }

  ## MEDIA REQUEST FORMAT
  Use media_request when you need the user to upload/select media before continuing:
  {
    "message": "To finish the hook and proof scenes I need product demo footage and a testimonial clip.",
    "ready_to_generate": false,
    "summary": null,
    "media_request": {
      "prompt": "Please upload/select media for the missing sections.",
      "required": true,
      "parts": ["Hook", "Proof"],
      "accepted_types": ["video", "image"]
    }
  }

  Rules:
  - parts must be short labels of missing sections.
  - accepted_types must be any of: "video", "audio", "image".
  - Set media_request to null when no media upload/selection is needed.
  - Never return ready_to_generate=true while also requesting required media.

  When ready_to_generate is true:
  - summary MUST include: description, style, duration, aspectRatio, scenes
  - scenes MUST contain at least one scene
  - The "style" field MUST be one of these presets:
  "hype", "professional", "gaming", "cinematic", "tutorial", "vlog", "music_video", "product"
  Pick the best match based on the conversation. Default to "product" if unsure.

  The "platform" field should be one of: "tiktok", "youtube", "youtube_shorts", "instagram_reels", "instagram_feed", "linkedin", "website", "general"

  {
    "message": "Here's the final plan! I'll create...",
    "ready_to_generate": true,
    "media_request": null,
    "summary": {
      "description": "Brief description of the video",
      "style": "product",
      "duration": 30,
      "aspectRatio": "16:9",
      "captionStyle": "bold_tiktok",
      "intensity": 0.7,
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "keyFeatures": ["feature1", "feature2"],
      "audience": "target audience description",
      "platform": "instagram_reels",
      "narrative": "hook → problem → solution → CTA",
      "scenes": [
        {
          "index": 0,
          "description": "Opening hook — bold title over product hero image",
          "mediaNames": ["product-hero.png"],
          "duration": 5,
          "mood": "energetic",
          "textOverlay": "Stop Wasting Time",
          "effects": "heroGradientText, punchZoom"
        }
      ]
    }
  }

  All fields except "description", "style", "duration", "aspectRatio", and "scenes" are optional in the summary.
  The "scenes" array is the most important part — it's the plan the user approved.
  """

  @refinement_system_prompt """
  You are a professional video editor assistant. The user has a generated video composition and wants to refine it.

  ## CONVERSATION STYLE (CRITICAL)
  - Be warm, concise, and conversational
  - Ask clarifying questions when the request is vague
  - Explore their creative intent before applying changes
  - If they ask for something specific and clear, you can apply it directly
  - If they're exploring ideas, have a conversation to understand what they want

  ## REFINEMENT FLOW
  1. **Understand the request**: What specifically do they want to change?
  2. **Clarify if needed**: If vague ("make it better", "change the vibe"), ask:
     - What specifically isn't working?
     - What mood/style are they going for?
     - Which scenes need the most attention?
  3. **Propose specific changes**: Before applying, describe what you'll do
  4. **Apply when clear**: Set apply_changes=true only when you have a concrete plan

  ## EXAMPLES

  **User: "Make it more energetic"**
  Response: Ask which scenes feel too slow, what kind of energy (fast cuts? more effects? different music?)
  apply_changes: false

  **User: "Change the text in scene 2 to say 'Get Started Today'"**
  Response: Confirm you'll update scene 2 text
  apply_changes: true

  **User: "The colors are off"**
  Response: Ask what color palette they're envisioning, which scenes feel wrong
  apply_changes: false

  **User: "Add more transitions between scenes"**
  Response: Confirm you'll add smooth transitions (fade/zoom/glitch) between all scenes
  apply_changes: true

  ## RESPONSE FORMAT
  Always respond with ONLY a valid JSON object:
  {
    "message": "Your conversational response",
    "apply_changes": true,
    "change_description": "Concise description of changes to apply"
  }

  Set apply_changes to true when you have a clear, specific plan to execute.
  Set apply_changes to false when you need more information or are exploring ideas together.
  """

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Process a user message in the discovery phase.
  Returns {:ok, %{response: parsed_json, message: saved_message}} or {:error, reason}
  """
  def chat(session, user_message, api_key) do
    if is_nil(api_key) or api_key == "" do
      Logger.error("[ChatComposer] OpenRouter API key is missing")
      {:error, "OpenRouter API key not configured"}
    else
      chat_with_api(session, user_message, api_key)
    end
  end

  defp chat_with_api(session, user_message, api_key) do
    history = ChatSessions.build_conversation_history(session.id)

    # Build context from session state
    context = build_chat_context(session)

    system_prompt = @discovery_system_prompt <> context

    messages = [
      %{"role" => "system", "content" => system_prompt}
      | history ++ [%{"role" => "user", "content" => user_message}]
    ]

    case call_openrouter(messages, api_key) do
      {:ok, content} ->
        case parse_chat_response(content) do
          {:ok, parsed} ->
            parsed = normalize_chat_response(parsed)

            # Save AI response as a message
            {:ok, ai_message} =
              ChatSessions.create_message(
                session.id,
                "assistant",
                Map.get(parsed, "message", content),
                %{
                  "ready_to_generate" => Map.get(parsed, "ready_to_generate", false),
                  "summary" => Map.get(parsed, "summary"),
                  "media_request" => Map.get(parsed, "media_request")
                }
              )

            # Update style context if summary is present
            if summary = Map.get(parsed, "summary") do
              ChatSessions.update_session(session, %{style_context: summary})
            end

            {:ok, %{response: parsed, message: ai_message}}

          {:error, _reason} ->
            # AI returned non-JSON, wrap it
            {:ok, ai_message} =
              ChatSessions.create_message(
                session.id,
                "assistant",
                content,
                nil
              )

            {:ok,
             %{
               response: %{
                 "message" => content,
                 "ready_to_generate" => false,
                 "summary" => nil,
                 "media_request" => nil
               },
               message: ai_message
             }}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Process a refinement message.
  Returns {:ok, %{response: parsed_json, message: saved_message}} or {:error, reason}
  """
  def refine(session, user_message, api_key) do
    history = ChatSessions.build_conversation_history(session.id)

    # Build rich context like discovery chat
    context = build_chat_context(session)
    
    composition_context =
      if session.composition do
        "\n\n## CURRENT COMPOSITION\n#{Jason.encode!(session.composition, pretty: true)}"
      else
        ""
      end

    system_prompt = @refinement_system_prompt <> context <> composition_context

    messages = [
      %{"role" => "system", "content" => system_prompt}
      | history ++ [%{"role" => "user", "content" => user_message}]
    ]

    case call_openrouter(messages, api_key) do
      {:ok, content} ->
        case parse_refinement_response(content) do
          {:ok, parsed} ->
            {:ok, ai_message} =
              ChatSessions.create_message(
                session.id,
                "assistant",
                Map.get(parsed, "message", content),
                %{
                  "apply_changes" => Map.get(parsed, "apply_changes", false),
                  "change_description" => Map.get(parsed, "change_description")
                }
              )

            {:ok, %{response: parsed, message: ai_message}}

          {:error, _reason} ->
            {:ok, ai_message} =
              ChatSessions.create_message(
                session.id,
                "assistant",
                content,
                nil
              )

            {:ok,
             %{
               response: %{
                 "message" => content,
                 "apply_changes" => false,
                 "change_description" => nil
               },
               message: ai_message
             }}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Build a rich generation prompt from the chat session context.
  This is passed to VideoComposer.generate_streamed as the prompt.
  """
  def build_generation_prompt(session) do
    messages = ChatSessions.list_messages(session.id)

    last_summary =
      messages
      |> Enum.filter(fn m ->
        m.role == "assistant" && m.metadata && Map.get(m.metadata, "summary")
      end)
      |> List.last()

    summary = if last_summary, do: last_summary.metadata["summary"], else: nil

    media_part_intent =
      if session.media_items && is_list(session.media_items) && length(session.media_items) > 0 do
        lines =
          session.media_items
          |> Enum.map(fn item ->
            name = Map.get(item, "name", "Untitled")

            parts =
              Map.get(item, "intendedParts") || Map.get(item, "intended_parts") || []

            part_list =
              parts
              |> List.wrap()
              |> Enum.filter(&is_binary/1)
              |> Enum.map(&String.trim/1)
              |> Enum.reject(&(&1 == ""))

            if part_list == [] do
              nil
            else
              "- #{name}: #{Enum.join(part_list, ", ")}"
            end
          end)
          |> Enum.reject(&is_nil/1)

        if lines == [] do
          nil
        else
          "\n## Media Part Intent\n#{Enum.join(lines, "\n")}\nUse these tags when mapping media to scene sections."
        end
      else
        nil
      end

    parts =
      ["Create a video composition based on the following conversation context:"] ++
        if(session.style_context && map_size(session.style_context) > 0,
          do: ["\n## Style Direction\n#{Jason.encode!(session.style_context, pretty: true)}"],
          else: []
        ) ++
        if(session.reference_analysis,
          do: [
            "\n## Reference Style Profile (from analyzed reference video/image)\n#{Jason.encode!(session.reference_analysis, pretty: true)}\n\nIMPORTANT: Match this reference style as closely as possible — use the exact color palette, similar motion types, matching typography style, and equivalent pacing."
          ],
          else: []
        ) ++
        if(
          session.media_analysis && is_list(session.media_analysis) &&
            length(session.media_analysis) > 0,
          do: [
            "\n## Media Analysis (AI vision analysis of each uploaded image)\n#{Jason.encode!(session.media_analysis, pretty: true)}\n\nUse this analysis to order images intelligently, match effects to content, and use dominant colors from each image."
          ],
          else: []
        ) ++
        if(summary,
          do: ["\n## Generation Summary\n#{Jason.encode!(summary, pretty: true)}"],
          else: []
        ) ++
        if(media_part_intent, do: [media_part_intent], else: []) ++
        if(
          summary && is_list(Map.get(summary, "scenes")) &&
            length(Map.get(summary, "scenes", [])) > 0,
          do: [
            "\n## USER-APPROVED SCENE PLAN\nThe user reviewed and approved this scene-by-scene plan during discovery. Follow it exactly.\n#{Jason.encode!(Map.get(summary, "scenes"), pretty: true)}"
          ],
          else: []
        )

    Enum.join(parts, "\n")
  end

  @doc """
  Build a refinement prompt for modifying an existing composition.
  """
  def build_refinement_prompt(_session, change_description) do
    """
    Modify the existing video composition based on this request:

    #{change_description}

    Keep all existing tracks unless specifically asked to remove or change them.
    Apply the requested changes while maintaining the overall style and coherence.
    """
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp build_chat_context(session) do
    media_section =
      if session.media_items && is_list(session.media_items) && length(session.media_items) > 0 do
        media_summary =
          session.media_items
          |> Enum.with_index(1)
          |> Enum.map(fn {item, idx} ->
            name = Map.get(item, "name", "Untitled")
            type = Map.get(item, "type", "unknown")
            duration = Map.get(item, "duration")
            dur_str = if duration, do: " (#{Float.round(duration / 1, 1)}s)", else: ""

            part_tags =
              case Map.get(item, "intendedParts") || Map.get(item, "intended_parts") do
                tags when is_list(tags) and tags != [] ->
                  tag_list =
                    tags
                    |> Enum.filter(&is_binary/1)
                    |> Enum.map(&String.trim/1)
                    |> Enum.reject(&(&1 == ""))
                    |> Enum.join(", ")

                  if tag_list == "", do: "", else: " [intended parts: #{tag_list}]"

                _ ->
                  ""
              end

            "#{idx}. #{name} (#{type})#{dur_str}#{part_tags}"
          end)
          |> Enum.join("\n")

        "\n\n## Uploaded Media\n#{media_summary}"
      else
        "\n\n## Uploaded Media\nNo media uploaded yet."
      end

    parts =
      [media_section] ++
        if(session.reference_analysis,
          do: [
            "\n\n## Reference Style Analysis\n#{Jason.encode!(session.reference_analysis, pretty: true)}"
          ],
          else: []
        ) ++
        if(
          session.media_analysis && is_list(session.media_analysis) &&
            length(session.media_analysis) > 0,
          do: [
            "\n\n## Media Image Analysis\n#{Jason.encode!(session.media_analysis, pretty: true)}"
          ],
          else: []
        )

    Enum.join(parts)
  end

  defp normalize_chat_response(parsed) when is_map(parsed) do
    normalized =
      parsed
      |> Map.put("media_request", normalize_media_request(Map.get(parsed, "media_request")))

    ready? = Map.get(normalized, "ready_to_generate", false)
    summary = Map.get(normalized, "summary")

    normalized =
      if ready? and not valid_generation_summary?(summary) do
        Logger.warning(
          "[ChatComposer] ready_to_generate=true without required summary fields; forcing false"
        )

        Map.put(normalized, "ready_to_generate", false)
      else
        normalized
      end

    if Map.get(normalized, "ready_to_generate", false) do
      Map.put(normalized, "media_request", nil)
    else
      normalized
    end
  end

  defp normalize_chat_response(parsed), do: parsed

  defp valid_generation_summary?(%{} = summary) do
    aspect_ratio = Map.get(summary, "aspectRatio")
    scenes = Map.get(summary, "scenes")

    present_string?(Map.get(summary, "description")) and
      present_string?(Map.get(summary, "style")) and
      positive_number?(Map.get(summary, "duration")) and
      aspect_ratio in @valid_aspect_ratios and
      is_list(scenes) and
      length(scenes) > 0
  end

  defp valid_generation_summary?(_), do: false

  defp present_string?(value) when is_binary(value), do: String.trim(value) != ""
  defp present_string?(_), do: false

  defp positive_number?(value) when is_integer(value), do: value > 0
  defp positive_number?(value) when is_float(value), do: value > 0.0
  defp positive_number?(_), do: false

  defp normalize_media_request(nil), do: nil

  defp normalize_media_request(%{} = media_request) do
    prompt =
      case Map.get(media_request, "prompt") do
        value when is_binary(value) -> String.trim(value)
        _ -> ""
      end

    required = Map.get(media_request, "required", false) == true

    parts =
      case Map.get(media_request, "parts") do
        values when is_list(values) ->
          values
          |> Enum.filter(&is_binary/1)
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))
          |> Enum.uniq()

        _ ->
          []
      end

    accepted_types =
      case Map.get(media_request, "accepted_types") do
        values when is_list(values) ->
          values
          |> Enum.filter(&is_binary/1)
          |> Enum.map(&String.downcase/1)
          |> Enum.filter(&(&1 in ["video", "audio", "image"]))
          |> Enum.uniq()

        _ ->
          []
      end

    if prompt == "" and parts == [] and accepted_types == [] and not required do
      nil
    else
      %{
        "prompt" =>
          if(prompt == "",
            do: "Please upload or select media for the missing sections.",
            else: prompt
          ),
        "required" => required,
        "parts" => parts,
        "accepted_types" => accepted_types
      }
    end
  end

  defp normalize_media_request(_), do: nil

  defp parse_chat_response(content) do
    # Log the raw AI response for debugging
    Logger.info("[ChatComposer] Raw AI response: #{inspect(content)}")

    # Try to extract JSON from the response
    cleaned = extract_json_object(content)
    Logger.info("[ChatComposer] Extracted JSON: #{inspect(cleaned)}")

    case Jason.decode(cleaned) do
      {:ok, %{"message" => _} = parsed} ->
        Logger.info("[ChatComposer] Parsed response: #{inspect(parsed)}")
        {:ok, parsed}

      {:ok, _} ->
        Logger.warning("[ChatComposer] Response missing 'message' field: #{inspect(cleaned)}")
        {:error, "Response missing 'message' field"}

      {:error, reason} ->
        Logger.warning("[ChatComposer] Failed to parse chat response as JSON: #{inspect(reason)}")
        {:error, "Invalid JSON response"}
    end
  end

  defp parse_refinement_response(content) do
    cleaned = extract_json_object(content)

    case Jason.decode(cleaned) do
      {:ok, %{"message" => _} = parsed} ->
        {:ok, parsed}

      {:ok, _} ->
        {:error, "Response missing 'message' field"}

      {:error, reason} ->
        Logger.warning(
          "[ChatComposer] Failed to parse refinement response as JSON: #{inspect(reason)}"
        )

        {:error, "Invalid JSON response"}
    end
  end

  defp extract_json_object(content) do
    # Try markdown code block first
    case Regex.run(~r/```(?:json)?\s*(\{.*\})\s*```/s, content) do
      [_, json] ->
        json

      _ ->
        # Find first { and match braces
        case String.split(content, "{", parts: 2) do
          [_, rest] -> extract_with_brace_counting("{" <> rest)
          _ -> content
        end
    end
  end

  defp extract_with_brace_counting(content) do
    content
    |> String.graphemes()
    |> Enum.reduce_while({0, false, false, []}, fn char, {depth, in_string, escaped, acc} ->
      new_acc = [char | acc]

      cond do
        escaped ->
          {:cont, {depth, in_string, false, new_acc}}

        char == "\\" and in_string ->
          {:cont, {depth, in_string, true, new_acc}}

        char == "\"" ->
          {:cont, {depth, !in_string, false, new_acc}}

        in_string ->
          {:cont, {depth, in_string, false, new_acc}}

        char == "{" ->
          {:cont, {depth + 1, in_string, false, new_acc}}

        char == "}" ->
          new_depth = depth - 1

          if new_depth == 0 do
            {:halt, {new_depth, in_string, false, new_acc}}
          else
            {:cont, {new_depth, in_string, false, new_acc}}
          end

        true ->
          {:cont, {depth, in_string, false, new_acc}}
      end
    end)
    |> elem(3)
    |> Enum.reverse()
    |> Enum.join()
  end

  defp call_openrouter(messages, api_key) do
    call_openrouter_with_retry(messages, api_key, 1)
  end

  defp call_openrouter_with_retry(messages, api_key, attempt) do
    payload = %{
      "model" => @chat_model,
      "messages" => messages,
      "max_tokens" => 4096,
      "temperature" => 0.6
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster AI Chat"}
    ]

    case HTTPoison.post(
           @openrouter_url,
           Jason.encode!(payload),
           headers,
           recv_timeout: 60_000
         ) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            content = get_in(response, ["choices", Access.at(0), "message", "content"])
            if content, do: {:ok, content}, else: {:error, "No content in response"}

          {:error, reason} ->
            {:error, "Failed to parse response: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}}
      when status in [429, 500, 502, 503, 529] ->
        if attempt < @max_retries do
          delay = :timer.seconds(attempt * 2)

          Logger.warning(
            "[ChatComposer] Attempt #{attempt}/#{@max_retries} failed: API error #{status}. Retrying in #{div(delay, 1000)}s..."
          )

          Process.sleep(delay)
          call_openrouter_with_retry(messages, api_key, attempt + 1)
        else
          {:error, "API error #{status}: #{String.slice(body, 0, 200)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "API error #{status}: #{String.slice(body, 0, 200)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        if attempt < @max_retries do
          delay = :timer.seconds(attempt * 2)
          Process.sleep(delay)
          call_openrouter_with_retry(messages, api_key, attempt + 1)
        else
          {:error, "Network error: #{inspect(reason)}"}
        end
    end
  end
end
