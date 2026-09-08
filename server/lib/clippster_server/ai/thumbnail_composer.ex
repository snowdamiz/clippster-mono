defmodule ClippsterServer.AI.ThumbnailComposer do
  @moduledoc """
  Conversational discovery + image generation for AI Thumbnail Generator.

  Quick mode: finished flat PNG with baked hook text.
  Editable mode: plate image (NO baked text) + structured recipe for live layers.
  """

  require Logger

  alias ClippsterServer.AI.ThumbnailSessions
  alias ClippsterServer.Storage

  @chat_url "https://openrouter.ai/api/v1/chat/completions"
  @images_url "https://openrouter.ai/api/v1/images"
  @default_chat_model "anthropic/claude-sonnet-5"
  @default_image_model "openai/gpt-5.4-image-2"
  @default_vision_model "google/gemini-3.7-flash"
  @max_retries 2
  @plate_qa_max_attempts 2
  @valid_aspect_ratios ~w(16:9 9:16 1:1)

  @discovery_system_prompt """
  You are Clippster's AI Thumbnail Designer. Help creators plan a high-CTR YouTube-style thumbnail.

  ## CONVERSATION STYLE
  - Warm, concise, collaborative.
  - Ask exactly ONE focused question per response unless the user wants a full plan now.
  - Acknowledge what they said, then advance.

  ## DISCOVERY FLOW
  Skip steps already answered (including from transcript analysis / selected concepts / attached video):
  1. Video topic / goal and platform (YouTube, Shorts, etc.)
  2. Hook emotion (shock, curiosity, hype, humor) and focal subject (face, product, gameplay)
  3. Hook text (0–5 words) and optional CTA — text that ADDS to the title, never repeats it
  4. Layout preference (face left / text right, etc.) and color vibe (BOGY-friendly)
  5. Confirm canvas size (default 1280×720 / 16:9) and present a brief plan for approval

  ## KEY RULES
  - Prefer 16:9 at 1280×720 unless the user asks for Shorts (9:16) or square (1:1).
  - Hook text should be short, bold, curiosity-driving.
  - Never set ready_to_generate=true without a concrete plan and user approval.
  - If media/key frames, transcript, concepts, or a reference thumbnail are attached, use them in the plan.
  - If concepts from video analysis exist, offer to lock one or refine it instead of re-asking for topic.
  - If key frames are present, mention that "Generate variants from video" can produce multiple finished options.
  - generation_mode is set by the client (quick|editable). Reflect it in the summary but do not ask to change it unless the user brings it up.

  ## RESPONSE FORMAT
  Always respond with ONLY a valid JSON object:
  {
    "message": "Your conversational response",
    "ready_to_generate": false,
    "summary": null
  }

  When ready_to_generate is true:
  {
    "message": "Plan locked — ready to generate!",
    "ready_to_generate": true,
    "summary": {
      "description": "What the thumbnail should communicate",
      "hook_text": "NEVER AGAIN",
      "cta_text": null,
      "emotion": "shock",
      "focal_subject": "creator face + product",
      "layout": "face left, text right",
      "color_palette": ["#FF6B00", "#1E90FF", "#FFFFFF"],
      "aspect_ratio": "16:9",
      "canvas_width": 1280,
      "canvas_height": 720,
      "style_notes": "High contrast, thick stroke on hook text"
    }
  }
  """

  @refinement_system_prompt """
  You are refining an AI-generated thumbnail. Interpret the user's edit request.

  Respond with ONLY JSON:
  {
    "message": "Your reply",
    "apply_changes": true,
    "change_description": "Concise visual/text change to apply",
    "text_only": false
  }

  Set text_only=true when the change is only about hook/CTA copy (Editable mode can update recipe text layers without regenerating the plate).
  Set apply_changes=false when you need clarification.
  """

  # ---------------------------------------------------------------------------
  # Chat
  # ---------------------------------------------------------------------------

  def chat(session, user_message, api_key) do
    if is_nil(api_key) or api_key == "" do
      {:error, "OpenRouter API key not configured"}
    else
      history = ThumbnailSessions.build_conversation_history(session.id)
      context = build_chat_context(session)
      system_prompt = @discovery_system_prompt <> context

      messages = [
        %{"role" => "system", "content" => system_prompt}
        | history ++ [%{"role" => "user", "content" => user_message}]
      ]

      case call_chat(messages, api_key) do
        {:ok, content} ->
          case parse_json_object(content) do
            {:ok, parsed} ->
              parsed = normalize_discovery(parsed)

              {:ok, ai_message} =
                ThumbnailSessions.create_message(
                  session.id,
                  "assistant",
                  Map.get(parsed, "message", content),
                  %{
                    "ready_to_generate" => Map.get(parsed, "ready_to_generate", false),
                    "summary" => Map.get(parsed, "summary")
                  }
                )

              if summary = Map.get(parsed, "summary") do
                ThumbnailSessions.update_session(session, %{brief_summary: summary})
              end

              {:ok, %{response: parsed, message: ai_message}}

            {:error, _} ->
              {:ok, ai_message} =
                ThumbnailSessions.create_message(session.id, "assistant", content, nil)

              {:ok,
               %{
                 response: %{
                   "message" => content,
                   "ready_to_generate" => false,
                   "summary" => nil
                 },
                 message: ai_message
               }}
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def refine(session, user_message, api_key) do
    history = ThumbnailSessions.build_conversation_history(session.id)
    context = build_chat_context(session)

    result_context =
      cond do
        session.generation_mode == "editable" && session.recipe ->
          "\n\n## CURRENT RECIPE\n#{Jason.encode!(session.recipe, pretty: true)}\n## PLATE URL\n#{session.plate_url || "none"}"

        is_list(session.candidates) and session.candidates != [] ->
          "\n\n## CURRENT CANDIDATES\n#{Jason.encode!(session.candidates, pretty: true)}"

        true ->
          ""
      end

    system_prompt = @refinement_system_prompt <> context <> result_context

    messages = [
      %{"role" => "system", "content" => system_prompt}
      | history ++ [%{"role" => "user", "content" => user_message}]
    ]

    case call_chat(messages, api_key) do
      {:ok, content} ->
        case parse_json_object(content) do
          {:ok, parsed} ->
            {:ok, ai_message} =
              ThumbnailSessions.create_message(
                session.id,
                "assistant",
                Map.get(parsed, "message", content),
                %{
                  "apply_changes" => Map.get(parsed, "apply_changes", false),
                  "change_description" => Map.get(parsed, "change_description"),
                  "text_only" => Map.get(parsed, "text_only", false)
                }
              )

            {:ok, %{response: parsed, message: ai_message}}

          {:error, _} ->
            {:ok, ai_message} =
              ThumbnailSessions.create_message(session.id, "assistant", content, nil)

            {:ok,
             %{
               response: %{
                 "message" => content,
                 "apply_changes" => false,
                 "change_description" => nil,
                 "text_only" => false
               },
               message: ai_message
             }}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ---------------------------------------------------------------------------
  # Generation
  # ---------------------------------------------------------------------------

  def generate(session, api_key, opts \\ %{}) do
    mode = Map.get(opts, "generation_mode") || Map.get(opts, :generation_mode) || session.generation_mode || "editable"
    summary = session.brief_summary || last_summary(session) || %{}
    {width, height, aspect} = resolve_canvas(session, summary)

    case mode do
      "quick" ->
        generate_quick(session, api_key, summary, width, height, aspect)

      _ ->
        generate_editable(session, api_key, summary, width, height, aspect)
    end
  end

  def refine_generation(session, change_description, api_key, opts \\ %{}) do
    text_only = Map.get(opts, "text_only") || Map.get(opts, :text_only) || false
    summary = session.brief_summary || %{}

    updated_summary =
      Map.merge(summary, %{
        "refinement_notes" => change_description,
        "description" =>
          "#{Map.get(summary, "description", "")}\nRefinement: #{change_description}"
      })

    ThumbnailSessions.update_session(session, %{brief_summary: updated_summary})
    session = %{session | brief_summary: updated_summary}

    cond do
      session.generation_mode == "editable" and text_only and is_map(session.recipe) ->
        refine_recipe_text(session, change_description, api_key)

      true ->
        generate(session, api_key, %{"generation_mode" => session.generation_mode})
    end
  end

  # ---------------------------------------------------------------------------
  # Analyze video → concepts
  # ---------------------------------------------------------------------------

  @analyze_system_prompt """
  You are Clippster's thumbnail concept strategist. Given a video title and transcript,
  invent THREE distinct high-CTR YouTube-style thumbnail concepts.

  Respond with ONLY valid JSON:
  {
    "summary": "1-3 sentence content summary",
    "concepts": [
      {
        "id": "concept-1",
        "title": "Short concept name",
        "description": "Why this concept works",
        "prompt": "Full image-generation prompt including subject, emotion, composition, colors, and baked hook text if any",
        "hook_text": "2-5 word hook",
        "text_style": "bold|outline|gradient|minimal",
        "text_placement": "left|right|top|bottom|center"
      }
    ]
  }

  Rules:
  - Exactly 3 concepts with ids concept-1, concept-2, concept-3
  - Concepts must be visually different (emotion, layout, focal subject)
  - Hook text must NOT merely repeat the video title
  - Prefer mobile-readable, high-contrast ideas
  """

  def analyze_video(session, api_key) do
    transcript = session.transcript || ""

    if String.length(String.trim(transcript)) < 50 do
      {:error, "Transcript must be at least 50 characters to analyze"}
    else
      title = session.video_title || "Your Video"
      truncated = String.slice(transcript, 0, 12_000)

      user_content = """
      Video title: #{title}

      Transcript:
      #{truncated}
      """

      messages = [
        %{"role" => "system", "content" => @analyze_system_prompt},
        %{"role" => "user", "content" => user_content}
      ]

      case call_chat(messages, api_key) do
        {:ok, content} ->
          case parse_json_object(content) do
            {:ok, parsed} ->
              concepts =
                (Map.get(parsed, "concepts") || [])
                |> Enum.take(3)
                |> Enum.with_index(1)
                |> Enum.map(fn {c, i} ->
                  c
                  |> Map.put_new("id", "concept-#{i}")
                  |> Map.put_new("title", "Concept #{i}")
                  |> Map.put_new("description", "")
                  |> Map.put_new("prompt", Map.get(c, "hook_text") || "")
                  |> Map.put_new("hook_text", "")
                  |> Map.put_new("text_style", "bold")
                  |> Map.put_new("text_placement", "left")
                end)

              summary = Map.get(parsed, "summary") || ""

              {:ok, updated} =
                ThumbnailSessions.update_session(session, %{
                  concepts: concepts,
                  video_summary: %{"text" => summary, "title" => title}
                })

              {:ok, %{session: updated, concepts: concepts, summary: summary}}

            {:error, reason} ->
              {:error, "Failed to parse concepts: #{inspect(reason)}"}
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def apply_concept(session, concept_id) when is_binary(concept_id) do
    concepts = session.concepts || []
    concept = Enum.find(concepts, fn c -> Map.get(c, "id") == concept_id end)

    if is_nil(concept) do
      {:error, "Concept not found"}
    else
      summary = %{
        "description" => Map.get(concept, "description") || Map.get(concept, "prompt"),
        "hook_text" => Map.get(concept, "hook_text"),
        "cta_text" => nil,
        "emotion" => "curiosity",
        "focal_subject" => Map.get(concept, "title"),
        "layout" => Map.get(concept, "text_placement") || "face left, text right",
        "color_palette" => ["#FF6B00", "#1E90FF", "#FFFFFF"],
        "aspect_ratio" => "16:9",
        "canvas_width" => session.canvas_width || 1280,
        "canvas_height" => session.canvas_height || 720,
        "style_notes" => Map.get(concept, "text_style"),
        "generation_prompt" => Map.get(concept, "prompt")
      }

      {:ok, updated} =
        ThumbnailSessions.update_session(session, %{
          brief_summary: summary,
          selected_concept_id: concept_id
        })

      {:ok, _msg} =
        ThumbnailSessions.create_message(
          session.id,
          "assistant",
          "Locked concept \"#{Map.get(concept, "title")}\". Ready to generate when you are.",
          %{"ready_to_generate" => true, "summary" => summary, "concept_id" => concept_id}
        )

      {:ok, ThumbnailSessions.get_session_with_messages(updated.id)}
    end
  end

  # ---------------------------------------------------------------------------
  # Generate from video (multi-variant)
  # ---------------------------------------------------------------------------

  def generate_from_video(session, api_key, opts \\ %{}) do
    variant_count =
      case Map.get(opts, "variant_count") || Map.get(opts, :variant_count) || 4 do
        n when n in [4, 8, 12] -> n
        _ -> 4
      end

    custom = Map.get(opts, "custom_instructions") || Map.get(opts, :custom_instructions) || ""
    concept_id = Map.get(opts, "concept_id") || Map.get(opts, :concept_id) || session.selected_concept_id
    aspect = Map.get(opts, "aspect_ratio") || Map.get(opts, :aspect_ratio) || "16:9"
    {width, height, aspect} = resolve_canvas(session, %{"aspect_ratio" => aspect})

    concept =
      if is_binary(concept_id) do
        Enum.find(session.concepts || [], fn c -> Map.get(c, "id") == concept_id end)
      end

    summary_text =
      case session.video_summary do
        %{"text" => t} when is_binary(t) -> t
        %{text: t} when is_binary(t) -> t
        _ -> ""
      end

    title = session.video_title || "Video"
    hook = if concept, do: Map.get(concept, "hook_text"), else: get_in(session.brief_summary || %{}, ["hook_text"])
    base_prompt = if concept, do: Map.get(concept, "prompt"), else: get_in(session.brief_summary || %{}, ["generation_prompt"])

    prompt = """
    Create a high-CTR YouTube thumbnail from this video content.
    Title: #{title}
    Summary: #{summary_text}
    Hook text (include boldly if present): #{hook || "none"}
    Concept prompt: #{base_prompt || "Bold creator thumbnail matching the transcript energy"}
    Custom direction: #{custom}
    Use the attached keyframe reference images for likeness, scene, and subject.
    Output a finished thumbnail with dramatic lighting, readable composition, and mobile-friendly contrast.
    Aspect ratio #{aspect}.
    """

    refs = collect_reference_urls(session)

    with {:ok, images} <-
           generate_images(api_key, prompt, refs,
             n: variant_count,
             aspect_ratio: aspect,
             width: width,
             height: height
           ),
         {:ok, candidates} <- persist_candidates(session, images, width, height) do
      composition = %{
        "mode" => "from_video",
        "canvas" => %{"width" => width, "height" => height, "aspect_ratio" => aspect},
        "candidates" => candidates,
        "variant_count" => variant_count,
        "concept_id" => concept_id
      }

      {:ok,
       %{
         generation_mode: "quick",
         candidates: candidates,
         plate_url: nil,
         recipe: nil,
         composition: composition,
         thumbnail_url: List.first(candidates)["url"],
         canvas_width: width,
         canvas_height: height
       }}
    end
  end

  def continue_as_editable(session, api_key, candidate_index \\ 0) do
    candidates = session.candidates || []
    chosen = Enum.at(candidates, candidate_index) || List.first(candidates)
    url = chosen && (chosen["url"] || chosen[:url])

    if is_nil(url) do
      {:error, "No candidate to convert"}
    else
      summary =
        Map.merge(session.brief_summary || %{}, %{
          "description" =>
            Map.get(session.brief_summary || %{}, "description") ||
              "Editable plate derived from from-video variant",
          "reference_variant_url" => url
        })

      session = %{session | brief_summary: summary, reference_image_url: url, generation_mode: "editable"}
      generate_editable(session, api_key, summary, session.canvas_width || 1280, session.canvas_height || 720, "16:9")
    end
  end

  defp generate_quick(session, api_key, summary, width, height, aspect) do
    prompt = build_quick_prompt(summary)
    refs = collect_reference_urls(session)

    with {:ok, images} <-
           generate_images(api_key, prompt, refs,
             n: 2,
             aspect_ratio: aspect,
             width: width,
             height: height
           ),
         {:ok, candidates} <- persist_candidates(session, images, width, height) do
      composition = %{
        "mode" => "quick",
        "canvas" => %{"width" => width, "height" => height, "aspect_ratio" => aspect},
        "candidates" => candidates,
        "summary" => summary
      }

      {:ok,
       %{
         generation_mode: "quick",
         candidates: candidates,
         plate_url: nil,
         recipe: nil,
         composition: composition,
         thumbnail_url: List.first(candidates)["url"],
         canvas_width: width,
         canvas_height: height
       }}
    end
  end

  defp generate_editable(session, api_key, summary, width, height, aspect) do
    generate_editable_with_qa(session, api_key, summary, width, height, aspect, 1)
  end

  defp generate_editable_with_qa(session, api_key, summary, width, height, aspect, attempt) do
    plate_prompt = build_plate_prompt(summary)
    refs = collect_reference_urls(session)

    with {:ok, images} <-
           generate_images(api_key, plate_prompt, refs,
             n: 1,
             aspect_ratio: aspect,
             width: width,
             height: height
           ),
         {:ok, plate_url} <- persist_single_image(session, List.first(images), "plate"),
         :ok <- validate_plate_no_text(plate_url, api_key, summary, attempt),
         {:ok, recipe} <- build_recipe(session, summary, plate_url, width, height, api_key) do
      composition = %{
        "mode" => "editable",
        "canvas" => %{"width" => width, "height" => height, "aspect_ratio" => aspect},
        "plate_url" => plate_url,
        "recipe" => recipe,
        "summary" => summary
      }

      {:ok,
       %{
         generation_mode: "editable",
         candidates: [],
         plate_url: plate_url,
         recipe: recipe,
         composition: composition,
         thumbnail_url: plate_url,
         canvas_width: width,
         canvas_height: height
       }}
    else
      {:error, :plate_contains_text} when attempt < @plate_qa_max_attempts ->
        Logger.warning(
          "[ThumbnailComposer] Plate QA rejected baked text (attempt #{attempt}); regenerating plate"
        )

        generate_editable_with_qa(session, api_key, summary, width, height, aspect, attempt + 1)

      {:error, :plate_contains_text} ->
        {:error,
         "Generated plate contains baked text or hook words. Adjust your brief or try generating again — editable plates must be text-free."}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp refine_recipe_text(session, change_description, api_key) do
    prompt = """
    Update this thumbnail recipe's text layers based on: #{change_description}

    Current recipe JSON:
    #{Jason.encode!(session.recipe)}

    Return ONLY the full updated recipe JSON object (same schema). Keep plate_asset and canvas unchanged.
    Do not wrap in markdown.
    """

    messages = [
      %{
        "role" => "system",
        "content" =>
          "You update thumbnail recipe JSON. Return only valid JSON matching the input schema."
      },
      %{"role" => "user", "content" => prompt}
    ]

    case call_chat(messages, api_key) do
      {:ok, content} ->
        case parse_json_object(content) do
          {:ok, recipe} ->
            recipe = Map.put(recipe, "plate_asset", %{"url" => session.plate_url, "role" => "background_plate"})

            composition =
              (session.composition || %{})
              |> Map.put("recipe", recipe)
              |> Map.put("mode", "editable")

            {:ok,
             %{
               generation_mode: "editable",
               candidates: [],
               plate_url: session.plate_url,
               recipe: recipe,
               composition: composition,
               thumbnail_url: session.plate_url,
               canvas_width: session.canvas_width,
               canvas_height: session.canvas_height
             }}

          {:error, reason} ->
            {:error, "Failed to update recipe: #{reason}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ---------------------------------------------------------------------------
  # Plate QA (Editable mode — reject baked text)
  # ---------------------------------------------------------------------------

  @plate_qa_system_prompt """
  You are a strict QA checker for AI-generated YouTube thumbnail background plates.
  Plates must contain NO readable text: no titles, hook words, captions, subtitles, logos,
  watermarks, wordmarks, or letters/numbers rendered as typography overlays.

  Respond ONLY with valid JSON:
  {"has_text": false, "confidence": 0.95, "reason": "brief explanation"}

  Set has_text=true if ANY readable text, hook phrase, or logo/wordmark appears in the image.
  Ignore natural scene content (faces, products, scenery). Only flag typography and logos.
  """

  defp validate_plate_no_text(plate_url, api_key, summary, attempt) do
    hook = Map.get(summary, "hook_text") || Map.get(summary, "hookText") || ""
    cta = Map.get(summary, "cta_text") || Map.get(summary, "ctaText") || ""

    hook_hint =
      cond do
        hook != "" and cta != "" ->
          " Pay special attention to hook text like \"#{hook}\" or CTA \"#{cta}\"."

        hook != "" ->
          " Pay special attention to hook text like \"#{hook}\"."

        true ->
          ""
      end

    user_text = """
    Does this thumbnail plate contain any baked/readable text, hook words, titles, captions,
    logos, or watermarks?#{hook_hint}
    The plate should be a clean background with negative space for typography added later.
    """

    messages = [
      %{"role" => "system", "content" => @plate_qa_system_prompt},
      %{
        "role" => "user",
        "content" => [
          %{"type" => "text", "text" => user_text},
          %{"type" => "image_url", "image_url" => %{"url" => plate_url}}
        ]
      }
    ]

    case call_vision_qa(messages, api_key) do
      {:ok, %{"has_text" => true} = result} ->
        Logger.warning(
          "[ThumbnailComposer] Plate QA failed attempt #{attempt}: #{Map.get(result, "reason", "text detected")}"
        )

        {:error, :plate_contains_text}

      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.warning("[ThumbnailComposer] Plate QA unavailable: #{inspect(reason)}")

        {:error,
         "Plate QA could not verify the image is text-free (#{inspect(reason)}). Check OPENROUTER_API_KEY / vision model and retry."}
    end
  end

  defp call_vision_qa(messages, api_key), do: call_vision_qa_retry(messages, api_key, 1)

  defp call_vision_qa_retry(messages, api_key, attempt) do
    payload = %{
      "model" => System.get_env("OPENROUTER_VISION_MODEL") || @default_vision_model,
      "messages" => messages,
      "max_tokens" => 512,
      "temperature" => 0.1
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster AI Thumbnail Plate QA"}
    ]

    case HTTPoison.post(@chat_url, Jason.encode!(payload), headers, recv_timeout: 60_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        with {:ok, response} <- Jason.decode(body),
             content when is_binary(content) <-
               get_in(response, ["choices", Access.at(0), "message", "content"]),
             {:ok, parsed} <- parse_json_object(content) do
          {:ok, parsed}
        else
          _ -> {:error, "invalid vision response"}
        end

      {:ok, %HTTPoison.Response{status_code: status}}
      when status in [429, 500, 502, 503, 529] and attempt < @max_retries ->
        Process.sleep(:timer.seconds(attempt * 2))
        call_vision_qa_retry(messages, api_key, attempt + 1)

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "vision API error #{status}: #{String.slice(to_string(body), 0, 200)}"}

      {:error, %HTTPoison.Error{reason: _reason}} when attempt < @max_retries ->
        Process.sleep(:timer.seconds(attempt * 2))
        call_vision_qa_retry(messages, api_key, attempt + 1)

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "vision network error: #{inspect(reason)}"}
    end
  end

  # ---------------------------------------------------------------------------
  # Prompt builders
  # ---------------------------------------------------------------------------

  def build_quick_prompt(summary) when is_map(summary) do
    hook = Map.get(summary, "hook_text") || Map.get(summary, "hookText") || ""
    cta = Map.get(summary, "cta_text") || Map.get(summary, "ctaText")
    desc = Map.get(summary, "description") || "YouTube thumbnail"
    emotion = Map.get(summary, "emotion") || "curiosity"
    subject = Map.get(summary, "focal_subject") || Map.get(summary, "focalSubject") || "main subject"
    layout = Map.get(summary, "layout") || "balanced"
    colors = Map.get(summary, "color_palette") || Map.get(summary, "colorPalette") || []
    notes = Map.get(summary, "style_notes") || Map.get(summary, "styleNotes") || ""
    refinement = Map.get(summary, "refinement_notes")

    cta_line = if is_binary(cta) and cta != "", do: "Include secondary CTA text: \"#{cta}\".", else: ""
    color_line = if colors != [], do: "Color accents: #{Enum.join(List.wrap(colors), ", ")}.", else: ""
    refine_line = if is_binary(refinement), do: "Apply this refinement: #{refinement}.", else: ""

    """
    Create a finished YouTube thumbnail image (16:9 feel, high CTR).
    Concept: #{desc}
    Focal subject: #{subject}. Emotion: #{emotion}. Layout: #{layout}.
    Bake bold hook text INTO the image: "#{hook}". #{cta_line}
    Use thick outline/stroke and strong shadow so text reads at ~200px feed size.
    #{color_line}
    #{notes}
    #{refine_line}
    High contrast, mobile postage-stamp readable, professional creator thumbnail.
    Keep critical content away from extreme edges and bottom-right duration badge area.
    """
    |> String.trim()
  end

  def build_plate_prompt(summary) when is_map(summary) do
    desc = Map.get(summary, "description") || "YouTube thumbnail background"
    emotion = Map.get(summary, "emotion") || "curiosity"
    subject = Map.get(summary, "focal_subject") || Map.get(summary, "focalSubject") || "main subject"
    layout = Map.get(summary, "layout") || "face left, space for text right"
    colors = Map.get(summary, "color_palette") || Map.get(summary, "colorPalette") || []
    notes = Map.get(summary, "style_notes") || Map.get(summary, "styleNotes") || ""
    refinement = Map.get(summary, "refinement_notes")

    color_line = if colors != [], do: "Color accents: #{Enum.join(List.wrap(colors), ", ")}.", else: ""
    refine_line = if is_binary(refinement), do: "Apply this visual refinement: #{refinement}.", else: ""

    """
    Create a YouTube thumbnail BACKGROUND PLATE only (16:9 feel).
    Concept: #{desc}
    Focal subject: #{subject}. Emotion: #{emotion}. Layout: #{layout}.
    CRITICAL: Do NOT render any title text, hook words, captions, logos, watermarks, or wordmarks.
    Leave clear negative space for typography to be added later as separate layers.
    No letters, no numbers as text overlays. Pure photographic/illustrated scene.
    #{color_line}
    #{notes}
    #{refine_line}
    High contrast, mobile-readable focal subject, professional creator thumbnail plate.
    Keep critical pixels away from extreme edges and bottom-right duration badge area.
    """
    |> String.trim()
  end

  # ---------------------------------------------------------------------------
  # Recipe
  # ---------------------------------------------------------------------------

  defp build_recipe(session, summary, plate_url, width, height, api_key) do
    hook = Map.get(summary, "hook_text") || Map.get(summary, "hookText") || "WATCH THIS"
    cta = Map.get(summary, "cta_text") || Map.get(summary, "ctaText")
    layout = Map.get(summary, "layout") || "face left, text right"
    colors = Map.get(summary, "color_palette") || Map.get(summary, "colorPalette") || ["#FFFFFF", "#FF6B00"]
    primary = List.first(List.wrap(colors)) || "#FFFFFF"
    accent = Enum.at(List.wrap(colors), 1) || "#000000"

    # Prefer LLM-structured recipe; fall back to deterministic defaults
    case request_recipe_from_llm(summary, plate_url, width, height, api_key) do
      {:ok, recipe} ->
        recipe =
          recipe
          |> Map.put("canvas", %{"width" => width, "height" => height})
          |> Map.put("plate_asset", %{"url" => plate_url, "role" => "background_plate"})

        {:ok, recipe}

      {:error, reason} ->
        Logger.warning("[ThumbnailComposer] Recipe LLM failed (#{inspect(reason)}); using defaults")

        text_x = if String.contains?(String.downcase(to_string(layout)), "left"), do: 0.55, else: 0.08

        text_layers = [
          %{
            "id" => "hook",
            "content" => hook,
            "font_family" => "Montserrat",
            "font_weight" => "900",
            "font_size" => 96,
            "color" => primary,
            "text_align" => "left",
            "stroke" => %{"color" => accent, "width" => 8},
            "shadow" => %{"color" => "#000000", "blur" => 12, "offset_x" => 4, "offset_y" => 4},
            "position" => %{"x" => text_x, "y" => 0.32},
            "scale" => 1
          }
        ]

        text_layers =
          if is_binary(cta) and String.trim(cta) != "" do
            text_layers ++
              [
                %{
                  "id" => "cta",
                  "content" => cta,
                  "font_family" => "Montserrat",
                  "font_weight" => "700",
                  "font_size" => 42,
                  "color" => "#FFFFFF",
                  "text_align" => "left",
                  "stroke" => %{"color" => "#000000", "width" => 4},
                  "shadow" => %{"color" => "#000000", "blur" => 8, "offset_x" => 2, "offset_y" => 2},
                  "position" => %{"x" => text_x, "y" => 0.55},
                  "scale" => 1
                }
              ]
          else
            text_layers
          end

        {:ok,
         %{
           "canvas" => %{"width" => width, "height" => height},
           "plate_asset" => %{"url" => plate_url, "role" => "background_plate"},
           "text_layers" => text_layers,
           "shapes" => [
             %{
               "id" => "accent_bar",
               "type" => "rect",
               "fill" => accent,
               "opacity" => 0.85,
               "position" => %{"x" => text_x, "y" => 0.48},
               "size" => %{"width" => 0.35, "height" => 0.02}
             }
           ],
           "session_id" => session.id
         }}
    end
  end

  defp request_recipe_from_llm(summary, plate_url, width, height, api_key) do
    prompt = """
    Build a structured thumbnail recipe for an Image Editor. The plate image has NO text.
    Canvas: #{width}x#{height}. Plate URL: #{plate_url}
    Brief summary: #{Jason.encode!(summary)}

    Return ONLY JSON:
    {
      "canvas": {"width": #{width}, "height": #{height}},
      "plate_asset": {"url": "#{plate_url}", "role": "background_plate"},
      "text_layers": [
        {
          "id": "hook",
          "content": "HOOK",
          "font_family": "Montserrat",
          "font_weight": "900",
          "font_size": 96,
          "color": "#FFFFFF",
          "text_align": "left",
          "stroke": {"color": "#000000", "width": 8},
          "shadow": {"color": "#000000", "blur": 12, "offset_x": 4, "offset_y": 4},
          "position": {"x": 0.55, "y": 0.3},
          "scale": 1
        }
      ],
      "shapes": [
        {
          "id": "bar",
          "type": "rect",
          "fill": "#FF6B00",
          "opacity": 0.9,
          "position": {"x": 0.55, "y": 0.48},
          "size": {"width": 0.3, "height": 0.02}
        }
      ]
    }

    Positions are normalized 0–1 from top-left. Include 1–3 text layers using the brief's hook/cta.
    """

    messages = [
      %{"role" => "system", "content" => "Return only valid thumbnail recipe JSON."},
      %{"role" => "user", "content" => prompt}
    ]

    with {:ok, content} <- call_chat(messages, api_key),
         {:ok, recipe} <- parse_json_object(content) do
      if is_list(Map.get(recipe, "text_layers")), do: {:ok, recipe}, else: {:error, "missing text_layers"}
    end
  end

  # ---------------------------------------------------------------------------
  # Image API
  # ---------------------------------------------------------------------------

  def generate_images(api_key, prompt, reference_urls, opts) do
    model = System.get_env("OPENROUTER_IMAGE_MODEL") || @default_image_model
    n = Keyword.get(opts, :n, 1)
    aspect_ratio = Keyword.get(opts, :aspect_ratio, "16:9")

    input_references =
      reference_urls
      |> Enum.take(8)
      |> Enum.map(fn url ->
        %{"type" => "image_url", "image_url" => %{"url" => url}}
      end)

    payload =
      %{
        "model" => model,
        "prompt" => prompt,
        "n" => n,
        "aspect_ratio" => aspect_ratio,
        "output_format" => "png",
        "quality" => System.get_env("OPENROUTER_IMAGE_QUALITY") || "high"
      }
      |> then(fn p ->
        if input_references == [], do: p, else: Map.put(p, "input_references", input_references)
      end)

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster AI Thumbnail"}
    ]

    Logger.info("[ThumbnailComposer] Generating images model=#{model} n=#{n} refs=#{length(input_references)}")

    case HTTPoison.post(@images_url, Jason.encode!(payload), headers, recv_timeout: 180_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            images = extract_image_payloads(response)

            if images == [] do
              {:error, "Image API returned no images"}
            else
              {:ok, images}
            end

          {:error, reason} ->
            {:error, "Failed to parse image response: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "Image API error #{status}: #{String.slice(to_string(body), 0, 300)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Image API network error: #{inspect(reason)}"}
    end
  end

  defp extract_image_payloads(%{"data" => data}) when is_list(data) do
    Enum.flat_map(data, fn item ->
      cond do
        is_binary(item["b64_json"]) ->
          [%{"b64" => item["b64_json"], "mime" => item["output_format"] || "png"}]

        is_binary(item["url"]) ->
          [%{"url" => item["url"], "mime" => "png"}]

        is_binary(get_in(item, ["image_url", "url"])) ->
          [%{"url" => get_in(item, ["image_url", "url"]), "mime" => "png"}]

        true ->
          []
      end
    end)
  end

  defp extract_image_payloads(_), do: []

  def persist_candidates(session, images, width, height) do
    candidates =
      images
      |> Enum.with_index()
      |> Enum.map(fn {img, idx} ->
        case persist_single_image(session, img, "candidate_#{idx}") do
          {:ok, url} ->
            %{
              "id" => "c#{idx}",
              "url" => url,
              "width" => width,
              "height" => height,
              "selected" => idx == 0
            }

          {:error, _} ->
            nil
        end
      end)
      |> Enum.reject(&is_nil/1)

    if candidates == [], do: {:error, "Failed to persist candidates"}, else: {:ok, candidates}
  end

  def persist_single_image(_session, nil, _label), do: {:error, "No image payload"}

  def persist_single_image(session, %{"url" => url}, _label) when is_binary(url) do
    if String.starts_with?(url, "http") do
      # Re-host if possible for permanence; otherwise keep provider URL
      case download_and_upload(session, url) do
        {:ok, hosted} -> {:ok, hosted}
        {:error, _} -> {:ok, url}
      end
    else
      {:ok, url}
    end
  end

  def persist_single_image(session, %{"b64" => b64} = img, label) when is_binary(b64) do
    mime = Map.get(img, "mime", "png")
    ext = if mime in ["jpeg", "jpg"], do: "jpg", else: "png"
    content_type = if ext == "jpg", do: "image/jpeg", else: "image/png"

    case Base.decode64(b64) do
      {:ok, binary} ->
        key = "ai-thumbnails/#{session.user_id}/#{session.id}/#{label}_#{System.system_time(:millisecond)}.#{ext}"

        case Storage.configured?() and Storage.upload_file(binary, key, content_type: content_type) do
          {:ok, url} ->
            {:ok, url}

          false ->
            {:ok, "data:#{content_type};base64,#{b64}"}

          {:error, reason} ->
            Logger.warning("[ThumbnailComposer] R2 upload failed: #{inspect(reason)}; using data URL")
            {:ok, "data:#{content_type};base64,#{b64}"}
        end

      :error ->
        {:error, "Invalid base64 image"}
    end
  end

  def persist_single_image(_, _, _), do: {:error, "Unsupported image payload"}

  defp download_and_upload(session, url) do
    case HTTPoison.get(url, [], recv_timeout: 60_000, follow_redirect: true) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} when is_binary(body) ->
        key =
          "ai-thumbnails/#{session.user_id}/#{session.id}/refetch_#{System.system_time(:millisecond)}.png"

        if Storage.configured?() do
          Storage.upload_file(body, key, content_type: "image/png")
        else
          {:ok, "data:image/png;base64,#{Base.encode64(body)}"}
        end

      _ ->
        {:error, :download_failed}
    end
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp build_chat_context(session) do
    parts = [
      "\n\n## SESSION STATE",
      "generation_mode: #{session.generation_mode}",
      "status: #{session.status}",
      "canvas: #{session.canvas_width}x#{session.canvas_height}"
    ]

    media =
      if is_list(session.media_items) and session.media_items != [] do
        names =
          Enum.map_join(session.media_items, ", ", fn item ->
            Map.get(item, "name") || Map.get(item, "id") || "media"
          end)

        "\nAttached media: #{names}"
      else
        ""
      end

    frames =
      if is_list(session.key_frames) and session.key_frames != [] do
        "\nKey frames attached: #{length(session.key_frames)}"
      else
        ""
      end

    ref =
      if session.reference_image_url do
        "\nReference thumbnail URL: #{session.reference_image_url}"
      else
        ""
      end

    video_meta =
      cond do
        is_binary(session.youtube_url) and session.youtube_url != "" ->
          "\nYouTube URL: #{session.youtube_url}\nVideo title: #{session.video_title || "unknown"}"

        is_binary(session.video_title) and session.video_title != "" ->
          "\nVideo title: #{session.video_title}"

        true ->
          ""
      end

    transcript =
      if is_binary(session.transcript) and session.transcript != "" do
        snippet = String.slice(session.transcript, 0, 2000)
        "\nTranscript (#{session.transcript_source || "unknown"}, truncated):\n#{snippet}"
      else
        ""
      end

    concepts =
      if is_list(session.concepts) and session.concepts != [] do
        "\nAnalyzed concepts: #{Jason.encode!(session.concepts)}\nSelected concept: #{session.selected_concept_id || "none"}"
      else
        ""
      end

    brief =
      if session.brief_summary do
        "\nCurrent brief: #{Jason.encode!(session.brief_summary)}"
      else
        ""
      end

    Enum.join(parts, "\n") <> media <> frames <> ref <> video_meta <> transcript <> concepts <> brief
  end

  defp collect_reference_urls(session) do
    urls = []

    urls =
      if is_binary(session.reference_image_url) and session.reference_image_url != "" do
        [session.reference_image_url | urls]
      else
        urls
      end

    frame_urls =
      (session.key_frames || [])
      |> Enum.map(fn f -> Map.get(f, "url") || Map.get(f, "dataUrl") || Map.get(f, "data_url") end)
      |> Enum.filter(&(is_binary(&1) and &1 != ""))

    media_urls =
      (session.media_items || [])
      |> Enum.flat_map(fn item ->
        [
          Map.get(item, "thumbnailUrl"),
          Map.get(item, "thumbnail_url"),
          Map.get(item, "url"),
          Map.get(item, "previewUrl")
        ]
      end)
      |> Enum.filter(&(is_binary(&1) and String.starts_with?(&1, "http")))

    (urls ++ frame_urls ++ media_urls)
    |> Enum.uniq()
    |> Enum.take(8)
  end

  defp resolve_canvas(session, summary) do
    aspect = Map.get(summary, "aspect_ratio") || Map.get(summary, "aspectRatio") || "16:9"
    aspect = if aspect in @valid_aspect_ratios, do: aspect, else: "16:9"

    {w, h} =
      case aspect do
        "9:16" -> {720, 1280}
        "1:1" -> {1080, 1080}
        _ -> {1280, 720}
      end

    width = Map.get(summary, "canvas_width") || Map.get(summary, "canvasWidth") || session.canvas_width || w
    height = Map.get(summary, "canvas_height") || Map.get(summary, "canvasHeight") || session.canvas_height || h
    {width, height, aspect}
  end

  defp last_summary(session) do
    ThumbnailSessions.list_messages(session.id)
    |> Enum.filter(fn m ->
      m.role == "assistant" && m.metadata && Map.get(m.metadata, "summary")
    end)
    |> List.last()
    |> case do
      nil -> nil
      msg -> msg.metadata["summary"]
    end
  end

  defp normalize_discovery(parsed) do
    ready? = Map.get(parsed, "ready_to_generate", false)
    summary = Map.get(parsed, "summary")

    if ready? and (not is_map(summary) or map_size(summary) == 0) do
      Map.put(parsed, "ready_to_generate", false)
    else
      parsed
    end
  end

  defp parse_json_object(content) when is_binary(content) do
    trimmed = content |> String.trim() |> strip_code_fences()

    case Jason.decode(trimmed) do
      {:ok, map} when is_map(map) ->
        {:ok, map}

      _ ->
        case extract_balanced_json(trimmed) do
          nil -> {:error, "no json"}
          json -> Jason.decode(json)
        end
    end
  end

  defp strip_code_fences(text) do
    text
    |> String.replace(~r/^```(?:json)?\s*/i, "")
    |> String.replace(~r/\s*```$/, "")
  end

  defp extract_balanced_json(text) do
    case :binary.match(text, "{") do
      {start, _} ->
        slice = binary_part(text, start, byte_size(text) - start)
        extract_object(slice)

      :nomatch ->
        nil
    end
  end

  defp extract_object(text) do
    text
    |> String.graphemes()
    |> Enum.reduce_while({0, false, false, []}, fn char, {depth, in_string, escape, acc} ->
      new_acc = [char | acc]

      cond do
        escape ->
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

  defp call_chat(messages, api_key), do: call_chat_retry(messages, api_key, 1)

  defp call_chat_retry(messages, api_key, attempt) do
    payload = %{
      "model" => System.get_env("OPENROUTER_CHAT_MODEL") || @default_chat_model,
      "messages" => messages,
      "max_tokens" => 4096,
      "temperature" => 0.6
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster AI Thumbnail Chat"}
    ]

    case HTTPoison.post(@chat_url, Jason.encode!(payload), headers, recv_timeout: 60_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            content = get_in(response, ["choices", Access.at(0), "message", "content"])
            if content, do: {:ok, content}, else: {:error, "No content in response"}

          {:error, reason} ->
            {:error, "Failed to parse response: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: _body}}
      when status in [429, 500, 502, 503, 529] and attempt < @max_retries ->
        Process.sleep(:timer.seconds(attempt * 2))
        call_chat_retry(messages, api_key, attempt + 1)

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "API error #{status}: #{String.slice(to_string(body), 0, 200)}"}

      {:error, %HTTPoison.Error{reason: _reason}} when attempt < @max_retries ->
        Process.sleep(:timer.seconds(attempt * 2))
        call_chat_retry(messages, api_key, attempt + 1)

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Network error: #{inspect(reason)}"}
    end
  end
end
