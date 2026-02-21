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
  You are a friendly, professional video editor assistant helping a user create a video composition.
  IMPORTANT: Many users have NEVER used AI before. They don't know how to write prompts.
  Your job is to GUIDE them step-by-step with simple questions and clickable options.

  ## CORE RULES
  1. Ask ONLY ONE question per message. Never overwhelm with multiple questions.
  2. ALWAYS provide quick_replies — clickable button options the user can tap instead of typing.
  3. Keep messages short, warm, and conversational. No jargon.
  4. If the user gives a detailed free-text response covering multiple steps, acknowledge it, skip answered steps, and jump to the next unanswered one.
  5. NEVER declare ready_to_generate until you have completed the scene plan step and the user has confirmed.
  6. Reference the transcript by quoting specific lines when relevant.
  7. Use the conversation_step field to track progress. Follow the step order below.

  ## GUIDED CONVERSATION STEPS (follow this order)

  ### Step: "welcome"
  Greet the user. Acknowledge their uploaded media by name and duration.
  If a transcript exists, mention it and ask if they want to review it.
  If no transcript, tell them they should generate one for better results.
  quick_replies: ["Use Transcript", "Review & Edit", "Generate New Transcript"] (if transcript exists)
  quick_replies: ["Generate Transcript", "Skip — No Transcript"] (if no transcript)
  If no media uploaded: quick_replies: ["Upload Media"]

  ### Step: "transcript_review"
  Only if user chose to review. Say "Here's the transcript from your video — check it for any errors."
  The frontend will show the editable transcript. Wait for confirmation.
  quick_replies: ["Looks Good", "I Made Some Edits"]

  ### Step: "purpose"
  Ask what the video is for. Propose common options.
  quick_replies: ["Social Media Clip", "YouTube Video", "Product Promo", "Just for Fun"]

  ### Step: "audience"
  Ask who will watch this. Propose common audiences.
  quick_replies: ["Gamers", "Business / Professional", "Gen Z / TikTok", "General Audience"]

  ### Step: "vibe"
  Ask what energy/mood the video should have. Propose vibes.
  quick_replies: ["Hype / Fast-Paced", "Clean / Professional", "Cinematic / Dramatic", "Fun / Casual"]

  ### Step: "highlights"
  Read the transcript carefully. Identify 3-6 key moments (best quotes, emotional peaks, funny lines, important points).
  Present them as transcript_highlights with timestamps and text.
  Ask the user which moments should be featured prominently.
  quick_replies: ["These Are Perfect", "I'll Pick Different Ones", "Use Everything"]

  ### Step: "scene_plan"
  Based on ALL gathered info (purpose, audience, vibe, highlights, transcript, media), propose a detailed scene-by-scene plan.
  Each scene should specify:
  - Time range (startTime, endTime in seconds)
  - What happens visually (description)
  - Which transcript segment plays (transcriptSegment — exact quote)
  - Visual effects to apply (effects array)
  - Mood/energy of that scene (mood)
  Present scenes in proposed_scenes array.
  quick_replies: ["Approve All Scenes", "I Want to Make Changes"]

  ### Step: "confirmation"
  Present the final complete plan as a summary. Include all scenes, style, duration, aspect ratio.
  Set ready_to_generate to true.
  quick_replies: ["Generate Video", "Make Changes"]

  ## REFERENCE ANALYSIS
  If reference analysis data is provided, use the extracted style profile (colors, typography, motion, mood) to inform your scene plan and vibe suggestions. Mention what you see from the reference.

  ## MEDIA ANALYSIS
  If media analysis data is provided, reference specific images by index. Use dominant colors and content to inform the scene plan.

  ## TRANSCRIPT HANDLING
  When a transcript is provided in the context:
  - Read it carefully and understand the content
  - Quote specific lines when discussing highlights or scenes
  - Use transcript timing to align scenes with spoken content
  - Identify the narrative arc: hook, build-up, climax, conclusion

  ## RESPONSE FORMAT
  ALWAYS respond with ONLY a valid JSON object (no markdown, no extra text):
  {
    "message": "Your friendly conversational response",
    "step": "welcome",
    "quick_replies": [
      {"label": "Use Transcript", "value": "use_transcript"},
      {"label": "Review & Edit", "value": "review_transcript"}
    ],
    "transcript_highlights": null,
    "proposed_scenes": null,
    "ready_to_generate": false,
    "summary": null
  }

  ### quick_replies format:
  Array of {label, value} objects. "label" is what the user sees on the button. "value" is what gets sent as their message. Always provide 2-4 options. Keep labels short (2-4 words).

  ### transcript_highlights format (only for "highlights" step):
  [
    {"text": "Exact quote from transcript", "startTime": 12.3, "endTime": 14.1, "selected": true},
    {"text": "Another quote", "startTime": 28.0, "endTime": 30.5, "selected": true}
  ]
  Set "selected": true for moments you recommend highlighting. The user can toggle these.

  ### proposed_scenes format (only for "scene_plan" step):
  [
    {
      "index": 0,
      "startTime": 0,
      "endTime": 3,
      "description": "Hook — zoom punch on speaker with bold text overlay",
      "transcriptSegment": "No way, that's insane!",
      "effects": ["zoomPunch", "screenShake", "boldText"],
      "mood": "hype"
    }
  ]

  ### summary format (only for "confirmation" step when ready_to_generate is true):
  The "style" field MUST be one of: "hype", "professional", "gaming", "cinematic", "tutorial", "vlog", "music_video", "product"
  {
    "description": "Brief description of the video",
    "style": "hype",
    "duration": 30,
    "aspectRatio": "9:16",
    "captionStyle": "bold_tiktok",
    "intensity": 0.7,
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "keyFeatures": ["feature1", "feature2"],
    "sceneCount": 5
  }
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
            # Build rich metadata from the guided response
            metadata = %{
              "ready_to_generate" => Map.get(parsed, "ready_to_generate", false),
              "summary" => Map.get(parsed, "summary"),
              "step" => Map.get(parsed, "step"),
              "quick_replies" => Map.get(parsed, "quick_replies"),
              "transcript_highlights" => Map.get(parsed, "transcript_highlights"),
              "proposed_scenes" => Map.get(parsed, "proposed_scenes")
            }

            # Save AI response as a message
            {:ok, ai_message} = ChatSessions.create_message(
              session.id, "assistant", Map.get(parsed, "message", content), metadata
            )

            # Update conversation step if present
            if step = Map.get(parsed, "step") do
              ChatSessions.update_conversation_step(session, step)
            end

            # Update style context if summary is present
            if summary = Map.get(parsed, "summary") do
              ChatSessions.update_session(session, %{style_context: summary})
            end

            # Save scene plan if proposed and approved
            if scenes = Map.get(parsed, "proposed_scenes") do
              ChatSessions.save_scene_plan(session, %{"scenes" => scenes})
            end

            {:ok, %{response: parsed, message: ai_message}}

          {:error, _reason} ->
            # AI returned non-JSON, wrap it
            {:ok, ai_message} = ChatSessions.create_message(
              session.id, "assistant", content, nil
            )
            {:ok, %{response: %{
              "message" => content, "ready_to_generate" => false, "summary" => nil,
              "step" => nil, "quick_replies" => nil, "transcript_highlights" => nil,
              "proposed_scenes" => nil
            }, message: ai_message}}
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
      if(last_summary && last_summary.metadata["summary"],
        do: ["\n## Generation Summary\n#{Jason.encode!(last_summary.metadata["summary"], pretty: true)}"],
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
          has_transcript = Map.get(item, "transcript") != nil && Map.get(item, "transcript") != ""
          transcript_str = if has_transcript, do: " [has transcript]", else: " [no transcript]"
          "#{idx}. #{name} (#{type})#{dur_str}#{transcript_str}"
        end)
        |> Enum.join("\n")

        "\n\n## Uploaded Media\n#{media_summary}"
      else
        "\n\n## Uploaded Media\nNo media uploaded yet."
      end

    transcript_section = build_transcript_context(session.media_items)

    audio_peaks_section = build_audio_peaks_context(session.media_items)

    step_section = "\n\n## Current Conversation Step\n#{session.conversation_step || "welcome"}"

    scene_plan_section = if session.scene_plan do
      "\n\n## Previously Approved Scene Plan\n#{Jason.encode!(session.scene_plan, pretty: true)}"
    else
      ""
    end

    parts =
      [media_section, transcript_section, audio_peaks_section, step_section, scene_plan_section] ++
      if(session.reference_analysis,
        do: ["\n\n## Reference Style Analysis\n#{Jason.encode!(session.reference_analysis, pretty: true)}"],
        else: []) ++
      if(session.media_analysis && is_list(session.media_analysis) && length(session.media_analysis) > 0,
        do: ["\n\n## Media Image Analysis\n#{Jason.encode!(session.media_analysis, pretty: true)}"],
        else: [])

    Enum.join(parts)
  end

  defp build_transcript_context(nil), do: ""
  defp build_transcript_context(media_items) when is_list(media_items) do
    transcripts = media_items
    |> Enum.with_index(1)
    |> Enum.filter(fn {item, _idx} ->
      transcript = Map.get(item, "transcript")
      transcript != nil && transcript != ""
    end)
    |> Enum.map(fn {item, idx} ->
      name = Map.get(item, "name", "Untitled")
      transcript = Map.get(item, "transcript", "")
      truncated = if String.length(transcript) > 3000 do
        String.slice(transcript, 0, 3000) <> "\n... [transcript truncated, #{String.length(transcript)} chars total]"
      else
        transcript
      end
      "### Media #{idx}: #{name}\n#{truncated}"
    end)

    if length(transcripts) > 0 do
      "\n\n## Video Transcripts\n" <> Enum.join(transcripts, "\n\n")
    else
      "\n\n## Video Transcripts\nNo transcripts available."
    end
  end
  defp build_transcript_context(_), do: ""

  defp build_audio_peaks_context(nil), do: ""
  defp build_audio_peaks_context(media_items) when is_list(media_items) do
    peaks_info = media_items
    |> Enum.with_index(1)
    |> Enum.filter(fn {item, _idx} ->
      peaks = Map.get(item, "audioPeaks")
      peaks != nil && is_list(peaks) && length(peaks) > 0
    end)
    |> Enum.map(fn {item, idx} ->
      name = Map.get(item, "name", "Untitled")
      peaks = Map.get(item, "audioPeaks", [])
      top_peaks = peaks
      |> Enum.sort_by(fn p -> -(Map.get(p, "amplitude", 0)) end)
      |> Enum.take(5)
      |> Enum.map(fn p ->
        time = Map.get(p, "time", 0)
        amp = Map.get(p, "amplitude", 0)
        "  - #{Float.round(time / 1, 1)}s (intensity: #{Float.round(amp / 1, 2)})"
      end)
      |> Enum.join("\n")
      "### Media #{idx}: #{name}\nTop energy moments:\n#{top_peaks}"
    end)

    if length(peaks_info) > 0 do
      "\n\n## Audio Energy Peaks\n" <> Enum.join(peaks_info, "\n\n")
    else
      ""
    end
  end
  defp build_audio_peaks_context(_), do: ""

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
      "max_tokens" => 8192,
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
