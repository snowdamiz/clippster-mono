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
  @model "anthropic/claude-opus-4.6"

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

        # Phase 2: Generate OVERLAY tracks for each scene (text, camera, effects, transitions)
        all_overlay_tracks = Enum.reduce_while(scenes, {:ok, []}, fn scene, {:ok, acc} ->
          case generate_scene_overlay_tracks(ctx, scene, scenes, api_key) do
            {:ok, tracks} -> {:cont, {:ok, acc ++ tracks}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)

        case all_overlay_tracks do
          {:ok, overlay_tracks} ->
            # Phase 3: Merge base media + overlay tracks into final composition
            {:ok, build_final_composition(ctx, base_media_tracks ++ overlay_tracks)}
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
            composition = build_final_composition(ctx, base_media_tracks ++ overlay_tracks)
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
            "scale" => 1,
            "opacity" => 1
          }
        }
      end)
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
    - Time range: #{scene_start}s to #{scene_end}s (#{scene_end - scene_start}s duration)
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

    ## CRITICAL Rules for THIS Scene
    - DO NOT generate video or image tracks — those are already created separately
    - All track startTime/endTime MUST be within #{scene_start}s to #{scene_end}s
    - Generate ONLY: text captions, camera motion, transitions, impact FX, motion graphics
    - Track IDs must be prefixed with "s#{scene_index}-" (e.g. "s#{scene_index}-txt-1", "s#{scene_index}-cam-1")
    - If this is the first scene (#{scene_start}s), include an intro transition
    - If this is the last scene (ends at #{ctx.duration}s), include an outro
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
      "temperature" => 0.5
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

    intensity_context = build_intensity_context(intensity)
    caption_context = build_caption_context(caption_style)

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
      caption_context: caption_context
    }
  end

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
      STYLE PRESET: Hype/Viral
      - Fast-paced, high energy editing
      - Bold captions (70-80% coverage), large text with black stroke
      - Impact effects on every audio peak and excitement word
      - Vibrant color grading: saturation 1.35, contrast 1.25
      - Camera: handheldShake 0.06, frequent punchZoom
      - Effect budget: 10-15 effects + 4-6 transitions
      """
      "professional" -> """
      STYLE PRESET: Professional/Clean
      - Polished, corporate aesthetic
      - Clean captions (50-60% coverage), readable font
      - Smooth slow zooms, minimal shake (0.03)
      - Warm color grading: saturation 1.15, contrast 1.15
      - Effect budget: 4-8 effects + 2-4 transitions
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
      STYLE PRESET: Product Showcase / SaaS Promo
      - Premium, clean aesthetic with consistent visual identity
      - Orbit camera motions, slow reveals, smooth transitions
      - Rich motion graphics: titleCard, kineticText, animatedInfoCard, dataCounter, floatingBadge
      - Professional color: saturation 1.15, contrast 1.15
      - Effect budget: 10-15 effects + 4-6 transitions
      
      ABSOLUTE RULES — FOLLOW EXACTLY OR THE VIDEO WILL BE REJECTED:
      1. COLOR LOCK: If the user specifies hex colors, copy them VERBATIM into every customColors array. Do NOT invent new colors. Do NOT substitute similar colors. Use the EXACT hex values from the prompt.
      2. COUNTER VALUES: If the user specifies a dataCounter value like "0|Clips Made|", output EXACTLY "0" — do NOT change it to 100 or any other number. Copy the user's values character-for-character.
      3. NO BLACK GAPS: Every second of the video must have visible content. If an image ends at time X, the next image or motion graphic must start at or before time X. Add particleBackground or gradientWave to fill any gaps.
      4. USE ALL IMAGES: If the user provides N images, ALL N must appear as image tracks in the output. Do not skip any.
      5. NEON BORDERS: Add neonFrame motion graphics around image showcase scenes for animated borders.
      6. ANIMATED BACKGROUNDS: Use particleBackground and gradientWave liberally as background layers (layer 1 or 15) behind images — not just during transitions.
      7. TEXT: Copy the user's customText strings EXACTLY. Do not rephrase, reword, or add words.
      """
      _ -> if style && String.length(style) > 0 do
        "STYLE HINT: #{style}"
      else
        "AUTO-DETECT: Analyze the transcript and media to determine the best editing style."
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

    ### CRITICAL: VARIETY RULES (NEVER REPEAT THE SAME EFFECT)
    - **NEVER use the same camera motion type more than 2 times in a row.** Alternate between slowZoom, dollyPan, handheldShake, orbit, parallax, dutchAngle, etc.
    - **NEVER use the same transition type more than once in a row.** Cycle through fade, slideLeft, wipeRight, zoomIn, irisIn, etc.
    - **Vary intensity across effects.** If one zoom is 0.3, the next should be 0.5 or 0.15 — not the same value.
    - **Vary direction.** Alternate zoom in/out, pan left/right, slide up/down.
    - **Each camera motion segment should be 3-8 seconds long**, not the entire video duration.
    - **Mix calm and energetic sections.** A good edit has rhythm: build-up → peak → breathe → build-up → peak.
    - Example good camera motion sequence: slowZoom(in) → dollyPan(right) → handheldShake → punchZoom → orbit → slowZoom(out) → parallax
    - Example BAD camera motion (DO NOT DO THIS): slowZoom → slowZoom → slowZoom → slowZoom

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

    ### Text track example (MUST nest under properties.text):
    {"id":"txt-1","type":"text","name":"Caption","startTime":0,"endTime":3,"layer":10,"properties":{"x":50,"y":85,"text":{"content":"Your text here","fontFamily":"Inter, sans-serif","fontSize":56,"fontWeight":800,"color":"#ffffff","textAlign":"center","animation":{"type":"fade","duration":0.3},"stroke":{"width":6,"color":"#000000"}}}}

    ### Motion graphic track example (MUST nest under properties.motionGraphic):
    {"id":"mg-1","type":"motionGraphic","name":"Title Card","startTime":0,"endTime":4,"layer":17,"properties":{"x":50,"y":50,"motionGraphic":{"templateId":"titleCard","customText":"Main Title|Subtitle","customColors":["rgba(0,0,0,0.8)","#ffffff"],"animationSpeed":1}}}

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

    ### Audio Peak Rules
    If audio peaks are provided:
    - Amplitude > 0.7: flash + screenShake + radialGlow + particleBurst + punchZoom
    - Amplitude 0.4-0.7: screenShake + radialGlow + punchZoom
    - Amplitude 0.2-0.4: subtle slowZoom or dollyPan

    ### Caption Rules
    - Use EXACT transcript words, broken into 2-4 word chunks
    - Each caption: 1-2 seconds duration
    - Position: x: 50, y: 85 (bottom center)
    - Default style: fontSize 56, fontWeight 800, white with black stroke (width 6)

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
    | 15-19 | shape | Visual overlays (vignettes, gradients) |
    | 20+ | impactFX | Flash, shake, glow, particles |

    ⚠️ FORBIDDEN: Do NOT generate tracks with type "video" or "image". Those are handled separately.

    ## AVAILABLE EFFECTS

    **Camera Motion** (cameraMotion track, properties.effects array):
    Types: handheldShake, slowZoom, punchZoom, dollyPan, orbit, dutchAngle, impactShake, parallax

    **Transitions** (transition track, properties.transitions array):
    Types: cut, fade, slideLeft, slideRight, slideUp, slideDown, wipeLeft, wipeRight, zoomIn, zoomOut, irisIn, irisOut, glitchTransition, cube3D

    **Impact FX** (impactFX track, properties.effects array):
    Types: flash, radialGlow, chromaticAberration, glitch, lensFlare, particleBurst, screenShake, freezeFrame, colorFlash, rgbSplit

    **Text** (text track): content, fontFamily, fontSize, fontWeight, color, strokeWidth, strokeColor, textAlign, animation
    **Motion Graphics** (motionGraphic track): templateId, variant, customText, customColors, animationSpeed

    ## OUTPUT FORMAT
    Return ONLY a valid JSON object: {"tracks": [...]}

    ### Track examples (overlay types only):
    Text: {"id":"s0-txt-1","type":"text","name":"Caption","startTime":0,"endTime":2,"layer":10,"properties":{"x":50,"y":85,"text":{"content":"Words here","fontFamily":"Inter, sans-serif","fontSize":56,"fontWeight":800,"color":"#ffffff","textAlign":"center","animation":{"type":"fade","duration":0.3},"stroke":{"width":6,"color":"#000000"}}}}
    Camera: {"id":"s0-cam-1","type":"cameraMotion","name":"Zoom","startTime":0,"endTime":5,"layer":1,"properties":{"effects":[{"type":"slowZoom","startTime":0,"endTime":5,"intensity":0.3,"direction":"in"}]}}
    Impact: {"id":"s0-fx-1","type":"impactFX","name":"Flash","startTime":2,"endTime":2.5,"layer":20,"properties":{"effects":[{"type":"flash","time":2,"duration":0.3,"intensity":0.5}]}}
    Transition: {"id":"s0-tr-1","type":"transition","name":"Fade","startTime":0,"endTime":1,"layer":6,"properties":{"transitions":[{"type":"fade","time":0,"duration":1}]}}
    MotionGraphic: {"id":"s0-mg-1","type":"motionGraphic","name":"Title","startTime":0,"endTime":3,"layer":17,"properties":{"x":50,"y":50,"motionGraphic":{"templateId":"titleCard","customText":"Title","customColors":["#000000","#ffffff"],"animationSpeed":1}}}

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
    case style do
      "hype" -> "STYLE: Hype/Viral — Fast-paced, bold captions, impact effects on peaks, vibrant colors"
      "professional" -> "STYLE: Professional — Polished, clean captions, smooth zooms, warm color grade"
      "gaming" -> "STYLE: Gaming — Dynamic camera, impact effects on action, bold captions"
      "cinematic" -> "STYLE: Cinematic — Film-like, slow camera movements, rich color grade"
      "tutorial" -> "STYLE: Tutorial — Clear pacing, clean captions, minimal effects"
      "vlog" -> "STYLE: Vlog — Natural feel, subtle shake, warm tones"
      "music_video" -> "STYLE: Music Video — Beat-synced, heavy transitions, creative effects"
      "product" -> "STYLE: Product Showcase — Premium aesthetic, motion graphics, smooth reveals"
      s when is_binary(s) and byte_size(s) > 0 -> "STYLE: #{s}"
      _ -> "STYLE: Auto-detect from content"
    end
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
