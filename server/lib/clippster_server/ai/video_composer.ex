defmodule ClippsterServer.AI.VideoComposer do
  @moduledoc """
  AI-powered video composition generator using OpenRouter API.
  Uses a scene-by-scene approach: first plans scenes (lightweight), then generates
  detailed tracks for each scene individually, and finally splices them together.
  This prevents the AI from maxing out its output token window.
  """

  require Logger

  @default_fps 30
  @default_duration 10
  @openrouter_url "https://openrouter.ai/api/v1/chat/completions"
  @model "anthropic/claude-sonnet-4"

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Non-streaming generation (backwards-compatible). Returns {:ok, composition} or {:error, reason}.
  Internally uses scene-by-scene generation but collects all results before returning.
  """
  def generate(prompt, media, style, target_duration, aspect_ratio, user, existing_composition \\ nil, extra_options \\ %{}) do
    Logger.info("Generating AI video composition for user #{user.id}")

    ctx = build_generation_context(prompt, media, style, target_duration, aspect_ratio, existing_composition, extra_options)

    api_key = System.get_env("OPENROUTER_API_KEY")
    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY not configured"}
    else
      # For existing composition modifications, use single-shot (the AI needs full context)
      if existing_composition do
        generate_single_shot(ctx, api_key)
      else
        generate_scene_by_scene(ctx, api_key)
      end
    end
  end

  @doc """
  Streaming generation that sends SSE events to the given `send_fn`.
  `send_fn` is called with a map: %{event: "...", data: %{...}}
  Events: "plan" (scene plan), "scene" (each scene's tracks), "complete" (final composition), "error"
  """
  def generate_streamed(prompt, media, style, target_duration, aspect_ratio, user, send_fn, existing_composition \\ nil, extra_options \\ %{}) do
    Logger.info("Generating AI video composition (streamed) for user #{user.id}")

    ctx = build_generation_context(prompt, media, style, target_duration, aspect_ratio, existing_composition, extra_options)

    api_key = System.get_env("OPENROUTER_API_KEY")
    if is_nil(api_key) do
      send_fn.(%{event: "error", data: %{message: "OPENROUTER_API_KEY not configured"}})
      {:error, "OPENROUTER_API_KEY not configured"}
    else
      if existing_composition do
        # Single-shot for modifications
        send_fn.(%{event: "plan", data: %{scenes: [%{index: 0, description: "Modifying existing composition", startTime: 0, endTime: ctx.duration}], total: 1}})
        case generate_single_shot(ctx, api_key) do
          {:ok, composition} ->
            send_fn.(%{event: "scene", data: %{index: 0, total: 1, tracks: Map.get(composition, "tracks", [])}})
            send_fn.(%{event: "complete", data: %{composition: composition}})
            {:ok, composition}
          {:error, reason} ->
            send_fn.(%{event: "error", data: %{message: reason}})
            {:error, reason}
        end
      else
        generate_scene_by_scene_streamed(ctx, api_key, send_fn)
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Scene-by-scene generation (core logic)
  # ---------------------------------------------------------------------------

  defp generate_scene_by_scene(ctx, api_key) do
    # Phase 1: Plan scenes
    case plan_scenes(ctx, api_key) do
      {:ok, scenes} ->
        Logger.info("[VideoComposer] Scene plan: #{length(scenes)} scenes")

        # Build base media tracks deterministically (no AI needed)
        base_media_tracks = build_base_media_tracks(ctx, scenes)

        # Build guaranteed ambient tracks (background particles, neon borders)
        ambient_tracks = build_ambient_tracks(scenes)

        # Phase 2: Generate OVERLAY tracks for each scene (text, camera, effects, transitions)
        all_overlay_tracks = Enum.reduce_while(scenes, {:ok, []}, fn scene, {:ok, acc} ->
          case generate_scene_overlay_tracks(ctx, scene, scenes, api_key) do
            {:ok, tracks} -> {:cont, {:ok, acc ++ tracks}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)

        case all_overlay_tracks do
          {:ok, overlay_tracks} ->
            # Phase 3: Merge base media + ambient + overlay tracks into final composition
            {:ok, build_final_composition(ctx, base_media_tracks ++ ambient_tracks ++ overlay_tracks)}
          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp generate_scene_by_scene_streamed(ctx, api_key, send_fn) do
    # Phase 1: Plan scenes
    case plan_scenes(ctx, api_key) do
      {:ok, scenes} ->
        Logger.info("[VideoComposer] Scene plan: #{length(scenes)} scenes")
        send_fn.(%{event: "plan", data: %{scenes: scenes, total: length(scenes)}})

        # Build base media tracks deterministically (no AI needed)
        base_media_tracks = build_base_media_tracks(ctx, scenes)

        # Build guaranteed ambient tracks (background particles, neon borders)
        ambient_tracks = build_ambient_tracks(scenes)

        # Phase 2: Generate OVERLAY tracks for each scene, streaming progress
        result = Enum.reduce_while(Enum.with_index(scenes), {:ok, []}, fn {scene, idx}, {:ok, acc} ->
          case generate_scene_overlay_tracks(ctx, scene, scenes, api_key) do
            {:ok, tracks} ->
              send_fn.(%{event: "scene", data: %{index: idx, total: length(scenes), tracks: tracks, description: Map.get(scene, "description", "Scene #{idx + 1}")}})
              {:cont, {:ok, acc ++ tracks}}
            {:error, reason} ->
              send_fn.(%{event: "error", data: %{message: "Scene #{idx + 1} failed: #{reason}"}})
              {:halt, {:error, reason}}
          end
        end)

        case result do
          {:ok, overlay_tracks} ->
            composition = build_final_composition(ctx, base_media_tracks ++ ambient_tracks ++ overlay_tracks)
            send_fn.(%{event: "complete", data: %{composition: composition}})
            {:ok, composition}
          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        send_fn.(%{event: "error", data: %{message: reason}})
        {:error, reason}
    end
  end

  # ---------------------------------------------------------------------------
  # Phase 1: Plan scenes
  # ---------------------------------------------------------------------------

  defp plan_scenes(ctx, api_key) do
    system_prompt = """
    You are a professional video editor planning scenes for a composition.

    Given the user's request and available media, break the video into logical scenes.
    Each scene should be 3-15 seconds long. Return a JSON array of scene objects.

    ## Available Media
    #{ctx.media_context}

    ## Rules
    - Total duration must equal #{ctx.duration} seconds
    - Each scene must specify which media items to use (by their exact file paths)
    - Scenes must cover the ENTIRE duration with no gaps
    - For videos with transcripts, break at natural speech pauses or topic changes
    - For image slideshows, each image gets its own scene
    - Include a brief description of what effects/style each scene should have

    ## Output Format
    Return ONLY a valid JSON array (no markdown, no comments):
    [
      {
        "index": 0,
        "description": "Opening shot with title card and slow zoom",
        "startTime": 0,
        "endTime": 5,
        "mediaPaths": ["C:/path/to/video.mp4"],
        "transcriptSegment": "relevant transcript text for this time range",
        "audioPeaks": [{"time": 2.3, "amplitude": 0.8}],
        "mood": "energetic"
      }
    ]

    IMPORTANT:
    - mediaPaths must use EXACT paths from the media list
    - transcriptSegment should contain the transcript text that falls within this scene's time range
    - audioPeaks should list any notable audio peaks within this scene's time range
    - Return ONLY the JSON array, nothing else
    """

    user_prompt = """
    Plan scenes for this video:

    #{ctx.prompt}

    Target duration: #{ctx.duration} seconds
    Aspect ratio: #{ctx.aspect_ratio || "16:9"}
    #{if ctx.style, do: "Style: #{ctx.style}", else: ""}
    #{ctx.intensity_context}
    #{ctx.caption_context}
    #{ctx.reference_context}
    #{ctx.media_analysis_context}
    """

    case call_openrouter(system_prompt, user_prompt, api_key, max_tokens: 4096) do
      {:ok, content} ->
        parse_scenes_response(content, ctx)
      {:error, reason} ->
        {:error, "Scene planning failed: #{reason}"}
    end
  end

  defp parse_scenes_response(content, ctx) do
    # Extract JSON array from response
    cleaned = extract_first_json_array(content)

    case Jason.decode(cleaned) do
      {:ok, scenes} when is_list(scenes) ->
        # Validate and fix scene timing
        scenes = scenes
        |> Enum.with_index()
        |> Enum.map(fn {scene, idx} ->
          Map.merge(scene, %{"index" => idx})
        end)

        if length(scenes) == 0 do
          # Fallback: single scene covering entire duration
          {:ok, [%{"index" => 0, "description" => "Full video", "startTime" => 0, "endTime" => ctx.duration, "mediaPaths" => [], "transcriptSegment" => "", "audioPeaks" => [], "mood" => "auto"}]}
        else
          {:ok, scenes}
        end

      {:ok, _} ->
        {:error, "Scene plan was not a JSON array"}

      {:error, reason} ->
        Logger.error("[VideoComposer] Failed to parse scene plan: #{inspect(reason)}")
        Logger.error("[VideoComposer] Raw content: #{String.slice(content, 0, 1000)}")
        # Fallback: single scene
        {:ok, [%{"index" => 0, "description" => "Full video", "startTime" => 0, "endTime" => ctx.duration, "mediaPaths" => [], "transcriptSegment" => "", "audioPeaks" => [], "mood" => "auto"}]}
    end
  end

  # ---------------------------------------------------------------------------
  # Build base media tracks deterministically from scene plan
  # ---------------------------------------------------------------------------

  defp build_base_media_tracks(ctx, scenes) do
    # Parse media items to get paths and types
    media_items = ctx.media || []

    # For each scene, create a video/image track for its media
    scenes
    |> Enum.flat_map(fn scene ->
      scene_index = Map.get(scene, "index", 0)
      scene_start = Map.get(scene, "startTime", 0)
      scene_end = Map.get(scene, "endTime", ctx.duration)
      media_paths = Map.get(scene, "mediaPaths", [])

      # If scene specifies media paths, use them; otherwise use the first available media
      paths = if is_list(media_paths) && length(media_paths) > 0 do
        media_paths
      else
        # Fallback: find media that covers this time range, or use first media
        case media_items do
          [first | _] ->
            path = get_media_path(first)
            if path, do: [path], else: []
          _ -> []
        end
      end

      paths
      |> Enum.with_index()
      |> Enum.map(fn {path, media_idx} ->
        media_type = detect_media_type(path, media_items)
        
        # Add a default slow zoom or pan for variety (static video is boring)
        motion_types = ["slowZoom", "dollyPan"]
        motion_type = Enum.random(motion_types)
        motion_dir = Enum.random(["in", "out", "left", "right"])
        
        %{
          "id" => "s#{scene_index}-#{media_type}-#{media_idx}",
          "type" => media_type,
          "name" => "#{String.capitalize(media_type)} #{scene_index + 1}",
          "source" => %{"type" => "local", "path" => path},
          "startTime" => scene_start,
          "endTime" => scene_end,
          "layer" => 0,
          "properties" => %{
            "x" => 50,
            "y" => 50,
            "scale" => 0.9, # Leave room for borders
            "opacity" => 1,
            "effects" => [
              %{
                "type" => motion_type,
                "startTime" => scene_start,
                "endTime" => scene_end,
                "intensity" => 0.15,
                "direction" => motion_dir
              }
            ]
          }
        }
      end)
    end)
  end

  # Build guaranteed ambient overlay tracks for every scene so there is always
  # visual depth even if the AI overlay generation is sparse.
  defp build_ambient_tracks(scenes) do
    accent = Enum.random(["#00D4FF", "#FF6B35", "#A855F7", "#22D3EE", "#F43F5E", "#10B981"])

    Enum.flat_map(Enum.with_index(scenes), fn {scene, idx} ->
      scene_start = Map.get(scene, "startTime", 0)
      scene_end   = Map.get(scene, "endTime", scene_start + 5)

      [
        # Mesh gradient background on layer 15 (rich animated gradient, cinematic depth)
        %{
          "id" => "amb-bg-#{idx}",
          "type" => "motionGraphic",
          "name" => "Ambient BG #{idx + 1}",
          "startTime" => scene_start,
          "endTime" => scene_end,
          "layer" => 15,
          "properties" => %{
            "motionGraphic" => %{
              "templateId" => "meshGradientBg",
              "customColors" => [accent, "#ec4899", "#06b6d4", "#000000"],
              "text" => ""
            }
          }
        },
        # Neon frame border on layer 17 (foreground accent)
        %{
          "id" => "amb-frame-#{idx}",
          "type" => "motionGraphic",
          "name" => "Ambient Frame #{idx + 1}",
          "startTime" => scene_start,
          "endTime" => scene_end,
          "layer" => 17,
          "properties" => %{
            "motionGraphic" => %{
              "templateId" => "neonFrame",
              "customColors" => [accent],
              "intensity" => 0.5,
              "text" => ""
            }
          }
        }
      ]
    end)
  end

  defp get_media_path(media_item) when is_map(media_item) do
    # Try source.path first, then path, then filePath
    case get_in(media_item, ["source", "path"]) do
      nil ->
        Map.get(media_item, "path") || Map.get(media_item, "filePath")
      path -> path
    end
  end
  defp get_media_path(_), do: nil

  defp detect_media_type(path, media_items) when is_binary(path) do
    # Check if any media item with this path has a type
    found = Enum.find(media_items, fn item ->
      get_media_path(item) == path
    end)

    cond do
      found && Map.get(found, "type") in ["video", "image", "audio"] ->
        Map.get(found, "type")
      String.match?(path, ~r/\.(mp4|mov|avi|webm|mkv)$/i) -> "video"
      String.match?(path, ~r/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) -> "image"
      String.match?(path, ~r/\.(mp3|wav|ogg|aac|flac)$/i) -> "audio"
      true -> "video"
    end
  end
  defp detect_media_type(_, _), do: "video"

  # ---------------------------------------------------------------------------
  # Phase 2: Generate OVERLAY tracks for a single scene (no video/image tracks)
  # ---------------------------------------------------------------------------

  defp generate_scene_overlay_tracks(ctx, scene, all_scenes, api_key) do
    scene_index = Map.get(scene, "index", 0)
    scene_start = Map.get(scene, "startTime", 0)
    scene_end = Map.get(scene, "endTime", ctx.duration)
    scene_desc = Map.get(scene, "description", "")
    transcript_segment = Map.get(scene, "transcriptSegment", "")
    audio_peaks = Map.get(scene, "audioPeaks", [])
    mood = Map.get(scene, "mood", "auto")

    scene_context = all_scenes
    |> Enum.map(fn s ->
      idx = Map.get(s, "index", 0)
      marker = if idx == scene_index, do: " ← CURRENT", else: ""
      "  Scene #{idx + 1} (#{Map.get(s, "startTime", 0)}s-#{Map.get(s, "endTime", 0)}s): #{Map.get(s, "description", "")}#{marker}"
    end)
    |> Enum.join("\n")

    system_prompt = build_scene_overlay_system_prompt(ctx)

    peaks_context = if is_list(audio_peaks) && length(audio_peaks) > 0 do
      peaks_str = Enum.map(audio_peaks, fn p ->
        "#{Map.get(p, "time", 0)}s (amp: #{Map.get(p, "amplitude", 0)})"
      end) |> Enum.join(", ")
      "Audio peaks in this scene: #{peaks_str}"
    else
      ""
    end

    user_prompt = """
    Generate the OVERLAY tracks for Scene #{scene_index + 1} of the video.

    ## Scene Details
    - Time range: #{scene_start}s to #{scene_end}s (#{Float.round((scene_end - scene_start) / 1, 1)}s duration)
    - Description: #{scene_desc}
    - Mood: #{mood}
    #{if transcript_segment != "", do: "- Transcript: #{transcript_segment}", else: ""}
    #{peaks_context}

    ## Full Scene Plan (for context)
    #{scene_context}

    ## User's Original Request
    #{ctx.prompt}

    #{ctx.intensity_context}
    #{ctx.caption_context}
    #{ctx.reference_context}
    #{ctx.media_analysis_context}

    ## MANDATORY OUTPUT — You MUST generate ALL of these for this scene:
    1. **1 cameraMotion track** — slowZoom, dollyPan, orbit, or punchZoom covering the full scene duration
    2. **2+ motionGraphic tracks** — PRIORITIZE PREMIUM templates:
       - heroGradientText (animated gradient hero title), glassMorphCard (frosted glass feature card),
       - floatingMockup (3D floating product card), deviceMockup (3D app preview),
       - featureShowcase (animated feature grid), sweepingLight (cinematic light streak on layer 18),
       - animatedUnderline (text with expanding underline)
       - Also: kineticText, animatedInfoCard, calloutBox, dataCounter, floatingBadge
    3. **1+ text track** — Captions from transcript (exact words, 2-4 word chunks, 1-2s each) with bold styling (fontSize 56, fontWeight 800, stroke width 6)
    4. **1 transition track** — At scene start (if not first scene) or end
    5. **0-2 impactFX tracks** — flash/screenShake/particleBurst on audio peaks or excitement words
    6. **1 sweepingLight track** — On layer 18 for cinematic light streak effect (at least on scene transitions)

    ## CRITICAL Rules for THIS Scene
    - DO NOT generate video or image tracks — those are already created separately
    - All track startTime/endTime MUST be within #{scene_start}s to #{scene_end}s
    - Track IDs must be prefixed with "s#{scene_index}-" (e.g. "s#{scene_index}-txt-1", "s#{scene_index}-cam-1")
    - If this is the first scene (#{scene_start}s), include an intro transition (zoomIn or fade)
    - If this is the last scene (ends at #{ctx.duration}s), include an outro transition (fade)
    #{if scene_index > 0, do: "- Add a transition at the start (#{scene_start}s) to blend with the previous scene", else: ""}

    ## Output Format
    Return ONLY a valid JSON object with a "tracks" array:
    {"tracks": [ ...track objects... ]}
    """

    case call_openrouter(system_prompt, user_prompt, api_key, max_tokens: 8192) do
      {:ok, content} ->
        case parse_scene_tracks_response(content) do
          {:ok, tracks} ->
            # Safety: filter out any video/image tracks the AI may have generated anyway
            filtered = Enum.reject(tracks, fn t ->
              Map.get(t, "type") in ["video", "image"]
            end)
            {:ok, filtered}
          error -> error
        end
      {:error, reason} ->
        {:error, "Scene #{scene_index + 1} generation failed: #{reason}"}
    end
  end

  defp parse_scene_tracks_response(content) do
    cleaned = extract_first_json_object(content)

    case Jason.decode(cleaned) do
      {:ok, %{"tracks" => tracks}} when is_list(tracks) ->
        {:ok, tracks}
      {:ok, result} ->
        # Maybe the AI returned just an array
        tracks = Map.get(result, "tracks", [])
        if is_list(tracks), do: {:ok, tracks}, else: {:ok, []}
      {:error, reason} ->
        Logger.error("[VideoComposer] Failed to parse scene tracks: #{inspect(reason)}")
        Logger.error("[VideoComposer] Raw content: #{String.slice(content, 0, 1000)}")
        {:error, "Invalid scene tracks format: #{inspect(reason)}"}
    end
  end

  # ---------------------------------------------------------------------------
  # Phase 3: Build final composition
  # ---------------------------------------------------------------------------

  defp build_final_composition(ctx, all_tracks) do
    max_track_end = Enum.reduce(all_tracks, 0, fn track, acc ->
      end_time = Map.get(track, "endTime", 0)
      max(acc, end_time)
    end)
    effective_duration = Enum.max([ctx.duration, max_track_end])

    %{
      "id" => Ecto.UUID.generate(),
      "name" => "AI Generated Video",
      "width" => ctx.width,
      "height" => ctx.height,
      "aspectRatio" => calculate_aspect_ratio(ctx.width, ctx.height),
      "duration" => effective_duration,
      "fps" => @default_fps,
      "backgroundColor" => "#000000",
      "tracks" => all_tracks
    }
  end

  # ---------------------------------------------------------------------------
  # Single-shot generation (for existing composition modifications)
  # ---------------------------------------------------------------------------

  defp generate_single_shot(ctx, api_key) do
    system_prompt = build_system_prompt(ctx.media_context, ctx.duration, ctx.aspect_ratio, ctx.style)

    existing_context = if ctx.existing_composition do
      """

      EXISTING COMPOSITION TO MODIFY:
      #{Jason.encode!(ctx.existing_composition, pretty: true)}

      IMPORTANT: Modify the existing composition based on the user's request. Keep existing tracks unless the user asks to remove or change them.
      """
    else
      ""
    end

    user_prompt = """
    Create a video composition based on this request:

    #{ctx.prompt}

    Available media:
    #{ctx.media_context}

    Target duration: #{ctx.duration} seconds
    Aspect ratio: #{ctx.aspect_ratio || "16:9"}
    #{if ctx.style, do: "Style: #{ctx.style}", else: ""}
    #{ctx.intensity_context}
    #{ctx.caption_context}
    #{existing_context}
    """

    case call_openrouter(system_prompt, user_prompt, api_key, max_tokens: 32768) do
      {:ok, content} ->
        parse_composition_response_from_content(content, ctx.width, ctx.height, ctx.duration)
      {:error, reason} ->
        {:error, reason}
    end
  end

  # ---------------------------------------------------------------------------
  # OpenRouter API call helper
  # ---------------------------------------------------------------------------

  @max_retries 3

  defp call_openrouter(system_prompt, user_prompt, api_key, opts) do
    call_openrouter_with_retry(system_prompt, user_prompt, api_key, opts, 1)
  end

  defp call_openrouter_with_retry(system_prompt, user_prompt, api_key, opts, attempt) do
    max_tokens = Keyword.get(opts, :max_tokens, 8192)

    payload = %{
      "model" => @model,
      "messages" => [
        %{"role" => "system", "content" => system_prompt},
        %{"role" => "user", "content" => user_prompt}
      ],
      "max_tokens" => max_tokens,
      "temperature" => 0.75
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster AI Video Creator"}
    ]

    case HTTPoison.post(
      @openrouter_url,
      Jason.encode!(payload),
      headers,
      recv_timeout: 180_000
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
        maybe_retry(system_prompt, user_prompt, api_key, opts, attempt, "API error #{status}: #{String.slice(body, 0, 200)}")

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "API error #{status}: #{body}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        maybe_retry(system_prompt, user_prompt, api_key, opts, attempt, "Network error: #{inspect(reason)}")
    end
  end

  defp maybe_retry(system_prompt, user_prompt, api_key, opts, attempt, error_msg) do
    if attempt < @max_retries do
      delay = :timer.seconds(attempt * 2)
      Logger.warning("[VideoComposer] Attempt #{attempt}/#{@max_retries} failed: #{error_msg}. Retrying in #{div(delay, 1000)}s...")
      Process.sleep(delay)
      call_openrouter_with_retry(system_prompt, user_prompt, api_key, opts, attempt + 1)
    else
      Logger.error("[VideoComposer] All #{@max_retries} attempts failed. Last error: #{error_msg}")
      {:error, error_msg}
    end
  end

  # ---------------------------------------------------------------------------
  # Context builder
  # ---------------------------------------------------------------------------

  defp build_generation_context(prompt, media, style, target_duration, aspect_ratio, existing_composition, extra_options) do
    media_context = build_media_context(media)
    {width, height} = get_dimensions(aspect_ratio || "16:9")
    duration = target_duration || calculate_duration(media)

    intensity = Map.get(extra_options || %{}, "intensity")
    caption_style = Map.get(extra_options || %{}, "captionStyle")
    reference_analysis = Map.get(extra_options || %{}, "reference_analysis")
    media_analysis = Map.get(extra_options || %{}, "media_analysis")

    intensity_context = build_intensity_context(intensity)
    caption_context = build_caption_context(caption_style)
    reference_context = build_reference_context(reference_analysis)
    media_analysis_context = build_media_analysis_context(media_analysis)

    %{
      prompt: prompt,
      media: media,
      media_context: media_context,
      style: style,
      duration: duration,
      aspect_ratio: aspect_ratio,
      width: width,
      height: height,
      existing_composition: existing_composition,
      intensity_context: intensity_context,
      caption_context: caption_context,
      reference_context: reference_context,
      media_analysis_context: media_analysis_context
    }
  end

  defp build_reference_context(nil), do: ""
  defp build_reference_context(ref) when is_map(ref) do
    """
    ## REFERENCE STYLE PROFILE
    Match this reference style as closely as possible:
    #{Jason.encode!(ref, pretty: true)}

    Use the exact color palette, similar motion types, matching typography style, and equivalent pacing.
    """
  end
  defp build_reference_context(_), do: ""

  defp build_media_analysis_context(nil), do: ""
  defp build_media_analysis_context(analysis) when is_list(analysis) and length(analysis) > 0 do
    """
    ## MEDIA CONTENT ANALYSIS
    AI vision analysis of each uploaded image:
    #{Jason.encode!(analysis, pretty: true)}

    Use this to order images intelligently, match effects to content, and use dominant colors.
    """
  end
  defp build_media_analysis_context(_), do: ""

  defp build_intensity_context(intensity) do
    if intensity do
      intensity_val = cond do
        is_binary(intensity) ->
          case Float.parse(intensity) do
            {val, _} -> val
            :error -> 0.5
          end
        is_number(intensity) -> intensity / 1
        true -> 0.5
      end
      cond do
        intensity_val <= 0.2 -> "INTENSITY: Very subtle. Use minimal effects (1-3 total), no shake, gentle zooms only."
        intensity_val <= 0.4 -> "INTENSITY: Subtle. Use few effects (3-5 total), light camera motion, clean aesthetic."
        intensity_val <= 0.6 -> "INTENSITY: Moderate. Use balanced effects (5-8 total), standard camera motion."
        intensity_val <= 0.8 -> "INTENSITY: High energy. Use many effects (8-12 total), dynamic camera, bold styling."
        true -> "INTENSITY: Maximum. Use heavy effects (12-20 total), aggressive camera motion, explosive impacts."
      end
    else
      ""
    end
  end

  defp build_caption_context(caption_style) do
    case caption_style do
      "bold_tiktok" -> "CAPTION STYLE: Bold TikTok — fontSize 64, fontWeight 900, white (#FFFFFF), black stroke width 6, animation fade 0.3s"
      "clean_subtitle" -> "CAPTION STYLE: Clean Subtitle — fontSize 42, fontWeight 500, white (#FFFFFF), semi-transparent black background, no stroke"
      "neon_glow" -> "CAPTION STYLE: Neon Glow — fontSize 56, fontWeight 700, cyan (#00FFFF), text-shadow glow effect, no stroke"
      "minimal" -> "CAPTION STYLE: Minimal — fontSize 36, fontWeight 400, light gray (#CCCCCC), no stroke, no background, letter-spacing 1px"
      "none" -> "CAPTION STYLE: No captions. Do NOT add any text tracks."
      _ -> ""
    end
  end

  defp build_media_context(media) when is_list(media) do
    media
    |> Enum.with_index(1)
    |> Enum.map(fn {item, index} ->
      type = Map.get(item, "type", "unknown")
      name = Map.get(item, "name", "Untitled")
      id = Map.get(item, "id", "unknown")
      duration = Map.get(item, "duration")
      dimensions = Map.get(item, "dimensions")
      transcript = Map.get(item, "transcript")
      _waveform = Map.get(item, "waveform")
      audio_peaks = Map.get(item, "audioPeaks")
      
      # Get the actual file path from source
      source = Map.get(item, "source", %{})
      path = Map.get(source, "path", "")

      info = [
        "#{index}. #{name} (#{type})",
        "ID: #{id}",
        "Path: #{path}"
      ]

      info = if duration, do: info ++ ["Duration: #{Float.round(duration / 1, 2)}s"], else: info
      info = if dimensions do
        info ++ ["Size: #{dimensions["width"]}x#{dimensions["height"]}"]
      else
        info
      end
      
      # Add transcript with word-level analysis if available
      info = if transcript && is_binary(transcript) && String.length(transcript) > 0 do
        # Analyze transcript for excitement markers
        excitement_words = ["boom", "wow", "omg", "holy", "shit", "fuck", "insane", "crazy", "wild", "huge", "massive", "no way", "what", "yes", "let's go"]
        celebration_words = ["win", "won", "hit", "got it", "there it is", "nice", "good", "great", "perfect"]
        
        transcript_lower = String.downcase(transcript)
        found_excitement = Enum.filter(excitement_words, fn word -> String.contains?(transcript_lower, word) end)
        found_celebration = Enum.filter(celebration_words, fn word -> String.contains?(transcript_lower, word) end)
        
        excitement_markers = if length(found_excitement) > 0 or length(found_celebration) > 0 do
          Logger.info("[VideoComposer] EXCITEMENT WORDS DETECTED: #{Enum.join(found_excitement ++ found_celebration, ", ")}")
          " | EXCITEMENT WORDS DETECTED (PLACE EFFECTS WHEN THESE ARE SPOKEN): #{Enum.join(found_excitement ++ found_celebration, ", ")}"
        else
          ""
        end
        
        info ++ ["Transcript: #{transcript}#{excitement_markers}"]
      else
        info
      end
      
      # Add detailed audio peak analysis if available
      info = if audio_peaks && is_list(audio_peaks) && length(audio_peaks) > 0 do
        peak_count = length(audio_peaks)
        Logger.info("[VideoComposer] ✅ RECEIVED #{peak_count} AUDIO PEAKS for #{name}")
        
        # Analyze peak distribution and intensity
        sorted_peaks = Enum.sort_by(audio_peaks, &Map.get(&1, "amplitude"), :desc)
        top_peaks = Enum.take(sorted_peaks, 10)
        
        peak_analysis = top_peaks
        |> Enum.map(fn peak ->
          time = Map.get(peak, "time", 0)
          amp = Map.get(peak, "amplitude", 0)
          "#{Float.round(time / 1, 1)}s (amp: #{Float.round(amp / 1, 2)})"
        end)
        |> Enum.join(", ")
        
        Logger.info("[VideoComposer] TOP 10 LOUDEST PEAKS: #{peak_analysis}")
        info ++ ["Audio Peaks: #{peak_count} total | TOP 10 LOUDEST MOMENTS (MUST USE THESE EXACT TIMESTAMPS FOR EFFECTS): #{peak_analysis} | PLACE EXPLOSIVE EFFECTS AT EACH OF THESE TIMES"]
      else
        Logger.info("[VideoComposer] ⚠️ NO AUDIO PEAKS received for #{name}")
        info
      end

      Enum.join(info, " | ")
    end)
    |> Enum.join("\n")
  end

  defp build_media_context(_), do: "No media provided"

  defp calculate_duration(media) when is_list(media) do
    total = Enum.reduce(media, 0, fn item, acc ->
      duration = Map.get(item, "duration", 0)
      acc + (duration || 0)
    end)

    # If total is very low (e.g. all images with 0 duration), use a sensible default
    # based on number of media items (6-8s per image is a good pace)
    effective = if total < 5 do
      image_count = Enum.count(media, fn item -> Map.get(item, "type") in ["image", "screenshot"] end)
      if image_count > 0, do: min(image_count * 7, 120), else: 30
    else
      total
    end

    min(max(effective, 10), 120)  # Between 10 and 120 seconds
  end

  defp calculate_duration(_), do: @default_duration

  defp get_dimensions("16:9"), do: {1920, 1080}
  defp get_dimensions("9:16"), do: {1080, 1920}
  defp get_dimensions("1:1"), do: {1080, 1080}
  defp get_dimensions("4:5"), do: {1080, 1350}
  defp get_dimensions(_), do: {1920, 1080}

  defp build_system_prompt(media_context, duration, aspect_ratio, style) do
    # Build style-specific guidance if a preset style was selected
    style_guidance = case style do
      "hype" -> """
      STYLE PRESET: Hype/Viral/Alex Hormozi Style
      - FAST PACED: 0.5-1.5s per cut. High energy.
      - KINETIC TYPOGRAPHY: Every spoken word must have a caption. Use 'kineticText' motion graphics for important phrases. Use 'heroGradientText' for the main title.
      - FANCY TEXT: Use fontWeight 900, textCase uppercase, white with thick black stroke (width 6-8). Add 'glow' (intensity 10, color matching brand).
      - COLOR PALETTE: Pick ONE bright accent color (e.g. #fbbf24 Yellow, #22d3ee Cyan, #a855f7 Purple) and use it for all emphasis text and graphics.
      - CAMERA: Frequent 'punchZoom' on audio peaks. Continuous 'handheldShake' (intensity 0.05).
      - IMPACT: flash + screenShake + particleBurst on every single audio peak > 0.6. Add 'sweepingLight' on scene transitions.
      - LAYERING: Always have 4+ layers active (meshGradientBg + Media + Camera + Text + ImpactFX).
      - BACKGROUNDS: Use 'meshGradientBg' on layer 15 instead of plain particleBackground for richer depth.
      """
      "professional" -> """
      STYLE PRESET: Professional/Clean Corporate
      - POLISHED & SPACED: 3-6s per scene.
      - ELEGANT TEXT: Use 'Inter' or 'Montserrat'. fontSize 42, fontWeight 500, white with subtle shadow. No stroke.
      - MOTION GRAPHICS: Use 'animatedInfoCard' and 'animatedDivider' to present facts.
      - CAMERA: Smooth 'slowZoom' (in or out) on every scene. No shake.
      - TRANSITIONS: Use 'fade' or 'blur' exclusively.
      - COLOR: saturation 1.1, contrast 1.1.
      """
      "gaming" -> """
      STYLE PRESET: Gaming Montage
      - Dynamic camera motion, action-focused
      - Impact effects on eliminations/wins, freeze frames on clutch moments
      - Bold captions for callouts (40-50% coverage)
      - Vibrant gaming aesthetic: saturation 1.3, contrast 1.2
      - Effect budget: 6-10 effects + 3-5 transitions
      """
      "cinematic" -> """
      STYLE PRESET: Cinematic
      - Film-like aesthetic with letterboxing feel
      - Slow, deliberate camera movements (slowZoom, dollyPan)
      - Minimal but impactful effects (lens flare, light rays)
      - Rich color grading: saturation 1.2, contrast 1.2, vignette 0.5
      - Effect budget: 5-8 effects + 3-5 transitions
      """
      "tutorial" -> """
      STYLE PRESET: Tutorial/Educational
      - Clear, easy-to-follow pacing
      - Clean captions for key instructions (60-70% coverage)
      - Minimal effects, slow zooms to emphasize points
      - Neutral color: saturation 1.1, contrast 1.1
      - Effect budget: 2-4 effects + 1-2 transitions
      """
      "vlog" -> """
      STYLE PRESET: Vlog/Story
      - Natural, authentic feel
      - Subtle handheld shake (0.04), warm color grade
      - Minimal effects, let the story shine
      - Warm tones: saturation 1.2, contrast 1.1
      - Effect budget: 3-6 effects + 2-3 transitions
      """
      "music_video" -> """
      STYLE PRESET: Music Video
      - Beat-synced editing, artistic freedom
      - Heavy use of transitions synced to music
      - Creative effects: prism, holographic, kaleidoscope
      - Stylized color grading based on mood
      - Effect budget: 15-25 effects + 6-10 transitions
      """
      "product" -> """
      STYLE PRESET: Premium SaaS / Motion Graphics Promo (Astra Motion Style)
      - **HIGH-END MOTION GRAPHICS**: Use 'glassMorphCard' for feature highlights, 'deviceMockup' for app/product shots, 'floatingMockup' for hero sections, 'featureShowcase' for feature grids, 'animatedInfoCard' for data points, 'dataCounter' for stats, 'logoReveal' for branding.
      - **HERO TEXT**: Use 'heroGradientText' for the main title/hero text with animated gradient fill. Use 'kineticText' for secondary headlines.
      - **CINEMATIC BACKGROUNDS**: Use 'meshGradientBg' on layer 15 for rich animated gradient backgrounds. Use 'sweepingLight' for cinematic light streaks on transitions.
      - **3D PARALLAX**: Use 'orbit' or 'parallax' camera motion. Everything should feel like it's floating in 3D space.
      - **LAYERING (MANDATORY — 5+ active layers per scene)**:
        - Layer 15: 'meshGradientBg' (animated gradient background)
        - Layer 17: 'neonFrame' (cinematic border with animated corners)
        - Layer 0: Main Image/Video
        - Layer 10-14: 'glassMorphCard', 'deviceMockup', 'floatingMockup', or 'heroGradientText'
        - Layer 18: 'sweepingLight' (cinematic light streak)
        - Layer 20+: impactFX (flash, radialGlow)
      - **GLASS MORPHISM**: Use 'glassMorphCard' with frosted glass (backdrop-blur) for feature cards. This is the signature SaaS promo look.
      - **FANCY TEXT**: Use 'heroGradientText' with animated gradient fills. Add 'animatedUnderline' for emphasis.
      - **COLORS**: Pick a consistent brand color (e.g. #6366f1) and use it for ALL 'customColors' arrays across every template.
      - **TRANSITIONS**: Use 'glitchTransition', 'zoomIn', or 'cube3D' between major sections.
      - **PACE**: Professional but dynamic. 2-4s per scene. Every scene must feel alive with motion.
      """
      _ -> if style && is_binary(style) && String.length(style) > 0 do
        "STYLE HINT: #{style}. Default to motion-graphics-heavy editing with kineticText for headlines, particleBackground on layer 15, neonFrame on layer 17, and layered compositions with 3+ active layers per scene."
      else
        """
        AUTO-DETECT STYLE — Default to Premium Motion Graphics:
        - Use 'heroGradientText' for main titles, 'kineticText' for secondary headlines (pipe-separated words).
        - Use 'glassMorphCard' for feature highlights, 'floatingMockup' for product shots.
        - Use 'meshGradientBg' on layer 15 for rich animated gradient backgrounds.
        - Use 'neonFrame' on layer 17 for cinematic borders.
        - Use 'sweepingLight' for cinematic light streaks on transitions.
        - Camera: mix of slowZoom, dollyPan, orbit. Never static.
        - Transitions: glitchTransition, zoomIn, or fade between scenes.
        - Text: fontSize 56, fontWeight 800, white, stroke width 6, glow intensity 8.
        - ALWAYS have 5+ active layers per scene (gradient bg + border + content + text + effects).
        """
      end
    end

    """
    # AI VIDEO EDITOR — Remotion Composition Generator

    You are a professional video editor. Analyze the provided media and create a Remotion composition as a JSON object.

    ## MEDIA & SPECS

    #{media_context}

    - Duration: #{duration}s (#{duration * @default_fps} frames at #{@default_fps} FPS)
    - Aspect ratio: #{aspect_ratio || "16:9"}
    - FPS: #{@default_fps}

    #{style_guidance}

    ## EDITING APPROACH

    1. Analyze content type from transcript/media (commercial, viral, gaming, tutorial, vlog, etc.)
    2. Identify key moments from audio peaks and transcript excitement words
    3. Place effects strategically at those moments — effects should enhance, not distract
    4. Use transcript words EXACTLY for captions (do not paraphrase)
    5. Distribute effects across the ENTIRE duration — beginning, middle, AND end
    6. **COLOR CONSISTENCY**: If the user specifies colors in their prompt, use ONLY those colors throughout the entire video. If not specified, pick a cohesive 3-color palette (primary, secondary, accent) and stick to it for ALL tracks. Never use random colors per scene.

    ### CRITICAL: LAYERING & DEPTH RULES
    - **NEVER leave a scene with just a single layer.** Professional videos always have depth.
    - **Background (Layer 15)**: Use 'particleBackground' or 'gradientWave' at 0.3 opacity to add texture.
    - **Main Content (Layer 0)**: The video or image.
    - **Foreground Accents (Layer 17)**: Use 'neonFrame', 'floatingBadge', or 'animatedDivider'.
    - **Top Overlays (Layer 10-14)**: Kinetic text, captions, or title cards.
    - **Impact (Layer 20+)**: Short flashes or shakes on beat.

    ### FANCY TEXT & KINETIC TYPOGRAPHY
    - Use the 'kineticText' motion graphic template for major headlines. It animates word-by-word with spring physics.
    - For regular text tracks, use 'gradient', 'glow', and 'stroke' properties liberally.
    - Example Fancy Text: {"content":"EPIC REVEAL","gradient":{"enabled":true,"colors":["#fbbf24","#f59e0b"],"angle":45},"glow":{"intensity":12,"color":"#fbbf24"},"stroke":{"width":4,"color":"#000000"}}

    ### IDIOT-PROOF DEFAULTS
    If the user gives a vague or simple prompt (e.g. "make it look good", "edit this", "make it viral"):
    - Auto-detect the best style from the content (talking head → professional, gaming → hype, music → music_video)
    - Add captions from the transcript with bold TikTok styling
    - Add varied camera motion (mix of slowZoom, dollyPan, handheldShake with different intensities)
    - Add 2-4 scene transitions at natural break points
    - Add a subtle vignette shape overlay
    - Add impact effects at the loudest audio peaks
    - Apply a warm color grade (saturation 1.2, contrast 1.15)
    - Result should look like a professionally edited short-form video even with zero editing knowledge

    ### Audio Peak Rules
    If audio peaks are provided (TOP LOUDEST MOMENTS):
    - Place multi-effect combos at each peak timestamp
    - Amplitude > 0.7: flash + screenShake + radialGlow + particleBurst + punchZoom
    - Amplitude 0.4-0.7: screenShake + radialGlow + punchZoom
    - Amplitude 0.2-0.4: subtle slowZoom or dollyPan (alternate between them)

    ### Excitement Word Rules
    If excitement words are detected, place celebration effects (flash, glow, particles) when spoken.

    ### Caption Rules
    - Use EXACT transcript words, broken into 2-4 word chunks
    - Each caption: 1-2 seconds duration
    - Start within first 0.5s, continue through entire video
    - Position: x: 50, y: 85 (bottom center)
    - Default style: fontSize 56, fontWeight 800, white with black stroke (width 6)

    ### Safety Limits
    - Continuous shake: MAX 0.08 intensity
    - Impact shake: MAX 0.6 intensity, MAX 0.4s duration
    - Scene changes: MIN 2s intervals
    - Punch zoom: MAX 3-4 per video

    ## TRACK TYPES & LAYERS

    | Layer | Type | Description |
    |-------|------|-------------|
    | 0 | video/image | Main media with source path and filters |
    | 1-5 | cameraMotion | Zoom, pan, shake effects |
    | 6-9 | transition | Scene transitions |
    | 10-14 | text | Captions and text overlays |
    | 15-19 | shape | Visual overlays (vignettes, gradients) |
    | 20+ | impactFX | Flash, shake, glow, particles |

    ## AVAILABLE EFFECTS

    **Camera Motion** (cameraMotion track, properties.effects array):
    Types: handheldShake, slowZoom, punchZoom, dollyPan, orbit, dutchAngle, impactShake, parallax
    Fields: startTime, endTime, type, intensity, direction, easing

    **Transitions** (transition track, properties.transitions array):
    Types: cut, fade, slideLeft, slideRight, slideUp, slideDown, wipeLeft, wipeRight, wipeUp, wipeDown, diagonalWipe, spin, rotate180, rotate360, spiralIn, spiralOut, zoomIn, zoomOut, flipHorizontal, flipVertical, clockWipe, irisIn, irisOut, pixelate, glitchTransition, burn, liquidStreaks, liquidDrops, pageTurn, blinds, cube3D
    Fields: time, type, duration, direction

    **Impact FX** (impactFX track, properties.effects array):
    Types: flash, radialGlow, impactLines, chromaticAberration, glitch, lensFlare, lightRays, particleBurst, screenShake, freezeFrame, speedRamp, motionBlur, vignettePulse, colorFlash, distortionWave, rgbSplit, splitScreen, slice
    Fields: time, type, duration, intensity, color, axis, particleType, count

    **Text** (text track):
    Animations: fade, slide-up, slide-down, typewriter, bounce, scale-in, blur-in
    Fields: content, fontFamily, fontSize, fontWeight, color, strokeWidth, strokeColor, textAlign, animation

    **Motion Graphics** (motionGraphic track):
    Templates: lowerThird, subscribeCTA, logoReveal, titleCard, endScreen, numberCounter, progressBar, timerCountdown, neonFrame, particleBackground, kineticText, animatedInfoCard, dataCounter, calloutBox, splitReveal, glitchTitle, gradientWave, floatingBadge, animatedDivider, spotlightReveal
    Fields: templateId, variant, customText, customColors, animationSpeed, springConfig, perspective, rotateX, rotateY, blur, scale3D

    ### Advanced Motion Graphics Techniques (After Effects Quality)
    When the user asks for motion graphics, animated text, or professional-looking compositions, use these techniques:

    **Kinetic Typography** — Animate text with spring physics. Break sentences into individual words/characters, stagger their entrance with spring animations (mass: 1, damping: 12, stiffness: 100). Use scale-in + fade + slight Y-offset for each word.

    **3D Transforms** — Use perspective (800-1200px), rotateX/rotateY for card flips, depth reveals, and parallax layers. Combine with spring easing for organic motion.

    **Staggered Reveals** — When showing lists, stats, or multiple elements, stagger each item's entrance by 0.1-0.15s. Use spring animations with slight overshoot for a polished feel.

    **Data Visualization Motion** — Animate numbers counting up (0 → target), progress bars filling, pie charts drawing. Use interpolate() with easing for smooth value transitions.

    **Particle & Ambient Effects** — Floating particles, bokeh dots, light streaks as background layers. Use Math.sin/cos with frame-based offsets for organic floating motion.

    **Text Emphasis** — Scale-pulse on key words (1.0 → 1.15 → 1.0 over 10 frames), color shifts on emphasis, underline animations that draw left-to-right.

    **Scene Transitions as Motion Graphics** — Instead of simple cuts, use animated shape masks (circle wipe from center, diagonal slice, morphing shapes) between scenes.

    **Layered Compositions** — Stack multiple motion graphic tracks: background particles (layer 15), main content (layer 16), foreground accents (layer 17), text overlays (layer 18).

    **Spring Animation Configs** (use in springConfig field):
    - Snappy: { mass: 1, damping: 15, stiffness: 200 }
    - Bouncy: { mass: 1, damping: 10, stiffness: 150 }
    - Gentle: { mass: 1, damping: 20, stiffness: 80 }
    - Heavy: { mass: 2, damping: 18, stiffness: 120 }

    ## OUTPUT FORMAT

    Return ONLY a valid JSON object (no markdown, no comments).

    IMPORTANT: Each track type has a SPECIFIC properties structure. Follow these examples EXACTLY:

    ### Image/Video track example:
    {"id":"img-1","type":"image","name":"Screenshot","source":{"type":"local","path":"EXACT_PATH"},"startTime":0,"endTime":10,"layer":0,"properties":{"x":50,"y":50,"scale":0.85,"opacity":1}}

    ### Kinetic Text example (Layer 10):
    {"id":"mg-kt-1","type":"motionGraphic","name":"Kinetic Headline","startTime":0,"endTime":3,"layer":10,"properties":{"x":50,"y":50,"motionGraphic":{"templateId":"kineticText","customText":"STOP|MAKING|BORING|VIDEOS","customColors":["#ffffff","#fbbf24"],"springConfig":{"mass":1,"damping":12,"stiffness":120}}}}

    ### Complex Layered Scene example:
    [
      {"id":"bg-1","type":"motionGraphic","name":"Background","startTime":0,"endTime":5,"layer":15,"properties":{"motionGraphic":{"templateId":"particleBackground","customColors":["#1e1e2e"]}}},
      {"id":"img-1","type":"image","name":"Product Shot","source":{"path":"..."},"startTime":0,"endTime":5,"layer":0,"properties":{"x":50,"y":50,"scale":0.8}},
      {"id":"mg-frame","type":"motionGraphic","name":"Neon Border","startTime":0,"endTime":5,"layer":17,"properties":{"motionGraphic":{"templateId":"neonFrame","customColors":["#6366f1"]}}},
      {"id":"mg-title","type":"motionGraphic","name":"Headlines","startTime":0.5,"endTime":4.5,"layer":10,"properties":{"x":50,"y":50,"motionGraphic":{"templateId":"kineticText","customText":"NEW|AI|WORKFLOW","customColors":["#ffffff","#6366f1"]}}}
    ]

    ### Camera motion track example (MUST use properties.effects ARRAY):
    {"id":"cam-1","type":"cameraMotion","name":"Slow Zoom","startTime":0,"endTime":6,"layer":1,"properties":{"effects":[{"type":"slowZoom","startTime":0,"endTime":6,"intensity":0.3,"direction":"in"}]}}

    ### Impact FX track example (MUST use properties.effects ARRAY):
    {"id":"fx-1","type":"impactFX","name":"Flash","startTime":3,"endTime":3.5,"layer":20,"properties":{"effects":[{"type":"flash","time":3,"duration":0.3,"intensity":0.5}]}}

    ### Transition track example (MUST use properties.transitions ARRAY):
    {"id":"tr-1","type":"transition","name":"Fade","startTime":6,"endTime":7,"layer":6,"properties":{"transitions":[{"type":"fade","time":6,"duration":1}]}}

    ### Full composition wrapper:
    {
      "name": "Video Title",
      "duration": #{duration},
      "fps": #{@default_fps},
      "backgroundColor": "#000000",
      "tracks": [ ...tracks here... ]
    }

    ### Critical Rules
    - Use EXACT file paths from the media list (copy the Path: field verbatim)
    - All times in SECONDS in the JSON output
    - All x/y positions are percentages (0-100), center = 50
    - Text content MUST be nested: properties.text.content (NOT properties.content)
    - Motion graphic fields MUST be nested: properties.motionGraphic.templateId (NOT properties.templateId)
    - Camera/Impact/Transition effects MUST be in arrays: properties.effects[] or properties.transitions[]
    - Return ONLY the JSON object, nothing else
    """
  end

  # Scene-specific system prompt for OVERLAY tracks only (no video/image)
  defp build_scene_overlay_system_prompt(ctx) do
    style_guidance = build_style_guidance(ctx.style)

    """
    # AI VIDEO EDITOR — Scene Overlay Track Generator

    You are a professional video editor generating OVERLAY tracks for ONE scene of a larger composition.
    The base video/image tracks are already created separately — you must NOT create any video or image tracks.
    You will receive the scene's time range, description, and context about surrounding scenes.

    ## Video Specs
    - Aspect ratio: #{ctx.aspect_ratio || "16:9"}
    - FPS: #{@default_fps}

    #{style_guidance}

    ## EDITING RULES
    - Use transcript words EXACTLY for captions (do not paraphrase)
    - **COLOR CONSISTENCY**: Pick a cohesive palette and stick to it
    - Vary camera motion types — never repeat the same type twice in a row
    - Vary transition types — never repeat the same type twice in a row

    ### CRITICAL: LAYERING & DEPTH RULES
    - **NEVER leave a scene with just a single layer.** Professional videos always have depth.
    - **Background (Layer 15)**: 'meshGradientBg' (animated gradient) or 'particleBackground' (bokeh particles). Auto-added but you can override.
    - **Border (Layer 17)**: 'neonFrame' (cinematic border with animated corners). Auto-added.
    - **Main Content (Layer 0)**: The video or image.
    - **Premium Overlays (Layer 10-14)**: 'glassMorphCard' for frosted-glass feature cards, 'deviceMockup' for 3D app previews, 'floatingMockup' for floating product cards, 'heroGradientText' for gradient-filled hero titles, 'featureShowcase' for animated feature grids.
    - **Accent (Layer 18)**: 'sweepingLight' for cinematic light streaks, 'animatedUnderline' for text emphasis.
    - **Impact (Layer 20+)**: Short flashes or shakes on beat.

    ### FANCY TEXT & KINETIC TYPOGRAPHY
    - Use 'heroGradientText' for main hero titles (animated gradient fill, cinematic entrance).
    - Use 'kineticText' for secondary headlines (staggered word reveals with 3D rotateX).
    - Use 'glassMorphCard' for feature descriptions (frosted glass with backdrop-blur).
    - Use 'animatedUnderline' for emphasized single-line text.
    - For regular captions, use 'gradient', 'glow' (intensity 10-15), and 'stroke' (width 4-8).

    ### Safety Limits
    - Continuous shake: MAX 0.08 intensity
    - Impact shake: MAX 0.6 intensity, MAX 0.4s duration
    - Punch zoom: MAX 1-2 per scene

    ## ALLOWED TRACK TYPES & LAYERS (overlay only)
    | Layer | Type | Description |
    |-------|------|-------------|
    | 1-5 | cameraMotion | Zoom, pan, shake effects |
    | 6-9 | transition | Scene transitions |
    | 10-14 | text | Captions and text overlays |
    | 10-19 | motionGraphic | Kinetic text, title cards, info cards, badges, counters |
    | 20+ | impactFX | Flash, shake, glow, particles |

    ⚠️ FORBIDDEN: Do NOT generate tracks with type "video" or "image". Those are handled separately.
    ⚠️ Background (particleBackground) and border (neonFrame) tracks are ALREADY added automatically. Do NOT duplicate them.

    ## AVAILABLE EFFECTS

    **Camera Motion** (cameraMotion track, properties.effects array):
    Types: handheldShake, slowZoom, punchZoom, dollyPan, orbit, dutchAngle, impactShake, parallax
    Fields: startTime, endTime, type, intensity (0.05-0.5), direction (in/out/left/right), easing

    **Transitions** (transition track, properties.transitions array):
    Types: cut, fade, slideLeft, slideRight, slideUp, slideDown, wipeLeft, wipeRight, zoomIn, zoomOut, irisIn, irisOut, glitchTransition, cube3D
    Fields: time, type, duration (0.5-1.5s)

    **Impact FX** (impactFX track, properties.effects array):
    Types: flash, radialGlow, chromaticAberration, glitch, lensFlare, particleBurst, screenShake, freezeFrame, colorFlash, rgbSplit
    Fields: time, type, duration (0.2-0.5s), intensity (0.3-0.8), color

    **Text** (text track, properties.text object):
    Fields: content, fontFamily, fontSize (36-72), fontWeight (400-900), color, textAlign, animation ({type, duration}), stroke ({width, color}), glow ({intensity, color}), gradient ({enabled, colors, angle})

    **Motion Graphics** (motionGraphic track, properties.motionGraphic object):
    PREMIUM Templates (use these for high-end SaaS/promo look):
    - glassMorphCard: Frosted glass card with backdrop-blur. customText: "Title|Description|CTA". 3D entrance.
    - deviceMockup: 3D floating device/laptop frame. customText: "App Name". Continuous 3D rotation.
    - meshGradientBg: Animated multi-color gradient background. customColors: ["#6366f1","#ec4899","#06b6d4","#000000"]. Use on layer 15.
    - heroGradientText: Large text with animated gradient fill. customText: "HERO|SUBTITLE". Cinematic entrance.
    - featureShowcase: Staggered grid of feature cards. customText: "Fast|Secure|Scalable|Beautiful".
    - floatingMockup: 3D floating product card with glow. customText: "Product|Tagline|CTA Button".
    - sweepingLight: Cinematic light streak across screen. Use on layer 18 for transitions.
    - animatedUnderline: Text with expanding gradient underline. customText: "Emphasized Text".
    Standard Templates: kineticText, titleCard, animatedInfoCard, dataCounter, calloutBox, floatingBadge, glitchTitle, splitReveal, gradientWave, animatedDivider, spotlightReveal, lowerThird, subscribeCTA, numberCounter
    Fields: templateId, customText (pipe-separated: "WORD1|WORD2|WORD3"), customColors (array of hex), animationSpeed, springConfig ({mass, damping, stiffness})

    ## OUTPUT FORMAT
    Return ONLY a valid JSON object: {"tracks": [...]}

    ### Track examples (COPY THESE STRUCTURES EXACTLY):

    KineticText (headline with staggered word animation):
    {"id":"s0-mg-1","type":"motionGraphic","name":"Headline","startTime":0,"endTime":3,"layer":12,"properties":{"x":50,"y":30,"motionGraphic":{"templateId":"kineticText","customText":"STOP|MAKING|BORING|VIDEOS","customColors":["#ffffff","#fbbf24"],"springConfig":{"mass":1,"damping":12,"stiffness":120}}}}

    Text caption (bold TikTok style):
    {"id":"s0-txt-1","type":"text","name":"Caption","startTime":0,"endTime":2,"layer":10,"properties":{"x":50,"y":85,"text":{"content":"exact transcript words","fontFamily":"Inter, sans-serif","fontSize":56,"fontWeight":800,"color":"#ffffff","textAlign":"center","animation":{"type":"scale-in","duration":0.3},"stroke":{"width":6,"color":"#000000"},"glow":{"intensity":8,"color":"#fbbf24"}}}}

    Camera motion:
    {"id":"s0-cam-1","type":"cameraMotion","name":"Zoom","startTime":0,"endTime":5,"layer":1,"properties":{"effects":[{"type":"slowZoom","startTime":0,"endTime":5,"intensity":0.25,"direction":"in"}]}}

    Impact FX combo (on audio peak):
    {"id":"s0-fx-1","type":"impactFX","name":"Peak Hit","startTime":2,"endTime":2.5,"layer":20,"properties":{"effects":[{"type":"flash","time":2,"duration":0.3,"intensity":0.5},{"type":"screenShake","time":2,"duration":0.4,"intensity":0.4}]}}

    Transition:
    {"id":"s0-tr-1","type":"transition","name":"Fade In","startTime":0,"endTime":1,"layer":6,"properties":{"transitions":[{"type":"fade","time":0,"duration":1}]}}

    AnimatedInfoCard (for facts/features):
    {"id":"s0-mg-2","type":"motionGraphic","name":"Feature Card","startTime":1,"endTime":4,"layer":11,"properties":{"x":50,"y":60,"motionGraphic":{"templateId":"animatedInfoCard","customText":"10x Faster Editing","customColors":["#6366f1","#ffffff"],"animationSpeed":1}}}

    GlassMorphCard (frosted glass feature card — PREMIUM):
    {"id":"s0-mg-3","type":"motionGraphic","name":"Glass Card","startTime":0,"endTime":4,"layer":12,"properties":{"x":50,"y":50,"motionGraphic":{"templateId":"glassMorphCard","customText":"AI-Powered|Automatically detect and extract the best moments from any video|LEARN MORE","customColors":["#6366f1","#ffffff","#a855f7"]}}}

    HeroGradientText (animated gradient hero title — PREMIUM):
    {"id":"s0-mg-4","type":"motionGraphic","name":"Hero Title","startTime":0,"endTime":3,"layer":13,"properties":{"x":50,"y":40,"motionGraphic":{"templateId":"heroGradientText","customText":"THE FUTURE|OF VIDEO EDITING","customColors":["#6366f1","#ec4899","#f59e0b"]}}}

    FloatingMockup (3D floating product card — PREMIUM):
    {"id":"s0-mg-5","type":"motionGraphic","name":"Product Card","startTime":1,"endTime":5,"layer":11,"properties":{"x":50,"y":50,"motionGraphic":{"templateId":"floatingMockup","customText":"Clippster Pro|Create stunning videos in minutes|Get Started","customColors":["#6366f1","#ffffff","#0f0f1a"]}}}

    SweepingLight (cinematic light streak — PREMIUM):
    {"id":"s0-mg-6","type":"motionGraphic","name":"Light Sweep","startTime":0,"endTime":2,"layer":18,"properties":{"motionGraphic":{"templateId":"sweepingLight","customColors":["#ffffff","#6366f1"]}}}

    ### Critical Rules
    - ⚠️ NEVER generate "video" or "image" type tracks
    - All times in SECONDS
    - All x/y positions are percentages (0-100), center = 50
    - Text MUST be nested: properties.text.content
    - Motion graphic MUST be nested: properties.motionGraphic.templateId
    - Camera/Impact/Transition effects MUST be in arrays
    - Return ONLY the JSON object, nothing else
    """
  end

  defp build_style_guidance(style) do
    base = case style do
      "hype" ->
        "STYLE: Hype/Viral/Hormozi. Use heroGradientText for main title, kineticText for secondary headlines. flash+screenShake+particleBurst on peaks. sweepingLight on transitions. Bold captions: fontSize 56, fontWeight 900, white, stroke 6-8, glow 10. Camera: punchZoom on peaks, handheldShake 0.05. Pick ONE accent color for all graphics."
      "professional" ->
        "STYLE: Professional/Corporate. Use animatedInfoCard for facts, animatedDivider between sections. Elegant text: fontSize 42, fontWeight 500, subtle shadow. Camera: slowZoom only. Transitions: fade. No shake."
      "gaming" ->
        "STYLE: Gaming Montage. Use kineticText for callouts, flash+screenShake on kills. Bold captions with glow. Camera: punchZoom+handheldShake. Neon accent colors."
      "cinematic" ->
        "STYLE: Cinematic. Slow deliberate camera (slowZoom, dollyPan). Use titleCard for scene intros. Letterbox feel. Rich shadows. Minimal but impactful effects."
      "tutorial" ->
        "STYLE: Tutorial. Use calloutBox for tips, animatedInfoCard for steps. Clean captions. Camera: gentle slowZoom. Minimal effects."
      "vlog" ->
        "STYLE: Vlog/Story. Natural handheldShake 0.04. Warm tones. Use floatingBadge for labels. Minimal effects, let content shine."
      "music_video" ->
        "STYLE: Music Video. Beat-synced transitions. Use glitchTitle, splitReveal, gradientWave. Heavy creative effects. Camera synced to rhythm."
      "product" ->
        "STYLE: Premium SaaS/Motion Graphics Promo. Use heroGradientText for hero titles, glassMorphCard for feature cards, deviceMockup for app previews, floatingMockup for product cards, featureShowcase for feature grids. meshGradientBg on layer 15. sweepingLight on layer 18. 3D parallax camera (orbit). Pick ONE brand color for all customColors."
      s when is_binary(s) and byte_size(s) > 0 ->
        "STYLE: #{s}"
      _ ->
        "STYLE: Auto-detect. Default to premium motion-graphics style: heroGradientText for titles, glassMorphCard for features, meshGradientBg backgrounds, sweepingLight accents, and 5+ layered compositions."
    end

    base <> "\n\nMINIMUM REQUIREMENTS PER SCENE: At least 2 motionGraphic tracks (use PREMIUM templates: heroGradientText, glassMorphCard, floatingMockup, featureShowcase, deviceMockup, sweepingLight, animatedUnderline — plus kineticText, animatedInfoCard) + 1 cameraMotion track + 1 transition at scene boundaries. Never output a scene with fewer than 3 overlay tracks."
  end

  defp parse_composition_response_from_content(content, width, height, duration) do
    # Try to extract JSON from markdown code blocks if present
    json_content = case Regex.run(~r/```(?:json)?\s*(\{.*\})\s*```/s, content) do
      [_, json] -> json
      _ -> content
    end

    cleaned_json = extract_first_json_object(json_content)

    case Jason.decode(cleaned_json) do
      {:ok, composition} ->
        ai_duration = Map.get(composition, "duration", duration)
        tracks = Map.get(composition, "tracks", [])
        max_track_end = Enum.reduce(tracks, 0, fn track, acc ->
          end_time = Map.get(track, "endTime", 0)
          max(acc, end_time)
        end)
        effective_duration = Enum.max([duration, ai_duration, max_track_end])

        composition = Map.merge(composition, %{
          "id" => Ecto.UUID.generate(),
          "width" => width,
          "height" => height,
          "aspectRatio" => calculate_aspect_ratio(width, height),
          "duration" => effective_duration,
          "fps" => @default_fps
        })

        {:ok, composition}

      {:error, reason} ->
        Logger.error("Failed to parse composition JSON: #{inspect(reason)}")
        Logger.error("Raw AI content (first 2000 chars): #{String.slice(content, 0, 2000)}")
        Logger.error("Cleaned JSON (first 2000 chars): #{String.slice(cleaned_json, 0, 2000)}")
        {:error, "Invalid composition format: #{inspect(reason)}"}
    end
  end

  # Extract the first complete JSON array from a string
  defp extract_first_json_array(content) do
    # Try markdown code block first
    cleaned = case Regex.run(~r/```(?:json)?\s*(\[.*\])\s*```/s, content) do
      [_, json] -> json
      _ -> content
    end

    # Find the first opening bracket
    case String.split(cleaned, "[", parts: 2) do
      [_, rest] ->
        extract_json_with_bracket_counting("[" <> rest)
      _ ->
        cleaned
    end
  end

  defp extract_json_with_bracket_counting(content) do
    content
    |> String.graphemes()
    |> Enum.reduce_while({0, 0, false, false, []}, fn char, {bracket_depth, brace_depth, in_string, escaped, acc} ->
      new_acc = [char | acc]

      cond do
        escaped ->
          {:cont, {bracket_depth, brace_depth, in_string, false, new_acc}}
        char == "\\" and in_string ->
          {:cont, {bracket_depth, brace_depth, in_string, true, new_acc}}
        char == "\"" ->
          {:cont, {bracket_depth, brace_depth, !in_string, false, new_acc}}
        in_string ->
          {:cont, {bracket_depth, brace_depth, in_string, false, new_acc}}
        char == "[" ->
          {:cont, {bracket_depth + 1, brace_depth, in_string, false, new_acc}}
        char == "]" ->
          new_depth = bracket_depth - 1
          if new_depth == 0 and brace_depth == 0 do
            {:halt, {new_depth, brace_depth, in_string, false, new_acc}}
          else
            {:cont, {new_depth, brace_depth, in_string, false, new_acc}}
          end
        char == "{" ->
          {:cont, {bracket_depth, brace_depth + 1, in_string, false, new_acc}}
        char == "}" ->
          {:cont, {bracket_depth, brace_depth - 1, in_string, false, new_acc}}
        true ->
          {:cont, {bracket_depth, brace_depth, in_string, false, new_acc}}
      end
    end)
    |> elem(4)
    |> Enum.reverse()
    |> Enum.join()
  end

  # Extract the first complete JSON object from a string
  # Handles cases where AI adds extra text after the JSON
  defp extract_first_json_object(content) do
    # Find the first opening brace
    case String.split(content, "{", parts: 2) do
      [_, rest] ->
        # Count braces to find the matching closing brace
        extract_json_with_brace_counting("{" <> rest)
      _ ->
        content
    end
  end

  defp extract_json_with_brace_counting(content) do
    # Track whether we're inside a JSON string to avoid counting braces in string values
    content
    |> String.graphemes()
    |> Enum.reduce_while({0, false, false, []}, fn char, {depth, in_string, escaped, acc} ->
      new_acc = [char | acc]
      
      cond do
        # Previous char was a backslash — this char is escaped, skip it
        escaped ->
          {:cont, {depth, in_string, false, new_acc}}
        
        # Backslash — next char is escaped
        char == "\\" and in_string ->
          {:cont, {depth, in_string, true, new_acc}}
        
        # Quote toggles string mode
        char == "\"" ->
          {:cont, {depth, !in_string, false, new_acc}}
        
        # Inside a string — don't count braces
        in_string ->
          {:cont, {depth, in_string, false, new_acc}}
        
        # Outside string — count braces
        char == "{" ->
          new_depth = depth + 1
          {:cont, {new_depth, in_string, false, new_acc}}
        
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

  defp calculate_aspect_ratio(1920, 1080), do: "16:9"
  defp calculate_aspect_ratio(1080, 1920), do: "9:16"
  defp calculate_aspect_ratio(1080, 1080), do: "1:1"
  defp calculate_aspect_ratio(1080, 1350), do: "4:5"
  defp calculate_aspect_ratio(_, _), do: "16:9"
end
