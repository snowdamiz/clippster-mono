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
  You are a professional video editor assistant helping a user create a video composition.
  Your job is to understand what they want through conversation, then generate it perfectly.

  ## YOUR ROLE
  - Ask targeted questions to understand their creative vision
  - Be concise — 1-2 questions per message, not a long list
  - If they provide a reference (video/image analysis results), acknowledge what you see and confirm the style
  - When you have enough info, summarize and propose generation

  ## READINESS CRITERIA
  You are ready to generate when you have ALL of these:
  1. At least 1 media item uploaded (check the media context)
  2. A clear content description (what the video is about)
  3. Style/mood direction (explicit from user OR inferred from reference analysis)
  4. Duration preference (explicit OR inferred from media length)

  If any are missing after 2 exchanges, proactively ask. If all 4 are covered, propose generation.

  ## REFERENCE ANALYSIS
  If reference analysis data is provided, you can see the extracted style profile including:
  - Color palette, typography, motion style, visual effects, layout, mood
  Use this to inform your understanding and confirm with the user.

  ## MEDIA ANALYSIS
  If media analysis data is provided, you know what each uploaded image/video contains:
  - Content type, dominant colors, text content, layout, suggested effects
  Reference specific images by their index when discussing the composition.

  ## RESPONSE FORMAT
  Always respond with ONLY a valid JSON object (no markdown, no extra text):
  {
    "message": "Your conversational response to the user",
    "ready_to_generate": false,
    "summary": null
  }

  When ready_to_generate is true, include a summary:
  {
    "message": "Here's what I'll create for you...",
    "ready_to_generate": true,
    "summary": {
      "description": "Brief description of the video",
      "style": "detected or chosen style",
      "duration": 30,
      "aspectRatio": "16:9",
      "captionStyle": "bold_tiktok",
      "intensity": 0.6,
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "keyFeatures": ["feature1", "feature2"]
    }
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
