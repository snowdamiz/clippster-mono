defmodule ClippsterServer.AI.ImageComposer do
  @moduledoc """
  Conversational prompt discovery and true image creation for AI Image Creator.
  """

  require Logger

  alias ClippsterServer.AI.{ThumbnailComposer, ThumbnailSessions}

  @discovery_prompt """
  You are Clippster's image director. Your job is thoughtful creative direction,
  then a production-ready prompt for openai/gpt-image-2.5-sunburst.

  Ask exactly one concise follow-up question only when the missing answer would
  materially improve the result (subject, intended use, composition, aspect ratio,
  visual style, lighting/mood, or text treatment). Infer safely when possible.
  Never request a base image — this path is true creation.

  When webpage context is provided below, use brand colors, tone, positioning,
  identities, and platform cues from it. Do not claim you cannot browse links.
  When visual reference images are listed, assume they will be attached to the
  image model and write the brief to use them (likeness, branding, product look).

  Aspect ratio defaults (do not ask unless truly ambiguous):
  - Event flyer / Spaces / webinar / announcement / banner / ad → 16:9
  - Story / reel / mobile vertical → 9:16
  - Logo / icon / app mark / avatar → 1:1
  Prefer the inferred ratio over forcing square.

  Creative rules:
  - Prefer natural-language creative briefs over keyword dumps or rigid geometry recipes.
  - State the intended use (logo, ad, product photo, social post, event banner, etc.).
  - Be concrete about materials, textures, lighting, and medium.
  - Put required on-image text in "quotes"; spell unusual brand names letter-by-letter.
  - Explicit negatives only for real problems: no watermark, no extra text, no clip-art.
  - Do NOT invent constraints like "no official platform logo", "no photography",
    or "no real people" unless the user asked for that or policy requires it.
  - For platform events (X Spaces, Twitch, YouTube, etc.), allow recognizable platform
    visual language and host identity when references/context support it.
  - Prefer real photography / portraits when hosts, products, or people are the subject
    and visual references exist.
  - Keep final prompts tight (about 120–350 words). Long over-specified prompts hurt quality.

  Logo / brand-mark rules:
  - Write like a senior brand designer, not a CAD drawing.
  - Prefer distinctive monograms, ligatures, or custom lettermarks.
  - NEVER prescribe stroke topology that collapses into a Celtic cross, glowing target,
    or crosshair unless the user explicitly asked for that.
  - Aim for premium identity: unique silhouette, favicon-legible, intentional palette,
    clean negative space. Avoid neon clip-art glow unless requested.

  Respond with ONLY valid JSON:
  {
    "message": "concise conversational response or one focused question",
    "ready_to_generate": false,
    "expanded_prompt": null,
    "aspect_ratio": "1:1"
  }

  When ready_to_generate=true, expanded_prompt MUST follow this order as labeled lines:
  1) Artifact / intended use
  2) Background / scene
  3) Subject
  4) Important details (materials, palette, composition, typography if any)
  5) Constraints (what to avoid / preserve)
  Supported aspect ratios: 1:1, 16:9, 9:16.
  """

  @expansion_prompt """
  You rewrite prompts only when no production-ready draft already exists.
  Stronger creative direction, clearer structure, no waffle.

  Output ONE final prompt for openai/gpt-image-2.5-sunburst.
  Preserve user intent. Do not invent a different concept.
  Do not add constraints the user did not ask for (especially "no photography",
  "no platform logo", or "no real people").

  Required structure (labeled lines, natural language, ~120–350 words total):
  Artifact / intended use:
  Background / scene:
  Subject:
  Important details:
  Constraints:

  Respond with ONLY valid JSON:
  {
    "prompt": "the structured final image prompt",
    "aspect_ratio": "1:1"
  }
  Supported aspect ratios: 1:1, 16:9, 9:16.
  """

  @revise_prompt """
  You revise images in multi-turn editing. You can SEE the current image pixels.

  Either ask ONE focused clarifying question, or produce a surgical edit instruction
  for an image-edit model that already has the current image as input.

  Edit-prompt style:
  - Direct commands, not flowery prose
  - "Change only X. Keep everything else the same."
  - Explicitly list what to preserve (identity, layout, colors, typography, composition)
  - One primary change set per edit — do not overload
  - Never invent an unrelated new image

  Respond with ONLY valid JSON:
  {
    "message": "concise conversational response or one focused question",
    "ready_to_edit": false,
    "edit_prompt": null,
    "aspect_ratio": null
  }
  """

  @valid_aspect_ratios ~w(1:1 16:9 9:16)
  @url_regex ~r/https?:\/\/[^\s<>"')\]]+/i
  @max_page_chars 6_000
  @max_visual_refs 6
  @default_create_variants 3

  def chat(session, user_message, api_key) do
    {page_context, visual_refs} = fetch_linked_page_assets(user_message)
    system_prompt = @discovery_prompt <> page_context <> visual_refs_context(visual_refs)

    messages =
      [
        %{"role" => "system", "content" => system_prompt}
        | ThumbnailSessions.build_conversation_history(session.id)
      ]

    case ThumbnailComposer.complete_json_or_text(messages, api_key) do
      {:ok, {:json, parsed}} ->
        persist_discovery_response(session, normalize_discovery(parsed), visual_refs)

      {:ok, {:text, content}} ->
        response =
          normalize_discovery(%{
            "message" => content,
            "ready_to_generate" => false,
            "expanded_prompt" => nil,
            "aspect_ratio" => "1:1"
          })

        persist_discovery_response(session, response, visual_refs)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp persist_discovery_response(session, response, visual_refs) do
    {:ok, ai_message} =
      ThumbnailSessions.create_message(
        session.id,
        "assistant",
        response["message"],
        %{
          "ready_to_generate" => response["ready_to_generate"],
          "expanded_prompt" => response["expanded_prompt"],
          "aspect_ratio" => response["aspect_ratio"],
          "visual_reference_urls" => visual_refs
        }
      )

    if response["expanded_prompt"] do
      summary = session.brief_summary || %{}

      ThumbnailSessions.update_session(session, %{
        brief_summary:
          Map.merge(summary, %{
            "generation_prompt" => response["expanded_prompt"],
            "aspect_ratio" => response["aspect_ratio"],
            "visual_reference_urls" =>
              merge_visual_refs(Map.get(summary, "visual_reference_urls"), visual_refs)
          })
      })
    else
      if visual_refs != [] do
        summary = session.brief_summary || %{}

        ThumbnailSessions.update_session(session, %{
          brief_summary:
            Map.merge(summary, %{
              "visual_reference_urls" =>
                merge_visual_refs(Map.get(summary, "visual_reference_urls"), visual_refs)
            })
        })
      end
    end

    {:ok, %{response: response, message: ai_message}}
  end

  def prepare_prompt(session, api_key) do
    session = ThumbnailSessions.get_session_with_messages(session.id) || session

    case ready_prompt_from_session(session) do
      {:ok, prompt, aspect_ratio} ->
        # Discovery already produced a production prompt — do not expand again.
        {:ok,
         %{
           prompt: prompt,
           aspect_ratio: aspect_ratio,
           canvas: canvas_for(aspect_ratio),
           source: "discovery"
         }}

      :none ->
        history = ThumbnailSessions.build_conversation_history(session.id)

        messages =
          [
            %{"role" => "system", "content" => @expansion_prompt}
            | history
          ] ++
            [
              %{
                "role" => "user",
                "content" =>
                  "Produce the final production-ready image prompt now as JSON with keys prompt and aspect_ratio."
              }
            ]

        with {:ok, parsed} <- ThumbnailComposer.complete_json(messages, api_key),
             prompt when is_binary(prompt) and prompt != "" <- Map.get(parsed, "prompt") do
          aspect_ratio = normalize_aspect_ratio(Map.get(parsed, "aspect_ratio"))

          {:ok,
           %{
             prompt: prompt,
             aspect_ratio: aspect_ratio,
             canvas: canvas_for(aspect_ratio),
             source: "expansion"
           }}
        else
          nil -> {:error, "Prompt generation returned no prompt"}
          "" -> {:error, "Prompt generation returned no prompt"}
          {:error, reason} -> {:error, reason}
          other -> {:error, "Prompt generation failed: #{inspect(other)}"}
        end
    end
  end

  def ready_prompt_from_session(session) do
    summary = session.brief_summary || %{}
    summary_prompt = Map.get(summary, "generation_prompt") || Map.get(summary, :generation_prompt)

    cond do
      is_binary(summary_prompt) and String.trim(summary_prompt) != "" ->
        {:ok, String.trim(summary_prompt),
         normalize_aspect_ratio(
           Map.get(summary, "aspect_ratio") || Map.get(summary, :aspect_ratio)
         )}

      true ->
        Enum.find_value(Enum.reverse(session_messages(session)), :none, fn message ->
          meta = message.metadata || %{}

          ready =
            Map.get(meta, "ready_to_generate") == true or
              Map.get(meta, :ready_to_generate) == true

          prompt = Map.get(meta, "expanded_prompt") || Map.get(meta, :expanded_prompt)

          if ready and is_binary(prompt) and String.trim(prompt) != "" do
            {:ok, String.trim(prompt),
             normalize_aspect_ratio(Map.get(meta, "aspect_ratio") || Map.get(meta, :aspect_ratio))}
          else
            nil
          end
        end)
    end
  end

  def generate(session, prompt, aspect_ratio, api_key) do
    {width, height} = canvas_for(aspect_ratio)
    visual_refs = visual_refs_from_session(session)
    variant_count = create_variant_count()
    started_at = System.monotonic_time(:millisecond)

    with {:ok, images} <-
           ThumbnailComposer.generate_images(api_key, prompt, visual_refs,
             n: variant_count,
             aspect_ratio: aspect_ratio,
             width: width,
             height: height,
             operation: :create,
             base_image_urls: []
           ),
         {:ok, candidates} <-
           ThumbnailComposer.persist_candidates(session, images, width, height) do
      elapsed_ms = System.monotonic_time(:millisecond) - started_at
      policy = ThumbnailComposer.generation_policy([], operation: :create, base_image_urls: [])

      {:ok,
       %{
         candidates: candidates,
         thumbnail_url: List.first(candidates)["url"],
         canvas_width: width,
         canvas_height: height,
         composition: %{
           "mode" => "image_creation",
           "generation_prompt" => prompt,
           "aspect_ratio" => aspect_ratio,
           "visual_reference_urls" => visual_refs,
           "telemetry" => %{
             "model" => policy.model,
             "operation" => "create",
             "variant_count" => length(candidates),
             "requested_variants" => variant_count,
             "reference_count" => length(visual_refs),
             "latency_ms" => elapsed_ms,
             "canvas" => "#{width}x#{height}"
           }
         }
       }}
    end
  end

  def revise_chat(session, user_message, api_key) do
    {page_context, visual_refs} = fetch_linked_page_assets(user_message)
    image_context = current_image_context(session)
    system_prompt = @revise_prompt <> image_context <> page_context
    current_url = session.thumbnail_url || first_candidate_url(session.candidates)

    history = ThumbnailSessions.build_conversation_history(session.id)

    # Controller already persisted the user text turn; rebuild that turn with vision.
    history =
      case List.last(history) do
        %{"role" => "user"} -> Enum.drop(history, -1)
        _ -> history
      end

    user_content =
      if is_binary(current_url) and current_url != "" do
        [
          %{
            "type" => "text",
            "text" =>
              "Revision request:\n#{user_message}\n\nLook at the attached current image before answering."
          },
          %{"type" => "image_url", "image_url" => %{"url" => current_url}}
        ]
      else
        user_message
      end

    messages =
      [
        %{"role" => "system", "content" => system_prompt}
        | history
      ] ++ [%{"role" => "user", "content" => user_content}]

    case ThumbnailComposer.complete_json_or_text(messages, api_key) do
      {:ok, {:json, parsed}} ->
        persist_revise_response(session, normalize_revise(parsed), visual_refs)

      {:ok, {:text, content}} ->
        response =
          normalize_revise(%{
            "message" => content,
            "ready_to_edit" => false,
            "edit_prompt" => nil,
            "aspect_ratio" => nil
          })

        persist_revise_response(session, response, visual_refs)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp persist_revise_response(session, response, visual_refs) do
    {:ok, ai_message} =
      ThumbnailSessions.create_message(
        session.id,
        "assistant",
        response["message"],
        %{
          "ready_to_edit" => response["ready_to_edit"],
          "edit_prompt" => response["edit_prompt"],
          "aspect_ratio" => response["aspect_ratio"]
        }
      )

    if response["edit_prompt"] do
      summary = session.brief_summary || %{}

      ThumbnailSessions.update_session(session, %{
        brief_summary:
          Map.merge(summary, %{
            "edit_prompt" => response["edit_prompt"],
            "aspect_ratio" =>
              response["aspect_ratio"] || Map.get(summary, "aspect_ratio") || "1:1",
            "visual_reference_urls" =>
              merge_visual_refs(Map.get(summary, "visual_reference_urls"), visual_refs)
          })
      })
    end

    {:ok, %{response: response, message: ai_message}}
  end

  def prepare_revision(session, _api_key) do
    session = ThumbnailSessions.get_session_with_messages(session.id) || session

    case ready_edit_prompt_from_session(session) do
      {:ok, draft, aspect_ratio} ->
        # Keep edit instructions surgical — skip a second rewrite when already ready.
        {:ok, %{prompt: draft, aspect_ratio: aspect_ratio, canvas: canvas_for(aspect_ratio)}}

      :none ->
        {:error, :edit_prompt_not_ready}
    end
  end

  def ready_edit_prompt_from_session(session) do
    summary = session.brief_summary || %{}
    summary_prompt = Map.get(summary, "edit_prompt") || Map.get(summary, :edit_prompt)

    cond do
      is_binary(summary_prompt) and String.trim(summary_prompt) != "" ->
        {:ok, String.trim(summary_prompt),
         normalize_aspect_ratio(
           Map.get(summary, "aspect_ratio") || Map.get(summary, :aspect_ratio)
         )}

      true ->
        Enum.find_value(Enum.reverse(session_messages(session)), :none, fn message ->
          meta = message.metadata || %{}

          ready =
            Map.get(meta, "ready_to_edit") == true or Map.get(meta, :ready_to_edit) == true

          prompt = Map.get(meta, "edit_prompt") || Map.get(meta, :edit_prompt)

          if ready and is_binary(prompt) and String.trim(prompt) != "" do
            {:ok, String.trim(prompt),
             normalize_aspect_ratio(Map.get(meta, "aspect_ratio") || Map.get(meta, :aspect_ratio))}
          else
            nil
          end
        end)
    end
  end

  def edit(session, prompt, aspect_ratio, api_key) do
    base_url = session.thumbnail_url || first_candidate_url(session.candidates)

    if is_nil(base_url) or base_url == "" do
      {:error, "No existing image to revise"}
    else
      {width, height} = canvas_for(aspect_ratio)
      started_at = System.monotonic_time(:millisecond)

      with {:ok, images} <-
             ThumbnailComposer.generate_images(api_key, prompt, [base_url],
               n: 1,
               aspect_ratio: aspect_ratio,
               width: width,
               height: height,
               operation: :edit,
               base_image_urls: [base_url]
             ),
           {:ok, url} <-
             ThumbnailComposer.persist_single_image(session, List.first(images), "revision") do
        candidate = %{
          "id" => "rev_#{System.system_time(:millisecond)}",
          "url" => url,
          "width" => width,
          "height" => height,
          "selected" => true,
          "edit" => "revision"
        }

        elapsed_ms = System.monotonic_time(:millisecond) - started_at
        policy = ThumbnailComposer.generation_policy([base_url], operation: :edit, base_image_urls: [base_url])

        {:ok,
         %{
           candidates: [candidate | unselect_candidates(session.candidates)],
           thumbnail_url: url,
           canvas_width: width,
           canvas_height: height,
           composition:
             Map.merge(session.composition || %{}, %{
               "mode" => "image_revision",
               "edit_prompt" => prompt,
               "aspect_ratio" => aspect_ratio,
               "previous_image_url" => base_url,
               "telemetry" => %{
                 "model" => policy.model,
                 "operation" => "edit",
                 "variant_count" => 1,
                 "reference_count" => 1,
                 "latency_ms" => elapsed_ms,
                 "canvas" => "#{width}x#{height}"
               }
             })
         }}
      end
    end
  end

  def select_candidate(session, candidate_index) when is_integer(candidate_index) do
    candidates = session.candidates || []

    case Enum.at(candidates, candidate_index) do
      %{"url" => url} = chosen when is_binary(url) and url != "" ->
        updated =
          candidates
          |> Enum.with_index()
          |> Enum.map(fn {candidate, idx} ->
            Map.put(candidate, "selected", idx == candidate_index)
          end)

        {:ok,
         %{
           candidates: updated,
           thumbnail_url: url,
           composition:
             Map.merge(session.composition || %{}, %{
               "selected_candidate_index" => candidate_index,
               "selected_candidate_id" => Map.get(chosen, "id")
             })
         }}

      _ ->
        {:error, :candidate_not_found}
    end
  end

  def select_candidate(_session, _candidate_index), do: {:error, :candidate_not_found}

  def normalize_discovery(parsed) do
    expanded_prompt =
      case Map.get(parsed, "expanded_prompt") do
        prompt when is_binary(prompt) and prompt != "" -> prompt
        _ -> nil
      end

    ready = Map.get(parsed, "ready_to_generate") == true and not is_nil(expanded_prompt)

    %{
      "message" =>
        Map.get(parsed, "message") ||
          if(ready, do: "Your image prompt is ready.", else: "What should the image communicate?"),
      "ready_to_generate" => ready,
      "expanded_prompt" => if(ready, do: expanded_prompt, else: nil),
      "aspect_ratio" => normalize_aspect_ratio(Map.get(parsed, "aspect_ratio"))
    }
  end

  def normalize_revise(parsed) do
    edit_prompt =
      case Map.get(parsed, "edit_prompt") do
        prompt when is_binary(prompt) and prompt != "" -> prompt
        _ -> nil
      end

    ready = Map.get(parsed, "ready_to_edit") == true and not is_nil(edit_prompt)

    aspect =
      case Map.get(parsed, "aspect_ratio") do
        value when is_binary(value) and value in @valid_aspect_ratios -> value
        _ -> nil
      end

    %{
      "message" =>
        Map.get(parsed, "message") ||
          if(ready, do: "Ready to apply those changes.", else: "What should we change?"),
      "ready_to_edit" => ready,
      "edit_prompt" => if(ready, do: edit_prompt, else: nil),
      "aspect_ratio" => aspect
    }
  end

  defp current_image_context(session) do
    parts = [
      "\n\n## CURRENT IMAGE",
      "status: #{session.status}",
      "canvas: #{session.canvas_width}x#{session.canvas_height}",
      "The current image is attached as a vision input for this turn."
    ]

    summary = session.brief_summary || %{}
    gen = Map.get(summary, "generation_prompt")
    edit = Map.get(summary, "edit_prompt")

    parts =
      if is_binary(gen) and gen != "",
        do: parts ++ ["original_prompt: #{String.slice(gen, 0, 800)}"],
        else: parts

    parts =
      if is_binary(edit) and edit != "",
        do: parts ++ ["latest_edit_prompt: #{String.slice(edit, 0, 500)}"],
        else: parts

    Enum.join(parts, "\n")
  end

  defp first_candidate_url(candidates) when is_list(candidates) do
    selected =
      Enum.find(candidates, fn
        %{"selected" => true, "url" => url} when is_binary(url) and url != "" -> true
        _ -> false
      end)

    case selected || List.first(candidates) do
      %{"url" => url} when is_binary(url) and url != "" -> url
      _ -> nil
    end
  end

  defp first_candidate_url(_), do: nil

  defp unselect_candidates(candidates) when is_list(candidates) do
    Enum.map(candidates, &Map.put(&1, "selected", false))
  end

  defp unselect_candidates(_), do: []

  def extract_urls(text) when is_binary(text) do
    Regex.scan(@url_regex, text)
    |> Enum.map(fn [url | _] -> String.trim_trailing(url, ".") end)
    |> Enum.uniq()
    |> Enum.take(3)
  end

  def extract_urls(_), do: []

  def extract_og_image_urls(html, base_url) when is_binary(html) and is_binary(base_url) do
    patterns = [
      ~r/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ~r/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      ~r/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      ~r/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      ~r/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
      ~r/<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i
    ]

    patterns
    |> Enum.flat_map(fn pattern ->
      Regex.scan(pattern, html)
      |> Enum.map(fn
        [_, url] -> absolutize_url(base_url, url)
        _ -> nil
      end)
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.take(@max_visual_refs)
  end

  def extract_og_image_urls(_, _), do: []

  defp fetch_linked_page_assets(user_message) do
    urls = extract_urls(user_message)

    if urls == [] do
      {"", []}
    else
      pages =
        urls
        |> Enum.map(&fetch_page_assets/1)
        |> Enum.reject(&is_nil/1)

      snippets =
        pages
        |> Enum.map(& &1.text)
        |> Enum.reject(&(is_nil(&1) or String.trim(&1) == ""))

      visual_refs =
        pages
        |> Enum.flat_map(& &1.images)
        |> Enum.uniq()
        |> Enum.take(@max_visual_refs)

      text =
        if snippets == [] do
          ""
        else
          "\n\n## FETCHED WEBPAGE CONTEXT\n" <>
            Enum.join(snippets, "\n\n---\n\n") <>
            "\nUse this webpage context for brand colors, style, identities, and positioning."
        end

      {text, visual_refs}
    end
  end

  defp visual_refs_context([]), do: ""

  defp visual_refs_context(urls) when is_list(urls) do
    "\n\n## VISUAL REFERENCES (will be attached to the image model)\n" <>
      Enum.map_join(urls, "\n", &("- #{&1}"))
  end

  defp fetch_page_assets(url) do
    case Req.get(url,
           receive_timeout: 12_000,
           redirect: true,
           headers: [
             {"user-agent", "ClippsterBot/1.0 (+https://clippster.app)"},
             {"accept", "text/html,application/xhtml+xml"}
           ]
         ) do
      {:ok, %{status: status, body: body}} when status in 200..299 and is_binary(body) ->
        text = html_to_text(body) |> String.slice(0, @max_page_chars)
        images = extract_og_image_urls(body, url)

        if String.trim(text) == "" and images == [] do
          nil
        else
          %{
            text: if(String.trim(text) == "", do: nil, else: "URL: #{url}\n#{text}"),
            images: images
          }
        end

      other ->
        Logger.warning("[ImageComposer] Failed to fetch #{url}: #{inspect(other)}")
        nil
    end
  rescue
    error ->
      Logger.warning("[ImageComposer] Exception fetching #{url}: #{Exception.message(error)}")
      nil
  end

  defp html_to_text(html) when is_binary(html) do
    html
    |> String.replace(~r/<script\b[^>]*>.*?<\/script>/is, " ")
    |> String.replace(~r/<style\b[^>]*>.*?<\/style>/is, " ")
    |> String.replace(~r/<[^>]+>/, " ")
    |> String.replace("&nbsp;", " ")
    |> String.replace("&amp;", "&")
    |> String.replace("&lt;", "<")
    |> String.replace("&gt;", ">")
    |> String.replace("&quot;", "\"")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  defp absolutize_url(_base, url) when is_binary(url) do
    url = String.trim(url)

    cond do
      String.starts_with?(url, "http://") or String.starts_with?(url, "https://") ->
        url

      String.starts_with?(url, "//") ->
        "https:" <> url

      true ->
        nil
    end
  end

  defp absolutize_url(_, _), do: nil

  defp merge_visual_refs(existing, incoming) do
    ((List.wrap(existing) ++ List.wrap(incoming))
     |> Enum.filter(&(is_binary(&1) and &1 != ""))
     |> Enum.uniq()
     |> Enum.take(@max_visual_refs))
  end

  def visual_refs_from_session(session) do
    summary = session.brief_summary || %{}

    from_summary =
      case Map.get(summary, "visual_reference_urls") || Map.get(summary, :visual_reference_urls) do
        list when is_list(list) -> list
        _ -> []
      end

    from_messages =
      session_messages(session)
      |> Enum.flat_map(fn message ->
        meta = message.metadata || %{}
        List.wrap(Map.get(meta, "visual_reference_urls") || Map.get(meta, :visual_reference_urls))
      end)

    (from_summary ++ from_messages)
    |> Enum.filter(&(is_binary(&1) and String.trim(&1) != ""))
    |> Enum.uniq()
    |> Enum.take(@max_visual_refs)
  end

  # claim_generation / get_user_session often return sessions without preloaded messages.
  defp session_messages(%{messages: %Ecto.Association.NotLoaded{}}), do: []
  defp session_messages(%{messages: messages}) when is_list(messages), do: messages
  defp session_messages(_), do: []

  defp create_variant_count do
    case Integer.parse(System.get_env("OPENROUTER_IMAGE_CREATE_VARIANTS") || "") do
      {n, _} when n in 1..4 -> n
      _ -> @default_create_variants
    end
  end

  defp normalize_aspect_ratio(value) when value in @valid_aspect_ratios, do: value
  defp normalize_aspect_ratio(_), do: "1:1"

  defp canvas_for("16:9"), do: {1536, 864}
  defp canvas_for("9:16"), do: {864, 1536}
  defp canvas_for(_), do: {1024, 1024}
end
