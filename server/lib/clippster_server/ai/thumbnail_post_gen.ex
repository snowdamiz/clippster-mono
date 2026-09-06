defmodule ClippsterServer.AI.ThumbnailPostGen do
  @moduledoc """
  Post-generation thumbnail tools: critique, variations, optimize, text overlay, and edits.
  """

  require Logger

  alias ClippsterServer.AI.{ThumbnailComposer, ThumbnailSessions}

  @critique_system_prompt """
  You are a YouTube thumbnail CTR critic. Score the image and suggest improvements.
  Respond with ONLY valid JSON:
  {
    "overallScore": 0-100,
    "scores": {
      "contrast": 0-10,
      "composition": 0-10,
      "textReadability": 0-10,
      "faceVisibility": 0-10,
      "colorAppeal": 0-10,
      "clickability": 0-10,
      "emotionalImpact": 0-10
    },
    "strengths": ["..."],
    "weaknesses": ["..."],
    "improvements": ["..."],
    "attentionAreas": [{"x": 50, "y": 40, "radius": 20, "intensity": 0.9, "label": "Face"}],
    "summary": "One paragraph"
  }
  """

  @text_overlay_system_prompt """
  Suggest high-CTR text overlay for this thumbnail. Respond with ONLY JSON:
  {
    "textOverlayPrompt": "Detailed recommendations for hook text, placement, colors, fonts, and styling",
    "suggestions": [
      {"hook_text": "...", "placement": "left|right|top|bottom", "color": "#FFFFFF", "style": "bold outline"}
    ]
  }
  """

  # ---------------------------------------------------------------------------
  # Critique / text overlay / optimize
  # ---------------------------------------------------------------------------

  def critique(_session, image_url, api_key, opts \\ %{}) do
    niche = Map.get(opts, "niche") || Map.get(opts, :niche) || "general"

    messages = [
      %{"role" => "system", "content" => @critique_system_prompt},
      %{
        "role" => "user",
        "content" => [
          %{"type" => "text", "text" => "Critique this #{niche} niche thumbnail for CTR."},
          %{"type" => "image_url", "image_url" => %{"url" => image_url}}
        ]
      }
    ]

    case vision_json(messages, api_key) do
      {:ok, parsed} ->
        {:ok, Map.put(parsed, "creditsCost", 4)}

      error ->
        error
    end
  end

  def text_overlay(_session, image_url, api_key, opts \\ %{}) do
    original = Map.get(opts, "originalPrompt") || Map.get(opts, :original_prompt) || ""
    face = Map.get(opts, "faceName") || Map.get(opts, :face_name) || ""

    messages = [
      %{"role" => "system", "content" => @text_overlay_system_prompt},
      %{
        "role" => "user",
        "content" => [
          %{
            "type" => "text",
            "text" =>
              "Original prompt: #{original}\nFace/name context: #{face}\nSuggest overlays."
          },
          %{"type" => "image_url", "image_url" => %{"url" => image_url}}
        ]
      }
    ]

    case vision_json(messages, api_key) do
      {:ok, parsed} ->
        {:ok,
         %{
           "textOverlayPrompt" => Map.get(parsed, "textOverlayPrompt") || Map.get(parsed, "text_overlay_prompt"),
           "suggestions" => Map.get(parsed, "suggestions") || [],
           "creditsCost" => 0
         }}

      error ->
        error
    end
  end

  def optimize(session, idea, api_key, opts \\ %{}) do
    aspect = Map.get(opts, "aspect_ratio") || "16:9"
    {width, height, aspect} = resolve_aspect(session, aspect)

    optimize_messages = [
      %{
        "role" => "system",
        "content" => """
        Turn a rough thumbnail idea into one viral-optimized image generation prompt.
        Return ONLY JSON: {"prompt": "...", "hook_text": "...", "rationale": "..."}
        """
      },
      %{"role" => "user", "content" => idea}
    ]

    with {:ok, content} <- chat_json(optimize_messages, api_key),
         prompt when is_binary(prompt) and prompt != "" <- Map.get(content, "prompt"),
         {:ok, images} <-
           ThumbnailComposer.generate_images(api_key, prompt, [],
             n: 1,
             aspect_ratio: aspect,
             width: width,
             height: height
           ),
         {:ok, candidates} <- ThumbnailComposer.persist_candidates(session, images, width, height) do
      {:ok, updated} =
        ThumbnailSessions.save_generation(session, %{
          generation_mode: "quick",
          candidates: candidates,
          plate_url: nil,
          recipe: nil,
          composition: %{
            "mode" => "optimize",
            "prompt" => prompt,
            "rationale" => Map.get(content, "rationale"),
            "hook_text" => Map.get(content, "hook_text")
          },
          thumbnail_url: List.first(candidates)["url"],
          canvas_width: width,
          canvas_height: height,
          status: "generated",
          brief_summary:
            Map.merge(session.brief_summary || %{}, %{
              "description" => idea,
              "hook_text" => Map.get(content, "hook_text"),
              "generation_prompt" => prompt
            })
        })

      {:ok, %{session: updated, prompt: prompt, candidates: candidates, creditsCost: 8}}
    else
      nil -> {:error, "Optimize did not return a prompt"}
      "" -> {:error, "Optimize did not return a prompt"}
      {:error, reason} -> {:error, reason}
      other -> {:error, "Optimize failed: #{inspect(other)}"}
    end
  end

  def variations(session, image_url, count, api_key, opts \\ %{}) do
    count = count |> max(1) |> min(10)
    aspect = Map.get(opts, "aspect_ratio") || "16:9"
    {width, height, aspect} = resolve_aspect(session, aspect)

    prompt =
      Map.get(opts, "prompt") ||
        "Create a distinct high-CTR YouTube thumbnail variation of the reference image. Keep the subject recognizable but explore different composition, color grade, and emotional intensity."

    with {:ok, images} <-
           ThumbnailComposer.generate_images(api_key, prompt, [image_url],
             n: count,
             aspect_ratio: aspect,
             width: width,
             height: height
           ),
         {:ok, new_candidates} <- ThumbnailComposer.persist_candidates(session, images, width, height) do
      merged = (session.candidates || []) ++ new_candidates

      {:ok, updated} =
        ThumbnailSessions.save_generation(session, %{
          generation_mode: session.generation_mode || "quick",
          candidates: merged,
          plate_url: session.plate_url,
          recipe: session.recipe,
          composition: Map.merge(session.composition || %{}, %{"variations_added" => length(new_candidates)}),
          thumbnail_url: List.first(new_candidates)["url"] || session.thumbnail_url,
          canvas_width: width,
          canvas_height: height,
          status: "generated"
        })

      {:ok, %{session: updated, candidates: new_candidates, creditsCost: count * 2}}
    end
  end

  # ---------------------------------------------------------------------------
  # Edits
  # ---------------------------------------------------------------------------

  def edit(session, image_url, prompt, api_key, opts \\ %{}) do
    refs = [image_url | List.wrap(Map.get(opts, "referenceImageUrls") || Map.get(opts, :reference_image_urls) || [])]
    aspect = Map.get(opts, "aspect_ratio") || "16:9"
    run_image_edit(session, prompt, refs, api_key, aspect, "edit")
  end

  def face_swap(session, image_url, face_image_url, api_key) do
    prompt =
      "Swap the main face in the first image with the face from the second reference image. Keep pose, lighting, and composition. Photorealistic seamless blend."

    run_image_edit(session, prompt, [image_url, face_image_url], api_key, "16:9", "face_swap")
  end

  def background_remove(session, image_url, api_key) do
    prompt =
      "Remove the background completely. Return the subject on a transparent background as a clean cutout PNG."

    run_image_edit(session, prompt, [image_url], api_key, "16:9", "background_remove")
  end

  def background_replace(session, image_url, background_prompt, api_key, opts \\ %{}) do
    aspect = Map.get(opts, "aspect_ratio") || "16:9"

    prompt =
      "Replace the background of the subject with: #{background_prompt}. Keep the foreground subject sharp and natural."

    run_image_edit(session, prompt, [image_url], api_key, aspect, "background_replace")
  end

  def color_enhance(session, image_url, preset, api_key, opts \\ %{}) do
    intensity = Map.get(opts, "intensity") || "medium"

    prompt =
      "Apply a #{preset} color grade at #{intensity} intensity to this thumbnail. Keep text and faces readable. Do not add new objects."

    run_image_edit(session, prompt, [image_url], api_key, "16:9", "color_enhance")
  end

  def upscale(session, image_url, scale, api_key) do
    prompt =
      "Upscale this thumbnail #{scale} with sharper detail, cleaner edges, and no new content. Preserve composition exactly."

    run_image_edit(session, prompt, [image_url], api_key, "16:9", "upscale")
  end

  def filter(session, image_url, filter_prompt, api_key) do
    prompt =
      "Apply this visual style/filter while keeping the thumbnail readable for YouTube: #{filter_prompt}"

    run_image_edit(session, prompt, [image_url], api_key, "16:9", "filter")
  end

  def combine(session, image_url1, image_url2, prompt, api_key, opts \\ %{}) do
    aspect = Map.get(opts, "aspect_ratio") || "16:9"
    full = prompt || "Combine these two images into one cohesive YouTube thumbnail."
    run_image_edit(session, full, [image_url1, image_url2], api_key, aspect, "combine")
  end

  # ---------------------------------------------------------------------------
  # Internals
  # ---------------------------------------------------------------------------

  defp run_image_edit(session, prompt, refs, api_key, aspect, label) do
    {width, height, aspect} = resolve_aspect(session, aspect)

    with {:ok, images} <-
           ThumbnailComposer.generate_images(api_key, prompt, refs,
             n: 1,
             aspect_ratio: aspect,
             width: width,
             height: height
           ),
         {:ok, url} <- ThumbnailComposer.persist_single_image(session, List.first(images), label) do
      candidate = %{
        "id" => "#{label}_#{System.system_time(:millisecond)}",
        "url" => url,
        "width" => width,
        "height" => height,
        "selected" => true,
        "edit" => label
      }

      merged = [candidate | session.candidates || []]

      {:ok, updated} =
        ThumbnailSessions.save_generation(session, %{
          generation_mode: session.generation_mode || "quick",
          candidates: merged,
          plate_url: if(session.generation_mode == "editable", do: url, else: session.plate_url),
          recipe: session.recipe,
          composition: Map.merge(session.composition || %{}, %{"last_edit" => label}),
          thumbnail_url: url,
          canvas_width: width,
          canvas_height: height,
          status: "generated"
        })

      {:ok, %{session: updated, imageUrl: url, id: candidate["id"], prompt: prompt}}
    end
  end

  defp resolve_aspect(session, aspect) do
    aspect = if aspect in ["16:9", "9:16", "1:1"], do: aspect, else: "16:9"

    {w, h} =
      case aspect do
        "9:16" -> {720, 1280}
        "1:1" -> {1080, 1080}
        _ -> {session.canvas_width || 1280, session.canvas_height || 720}
      end

    {w, h, aspect}
  end

  defp chat_json(messages, api_key) do
    call_chat_json(messages, api_key)
  end

  defp vision_json(messages, api_key) do
    model = System.get_env("OPENROUTER_VISION_MODEL") || "google/gemini-3.7-flash"
    call_openrouter_json(model, messages, api_key)
  end

  defp call_chat_json(messages, api_key) do
    model = System.get_env("OPENROUTER_CHAT_MODEL") || "anthropic/claude-sonnet-5"
    call_openrouter_json(model, messages, api_key)
  end

  defp call_openrouter_json(model, messages, api_key) do
    payload = %{
      "model" => model,
      "messages" => messages,
      "temperature" => 0.4
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster AI Thumbnail PostGen"}
    ]

    case HTTPoison.post(
           "https://openrouter.ai/api/v1/chat/completions",
           Jason.encode!(payload),
           headers,
           recv_timeout: 120_000
         ) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        with {:ok, decoded} <- Jason.decode(body),
             content when is_binary(content) <- get_in(decoded, ["choices", Access.at(0), "message", "content"]),
             {:ok, parsed} <- extract_json(content) do
          {:ok, parsed}
        else
          _ -> {:error, "Failed to parse model JSON"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "API error #{status}: #{String.slice(to_string(body), 0, 200)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Network error: #{inspect(reason)}"}
    end
  end

  defp extract_json(content) do
    trimmed = String.trim(content)

    cond do
      String.starts_with?(trimmed, "{") ->
        Jason.decode(trimmed)

      true ->
        case Regex.run(~r/\{[\s\S]*\}/, trimmed) do
          [json] -> Jason.decode(json)
          _ -> {:error, :no_json}
        end
    end
  end
end
