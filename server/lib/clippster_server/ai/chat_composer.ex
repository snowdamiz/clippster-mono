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

  @discovery_system_prompt """
  You are a professional AI video editor assistant. Your job is to deeply understand the user's creative vision through a multi-phase conversation, build a scene-by-scene plan together, and only trigger generation once they approve the plan.

  ## CONVERSATION PHASES
  Guide the user through these phases naturally. Ask 1-2 questions per message — be conversational, not robotic.

  ### Phase 1 — Big Picture (1-2 exchanges)
  Understand the fundamentals:
  - What is this video for? (social media ad, product demo, announcement, personal project, etc.)
  - Who is the audience? (customers, followers, investors, friends, etc.)
  - Where will it be posted? (TikTok, YouTube, Instagram Reels, LinkedIn, website, etc.)
  - What's the overall tone/vibe? (energetic, professional, playful, cinematic, etc.)

  ### Phase 2 — Content & Structure (1-2 exchanges)
  Dig into the story:
  - What are the key messages or selling points?
  - What story beats should the video follow? (hook → problem → solution → CTA, before/after, feature showcase, etc.)
  - What should the viewer feel or do after watching?
  - Any specific text/copy that must appear?

  ### Phase 3 — Visual Style (1-2 exchanges)
  Define the look and feel:
  - Look/feel preferences (minimalist, bold, neon, corporate, etc.)
  - Brand colors or color preferences
  - Effects intensity (subtle and clean vs. heavy motion graphics)
  - Caption style preference (bold TikTok, clean subtitle, neon glow, minimal, none)
  - If reference analysis data is available, propose specific choices based on the reference style
  - If media analysis data is available, reference what you see in each image/video and suggest how to use them

  ### Phase 4 — Scene-by-Scene Plan (1-3 exchanges)
  Propose a numbered scene breakdown:
  - Reference uploaded media items BY FILENAME when assigning them to scenes
  - For each scene specify: description, which media to use, approximate duration, mood, any text overlays, and suggested effects
  - The user can reorder scenes, add/remove scenes, change text, swap media, or approve as-is
  - Iterate until the user is happy with the plan

  ### Phase 5 — Confirm & Generate (1 exchange)
  Present a final summary with the complete scene plan and ask for explicit confirmation.
  Only set ready_to_generate to true AFTER the user approves the scene plan.

  ## KEY RULES
  - Ask only 1-2 questions per message. Be warm and conversational, not a checklist.
  - Skip phases if the user provides lots of info upfront. Adapt to what you already know.
  - If the user provides a reference (video/image analysis), acknowledge what you see and incorporate the style.
  - If media analysis data is available, reference specific images by filename when discussing scenes.
  - Handle impatient users: if they say "just make it", "go ahead", or similar, propose quick defaults WITH a scene plan and ask for one quick confirmation before generating.
  - NEVER set ready_to_generate to true without proposing a scene plan first (even a quick auto-generated one).
  - When proposing the scene plan, use the actual filenames from uploaded media.
  - Total scene durations must add up to the target video duration.

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
    "summary": null
  }

  When ready_to_generate is true, include a full summary with scenes. The "style" field MUST be one of these presets:
  "hype", "professional", "gaming", "cinematic", "tutorial", "vlog", "music_video", "product"
  Pick the best match based on the conversation. Default to "product" if unsure.

  The "platform" field should be one of: "tiktok", "youtube", "youtube_shorts", "instagram_reels", "instagram_feed", "linkedin", "website", "general"

  {
    "message": "Here's the final plan! I'll create...",
    "ready_to_generate": true,
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

  All fields except "description", "style", and "duration" are optional in the summary.
  The "scenes" array is the most important part — it's the plan the user approved.
  """

  @refinement_system_prompt """
  You are a professional video editor assistant. The user has a generated video composition and wants changes.

  ## YOUR ROLE
  - Listen to their feedback carefully
  - Be specific about what you'll change
  - Confirm understanding before applying changes
  - Keep responses concise

  ## RESPONSE FORMAT
  Always respond with ONLY a valid JSON object:
  {
    "message": "Your response about the changes",
    "apply_changes": true,
    "change_description": "Concise description of changes to apply"
  }

  Set apply_changes to true when you understand the request and are ready to modify the composition.
  Set apply_changes to false if you need clarification first.
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
            # Save AI response as a message
            {:ok, ai_message} = ChatSessions.create_message(
              session.id, "assistant", Map.get(parsed, "message", content),
              %{"ready_to_generate" => Map.get(parsed, "ready_to_generate", false),
                "summary" => Map.get(parsed, "summary")}
            )

            # Update style context if summary is present
            if summary = Map.get(parsed, "summary") do
              ChatSessions.update_session(session, %{style_context: summary})
            end

            {:ok, %{response: parsed, message: ai_message}}

          {:error, _reason} ->
            # AI returned non-JSON, wrap it
            {:ok, ai_message} = ChatSessions.create_message(
              session.id, "assistant", content, nil
            )
            {:ok, %{response: %{"message" => content, "ready_to_generate" => false, "summary" => nil}, message: ai_message}}
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

    composition_context = if session.composition do
      "\n\n## CURRENT COMPOSITION\n#{Jason.encode!(session.composition, pretty: true)}"
    else
      ""
    end

    system_prompt = @refinement_system_prompt <> composition_context

    messages = [
      %{"role" => "system", "content" => system_prompt}
      | history ++ [%{"role" => "user", "content" => user_message}]
    ]

    case call_openrouter(messages, api_key) do
      {:ok, content} ->
        case parse_refinement_response(content) do
          {:ok, parsed} ->
            {:ok, ai_message} = ChatSessions.create_message(
              session.id, "assistant", Map.get(parsed, "message", content),
              %{"apply_changes" => Map.get(parsed, "apply_changes", false),
                "change_description" => Map.get(parsed, "change_description")}
            )
            {:ok, %{response: parsed, message: ai_message}}

          {:error, _reason} ->
            {:ok, ai_message} = ChatSessions.create_message(
              session.id, "assistant", content, nil
            )
            {:ok, %{response: %{"message" => content, "apply_changes" => false, "change_description" => nil}, message: ai_message}}
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
    last_summary = messages
    |> Enum.filter(fn m -> m.role == "assistant" && m.metadata && Map.get(m.metadata, "summary") end)
    |> List.last()

    summary = if last_summary, do: last_summary.metadata["summary"], else: nil

    parts =
      ["Create a video composition based on the following conversation context:"] ++
      if(session.style_context && map_size(session.style_context) > 0,
        do: ["\n## Style Direction\n#{Jason.encode!(session.style_context, pretty: true)}"],
        else: []) ++
      if(session.reference_analysis,
        do: ["\n## Reference Style Profile (from analyzed reference video/image)\n#{Jason.encode!(session.reference_analysis, pretty: true)}\n\nIMPORTANT: Match this reference style as closely as possible — use the exact color palette, similar motion types, matching typography style, and equivalent pacing."],
        else: []) ++
      if(session.media_analysis && is_list(session.media_analysis) && length(session.media_analysis) > 0,
        do: ["\n## Media Analysis (AI vision analysis of each uploaded image)\n#{Jason.encode!(session.media_analysis, pretty: true)}\n\nUse this analysis to order images intelligently, match effects to content, and use dominant colors from each image."],
        else: []) ++
      if(summary,
        do: ["\n## Generation Summary\n#{Jason.encode!(summary, pretty: true)}"],
        else: []) ++
      if(summary && is_list(Map.get(summary, "scenes")) && length(Map.get(summary, "scenes", [])) > 0,
        do: ["\n## USER-APPROVED SCENE PLAN\nThe user reviewed and approved this scene-by-scene plan during discovery. Follow it exactly.\n#{Jason.encode!(Map.get(summary, "scenes"), pretty: true)}"],
        else: [])

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
        media_summary = session.media_items
        |> Enum.with_index(1)
        |> Enum.map(fn {item, idx} ->
          name = Map.get(item, "name", "Untitled")
          type = Map.get(item, "type", "unknown")
          duration = Map.get(item, "duration")
          dur_str = if duration, do: " (#{Float.round(duration / 1, 1)}s)", else: ""
          "#{idx}. #{name} (#{type})#{dur_str}"
        end)
        |> Enum.join("\n")

        "\n\n## Uploaded Media\n#{media_summary}"
      else
        "\n\n## Uploaded Media\nNo media uploaded yet."
      end

    parts =
      [media_section] ++
      if(session.reference_analysis,
        do: ["\n\n## Reference Style Analysis\n#{Jason.encode!(session.reference_analysis, pretty: true)}"],
        else: []) ++
      if(session.media_analysis && is_list(session.media_analysis) && length(session.media_analysis) > 0,
        do: ["\n\n## Media Image Analysis\n#{Jason.encode!(session.media_analysis, pretty: true)}"],
        else: [])

    Enum.join(parts)
  end

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
      {:ok, %{"message" => _} = parsed} -> {:ok, parsed}
      {:ok, _} -> {:error, "Response missing 'message' field"}
      {:error, reason} ->
        Logger.warning("[ChatComposer] Failed to parse refinement response as JSON: #{inspect(reason)}")
        {:error, "Invalid JSON response"}
    end
  end

  defp extract_json_object(content) do
    # Try markdown code block first
    case Regex.run(~r/```(?:json)?\s*(\{.*\})\s*```/s, content) do
      [_, json] -> json
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
        escaped -> {:cont, {depth, in_string, false, new_acc}}
        char == "\\" and in_string -> {:cont, {depth, in_string, true, new_acc}}
        char == "\"" -> {:cont, {depth, !in_string, false, new_acc}}
        in_string -> {:cont, {depth, in_string, false, new_acc}}
        char == "{" -> {:cont, {depth + 1, in_string, false, new_acc}}
        char == "}" ->
          new_depth = depth - 1
          if new_depth == 0 do
            {:halt, {new_depth, in_string, false, new_acc}}
          else
            {:cont, {new_depth, in_string, false, new_acc}}
          end
        true -> {:cont, {depth, in_string, false, new_acc}}
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

      {:ok, %HTTPoison.Response{status_code: status, body: body}} when status in [429, 500, 502, 503, 529] ->
        if attempt < @max_retries do
          delay = :timer.seconds(attempt * 2)
          Logger.warning("[ChatComposer] Attempt #{attempt}/#{@max_retries} failed: API error #{status}. Retrying in #{div(delay, 1000)}s...")
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
