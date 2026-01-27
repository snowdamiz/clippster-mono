defmodule ClippsterServer.AI.VideoComposer do
  @moduledoc """
  AI-powered video composition generator using OpenRouter API.
  Analyzes media and prompt to create a complete video composition with tracks, timing, and effects.
  """

  require Logger

  @default_fps 30
  @default_duration 10

  def generate(prompt, media, style, target_duration, aspect_ratio, user, existing_composition \\ nil) do
    Logger.info("Generating AI video composition for user #{user.id}")

    # Build context about available media
    media_context = build_media_context(media)

    # Determine video dimensions based on aspect ratio
    {width, height} = get_dimensions(aspect_ratio || "16:9")

    # Calculate target duration
    duration = target_duration || calculate_duration(media)

    # Create system prompt
    system_prompt = build_system_prompt(media_context, duration, aspect_ratio, style)

    # Build existing composition context if provided
    existing_context = if existing_composition do
      """
      
      EXISTING COMPOSITION TO MODIFY:
      #{Jason.encode!(existing_composition, pretty: true)}
      
      IMPORTANT: Modify the existing composition based on the user's request. Keep existing tracks unless the user asks to remove or change them.
      """
    else
      ""
    end

    # Create user prompt
    user_prompt = """
    Create a video composition based on this request:

    #{prompt}

    Available media:
    #{media_context}

    Target duration: #{duration} seconds
    Aspect ratio: #{aspect_ratio || "16:9"}
    #{if style, do: "Style: #{style}", else: ""}
    #{existing_context}
    """

    # Call OpenRouter API directly
    api_key = System.get_env("OPENROUTER_API_KEY")
    
    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY not configured"}
    else
      payload = %{
        "model" => "qwen/qwen-2.5-72b-instruct",
        "messages" => [
          %{"role" => "system", "content" => system_prompt},
          %{"role" => "user", "content" => user_prompt}
        ],
        "max_tokens" => 4000,
        "temperature" => 0.6
      }
      
      headers = [
        {"Authorization", "Bearer #{api_key}"},
        {"Content-Type", "application/json"},
        {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
        {"X-Title", "Clippster AI Video Creator"}
      ]
      
      case HTTPoison.post(
        "https://openrouter.ai/api/v1/chat/completions",
        Jason.encode!(payload),
        headers,
        recv_timeout: 120_000
      ) do
        {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
          case Jason.decode(body) do
            {:ok, response} ->
              parse_composition_response(response, width, height, duration)
            {:error, reason} ->
              {:error, "Failed to parse response: #{inspect(reason)}"}
          end
          
        {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
          {:error, "API error #{status}: #{body}"}
          
        {:error, %HTTPoison.Error{reason: reason}} ->
          {:error, "Network error: #{inspect(reason)}"}
      end
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
      waveform = Map.get(item, "waveform")
      audio_peaks = Map.get(item, "audioPeaks")
      
      # Get the actual file path from source
      source = Map.get(item, "source", %{})
      path = Map.get(source, "path", "")

      info = [
        "#{index}. #{name} (#{type})",
        "ID: #{id}",
        "Path: #{path}"
      ]

      info = if duration, do: info ++ ["Duration: #{Float.round(duration, 2)}s"], else: info
      info = if dimensions do
        info ++ ["Size: #{dimensions["width"]}x#{dimensions["height"]}"]
      else
        info
      end
      
      # Add transcript if available
      info = if transcript && is_binary(transcript) && String.length(transcript) > 0 do
        info ++ ["Transcript: #{transcript}"]
      else
        info
      end
      
      # Add audio peak info if available
      info = if audio_peaks && is_list(audio_peaks) && length(audio_peaks) > 0 do
        peak_count = length(audio_peaks)
        peak_times = audio_peaks |> Enum.take(5) |> Enum.map(&Map.get(&1, "time")) |> Enum.join(", ")
        info ++ ["Audio Peaks: #{peak_count} detected (first 5 at: #{peak_times}s)"]
      else
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

    min(max(total, 5), 60)  # Between 5 and 60 seconds
  end

  defp calculate_duration(_), do: @default_duration

  defp get_dimensions("16:9"), do: {1920, 1080}
  defp get_dimensions("9:16"), do: {1080, 1920}
  defp get_dimensions("1:1"), do: {1080, 1080}
  defp get_dimensions("4:5"), do: {1080, 1350}
  defp get_dimensions(_), do: {1920, 1080}

  defp build_system_prompt(media_context, duration, aspect_ratio, style) do
    """
    # INTELLIGENT AI VIDEO EDITOR - CONTEXT-AWARE PROFESSIONAL EDITING
    
    You are an elite video editor with deep understanding of storytelling, pacing, and visual language.
    You create compositions for Remotion, a React-based video framework.
    Your mission: Analyze the content and create edits that MAKE SENSE for the specific use case.
    
    ## CORE PHILOSOPHY
    
    **THINK FIRST, THEN EDIT**
    1. Analyze the content type (commercial, viral clip, tutorial, gaming, etc.)
    2. Understand the emotional arc and key moments from transcript/audio peaks
    3. Apply effects that ENHANCE the story, not distract from it
    4. Less is more - strategic effects beat constant bombardment
    
    ## AVAILABLE DATA
    
    #{media_context}
    
    **Target Specifications:**
    - Duration: #{duration} seconds (#{duration * @default_fps} frames at #{@default_fps} FPS)
    - Aspect ratio: #{aspect_ratio}
    - FPS: #{@default_fps}
    #{if style, do: "- Style Hint: #{style}", else: ""}
    
    ## REMOTION BEST PRACTICES (CRITICAL)
    
    ### Frame-Based Timing
    - Remotion works in FRAMES, not seconds
    - Use frame numbers: 0, 30, 60, 90 (at 30fps)
    - Convert seconds to frames: seconds * #{@default_fps}
    - Example: 2.5s = 75 frames
    
    ### Component Structure
    - Use `<Sequence>` for time-based positioning
    - Use `<Series>` for sequential content
    - Use `<AbsoluteFill>` for layering
    - Use `interpolate()` for smooth animations
    - Use `spring()` for natural motion (damping: 200)
    
    ### Animation Principles
    - `useCurrentFrame()` returns current frame number (starts at 0)
    - `interpolate(frame, [0, 30], [0, 1])` maps frame range to value range
    - Always add `extrapolateLeft: 'clamp'` and `extrapolateRight: 'clamp'`
    - Spring animations: `spring({frame, fps, config: {damping: 200}})`
    
    ## STEP 1: CONTENT TYPE DETECTION
    
    Analyze the transcript and media to determine content type:
    
    ### Commercial/Product Showcase
    **Indicators**: Product names, features, benefits, professional tone
    **Editing Style**:
    - Clean, professional aesthetic
    - Smooth slow zooms (0.15 intensity)
    - Minimal shake (0.03 handheld feel)
    - Strategic pauses for information absorption
    - Effects: 3-5 total, all purposeful
    - Color: Warm, professional (saturation 1.15, contrast 1.15)
    
    ### Viral TikTok/Shorts
    **Indicators**: Casual language, reactions, under 60s
    **Editing Style**:
    - Fast-paced (scene change every 2-3s)
    - Strong 3-second hook
    - Impact effects at genuine surprises
    - Bold captions throughout (70-80% coverage)
    - Vibrant color (saturation 1.35, contrast 1.25)
    - Effects: 8-12 total, high energy
    
    ### Informational/Tutorial
    **Indicators**: "How to", steps, explanations
    **Editing Style**:
    - Clear, easy-to-follow pacing
    - Slow zooms to emphasize key points
    - Minimal distracting effects
    - Clean captions for important info (60-70% coverage)
    - Neutral color (saturation 1.1, contrast 1.1)
    - Effects: 2-4 total, functional only
    
    ### Gaming Highlight
    **Indicators**: Game terminology, kills, wins, reactions
    **Editing Style**:
    - Dynamic camera motion
    - Impact effects on eliminations/wins
    - Freeze frames on clutch moments
    - Vibrant gaming aesthetic
    - Effects: 6-10 total, action-focused
    
    ### Gambling/Casino
    **Indicators**: Bets, wins, losses, dollar amounts
    **Editing Style**:
    - Slow zooms during suspense
    - Explosive effects on reveals
    - Gold highlights on money amounts
    - Dramatic color shifts
    - Effects: 5-8 total, drama-focused
    
    ### Vlog/Personal Story
    **Indicators**: Personal pronouns, storytelling, casual tone
    **Editing Style**:
    - Natural, authentic feel
    - Subtle camera motion (0.04 handheld)
    - Minimal effects (let story shine)
    - Warm color grade
    - Effects: 2-5 total, story-supporting
    
    ## STEP 2: INTELLIGENT MOMENT DETECTION
    
    ### Analyze Transcript Context
    - **Big reveal**: "And the winner is...", "I got the job!"
    - **Emotional peak**: "I can't believe it", "This is insane"
    - **Important info**: Dollar amounts, statistics, key facts
    - **Transitions**: "But then...", "However..."
    - **Call-to-action**: "Click the link", "Subscribe"
    
    ### Audio Peak Intelligence (if provided)
    - **Loud + excited words** = Genuine reaction (use impact effects)
    - **Loud + silence before** = Dramatic reveal (use flash + zoom)
    - **Loud + technical explanation** = Emphasis (subtle zoom only)
    - **Loud + background noise** = Ignore (not a key moment)
    
    ### Effect Selection Logic
    - Don't apply effects at EVERY peak
    - Only apply when it makes SENSE for the content
    - Ask: "Does this enhance the story?"
    - Ask: "Is this a genuinely important moment?"
    - Ask: "Will this distract from the message?"
    
    ## STEP 3: MOTION SICKNESS PREVENTION (CRITICAL SAFETY)
    
    ### Camera Movement Limits
    - Continuous shake: MAX 0.08 intensity
    - Impact shake: MAX 0.6 intensity, MAX 0.4s duration
    - Zoom speed: Slow 0.1-0.3 over 2-4s, Punch 0.4-0.6 over 0.2-0.4s
    - Pan speed: MAX 0.3 intensity, MIN 1s duration
    - Dutch angle: MAX 15°, use rarely
    - NO head bobbing effects
    - NO rapid FOV changes
    
    ### Pacing Limits
    - Scene changes: MIN 2s intervals (no faster)
    - Allow breathing room between intense moments
    - Strategic pauses prevent sensory overload
    
    ## CAPTION STRATEGY
    
    ## Transcript Usage (MOST IMPORTANT)
    - If transcript is provided in media, use the EXACT words from the transcript
    - DO NOT make up dialogue or paraphrase - use the actual spoken words
    - Break transcript into 2-4 word chunks that match natural speech rhythm
    - Time each caption to appear when those words are spoken
    
    ## Caption Timing
    - Each caption should display for 1-2 seconds (30-60 frames)
    - Spread captions throughout the ENTIRE video duration
    - Start captions early (within first 0.5 seconds)
    - Continue adding captions until the end of the video
    - Use startTime and endTime in seconds (not frames)
    
    
    ### IF Transcript Provided:
    
    **Commercial/Product**:
    - Key features and benefits only
    - Clean, professional font
    - 50-60% coverage (don't overwhelm)
    - Highlight product names, prices, CTAs
    
    **Viral/TikTok**:
    - 70-80% coverage
    - Bold, large text
    - Money amounts → Gold (#FFD700, size 72, weight 900)
    - Reactions (wow, omg, insane) → Red (#FF4444, size 68, weight 900)
    - Regular text → White (#FFFFFF, size 56, weight 800)
    - ALL captions → Black stroke (width 6)
    
    **Tutorial/Educational**:
    - Steps and key instructions
    - 60-70% coverage
    - Clean, readable font
    - Highlight important terms
    
    **Gaming**:
    - Callouts, reactions, key plays
    - 40-50% coverage (don't block action)
    - Bold for hype moments
    
    ### IF NO Transcript:
    - **Commercial**: Generic CTAs ("SHOP NOW", "LIMITED TIME")
    - **Viral**: Hype phrases ("WATCH THIS", "INSANE", "NO WAY")
    - **Tutorial**: Step markers ("STEP 1", "NEXT")
    - **Gaming**: Action callouts ("CLUTCH", "ACE")
    - Place at visual peaks (4-6 captions total)
    
    ## Caption Styling
    - fontSize: 48-72 (adjust by content type)
    - fontWeight: 800-900 (bold)
    - color: "#ffffff" (white, or context-specific)
    - strokeWidth: 4-6 (for readability)
    - strokeColor: "#000000" (black outline)
    - textAlign: "center"
    - Position: x: 50 (center), y: 85 (bottom)
    - Animation: {"type": "fade", "duration": 0.3}
    
    ## EFFECT LIBRARY & USAGE GUIDELINES
    
    ### Camera Motion (cameraMotion track)
    
    **Handheld Shake (Continuous)**:
    - Almost always use for cinematic feel
    - Commercial/Tutorial: 0.03 intensity
    - Vlog/Story: 0.04-0.05 intensity
    - Gaming/Viral: 0.06-0.07 intensity
    
    **Slow Zoom**:
    - Use for: Building suspense, emphasizing features, opening/closing
    - Don't use for: Fast action, tutorials (distracting)
    - Intensity: 0.15-0.25, Duration: 2-4s
    
    **Punch Zoom**:
    - Use for: Genuine surprises, big reveals, beat drops
    - Don't use for: Every audio peak, calm content, sad moments
    - Intensity: 0.4-0.6, Duration: 0.2-0.4s
    - MAX 3-4 times per video
    
    **Dolly Pan**:
    - Use for: Product showcases, transitions, building anticipation
    - Intensity: 0.15-0.25, Duration: 2-4s
    
    **Impact Shake**:
    - Use for: Explosions, big wins/losses, shocking revelations
    - Don't use for: Calm content, professional presentations
    - Intensity: 0.4-0.6, Duration: 0.3-0.4s
    - MAX 2-3 times per video
    
    ### Impact Effects (impactFX track)
    
    **Flash**:
    - Use for: Major reveals, transitions, beat drops
    - Colors: White (neutral), Gold (wins), Red (losses), Blue (tech)
    - Duration: 0.12-0.2s
    
    **Radial Glow**:
    - Use for: Highlighting elements, magical moments, victories
    - Duration: 0.6-1.0s
    
    **Impact Lines** (Anime style):
    - Use for: Anime/gaming content, extreme reactions
    - Don't use for: Professional/corporate, tutorials
    - Duration: 0.2-0.4s
    
    **Chromatic Aberration**:
    - Use for: Tech aesthetic, impact moments (sparingly)
    - Don't use for: Clean professional content
    - MAX 1-2 times per video
    - Duration: 0.2-0.3s
    
    **Glitch Effect**:
    - Use for: Tech/gaming, transitions, error moments
    - Duration: 0.08-0.15s
    
    ### Color Grading (ALWAYS APPLY)
    
    **Commercial/Professional**:
    - Saturation: 1.15, Contrast: 1.15, Vignette: 0.3
    
    **Viral/Gaming/Hype**:
    - Saturation: 1.35, Contrast: 1.25, Sharpness: 1.1
    - Vignette: 0.45, Film Grain: 0.2
    
    **Tutorial/Educational**:
    - Saturation: 1.1, Contrast: 1.1, Sharpness: 1.05
    
    **Vlog/Natural**:
    - Saturation: 1.2, Contrast: 1.1
    - Color Tint: #FFA500 (0.1 intensity), Film Grain: 0.1
    
    ## EFFECT BUDGET BY CONTENT TYPE
    
    - **Commercial**: 2-4 effects total (quality over quantity)
    - **Viral/Gaming**: 6-10 effects (strategic energy)
    - **Tutorial**: 1-3 effects (functional only)
    - **Vlog**: 2-5 effects (natural feel)
    - **Music**: 8-15 effects (artistic freedom)
    
    # TRACK LAYER SYSTEM
    - Layer 0: Main video/media
    - Layer 1-5: Camera motion and transforms
    - Layer 10-14: Text and captions
    - Layer 15-19: Shapes (vignettes, overlays)
    - Layer 20+: Impact effects (flashes, shakes)
    
    # COMPOSITION STRUCTURE
    Return ONLY valid JSON in this exact format:
    {
      "name": "Video Title",
      "duration": #{duration},
      "fps": #{@default_fps},
      "backgroundColor": "#000000",
      "tracks": [
        {
          "id": "main-video",
          "type": "video",
          "name": "Main Video",
          "source": {"type": "clip", "path": "USE_EXACT_PATH_FROM_MEDIA_LIST"},
          "startTime": 0,
          "endTime": #{duration},
          "layer": 0,
          "properties": {
            "x": 50,
            "y": 50,
            "scale": 1,
            "opacity": 1,
            "filters": [
              {"type": "saturation", "value": 1.3},
              {"type": "contrast", "value": 1.2},
              {"type": "vignette", "intensity": 0.4}
            ]
          }
        },
        {
          "id": "camera-motion",
          "type": "cameraMotion",
          "name": "Camera Effects",
          "startTime": 0,
          "endTime": #{duration},
          "layer": 1,
          "properties": {
            "effects": [
              {"startTime": 0, "endTime": #{duration}, "type": "handheldShake", "intensity": 0.05},
              {"startTime": 0, "endTime": 2.5, "type": "slowZoom", "direction": "in", "intensity": 0.2, "easing": "easeIn"}
            ]
          }
        },
        {
          "id": "caption-1",
          "type": "text",
          "name": "Caption",
          "startTime": 0.5,
          "endTime": 2.5,
          "layer": 10,
          "properties": {
            "x": 50,
            "y": 85,
            "text": {
              "content": "EXACT WORDS FROM TRANSCRIPT",
              "fontFamily": "Inter",
              "fontSize": 56,
              "fontWeight": 800,
              "color": "#ffffff",
              "strokeWidth": 6,
              "strokeColor": "#000000",
              "textAlign": "center",
              "animation": {"type": "fade", "duration": 0.3}
            }
          }
        },
        {
          "id": "impact-fx",
          "type": "impactFX",
          "name": "Impact Effects",
          "startTime": 0,
          "endTime": #{duration},
          "layer": 20,
          "properties": {
            "effects": [
              {"time": 4.2, "type": "flash", "duration": 0.15, "color": "#FFFFFF", "intensity": 0.7},
              {"time": 4.2, "type": "shake", "duration": 0.3, "intensity": 0.5}
            ]
          }
        }
      ]
    }

    Track types available:
    - "video": Video clips with source path and filters
    - "audio": Audio tracks
    - "text": Text overlays with content, styling, and animations
    - "shape": Visual overlays (vignettes, flashes, gradients)
    - "cameraMotion": Zoom/pan effects applied to video layer
    - "impactFX": Shake, flash, glow effects
    
    Text animations: "fade", "slide-up", "slide-down", "typewriter", "bounce", "scale-in", "blur-in"
    
    Camera motion types: "slowZoom", "punchZoom", "dollyPan", "orbit", "handheldShake", "impactShake"
    
    Impact FX types: "flash", "shake", "radialGlow", "impactLines", "chromaticAberration", "glitch"
    
    ## CRITICAL DECISION-MAKING FRAMEWORK
    
    ### Before Adding ANY Effect, Ask:
    
    1. **Does this enhance the story?** (If no → skip it)
    2. **Is this a genuinely important moment?** (If no → skip it)
    3. **Will this distract from the message?** (If yes → skip it)
    4. **Does this fit the content type?** (If no → skip it)
    5. **Have I already used this effect recently?** (If yes → use variety)
    
    ### Intelligent Analysis Process:
    
    1. **Read the transcript** (if provided) - understand the narrative
    2. **Identify content type** - commercial, viral, tutorial, gaming, etc.
    3. **Find key moments** - reveals, reactions, important info
    4. **Match effects to moments** - only where they make sense
    5. **Apply appropriate color grade** - based on content type
    6. **Add strategic captions** - coverage based on content type
    7. **Verify effect budget** - don't exceed limits for content type
    
    ## CRITICAL INSTRUCTIONS
    
    ### File Paths
    - Use the EXACT file paths from the "Path:" field in the media list
    - Copy the full path string exactly - do NOT modify or shorten it
    - For source.type: use "clip" for video clips, "local" for uploaded files
    
    ### Timing
    - All times are in SECONDS (not frames) in the JSON output
    - startTime and endTime must be within 0 to #{duration} seconds
    - Ensure no track exceeds the composition duration
    - For effects within tracks, use seconds for timing
    
    ### Positioning
    - All x/y positions are percentages (0-100)
    - Center: x: 50, y: 50
    - Top: y: 10-20
    - Bottom: y: 80-90
    - Left: x: 10-20
    - Right: x: 80-90
    
    ### Layering
    - Higher layer numbers render on top
    - Layer 0: Main video/media
    - Layer 1-5: Camera motion and transforms
    - Layer 10-14: Text and captions
    - Layer 15-19: Shapes (vignettes, overlays)
    - Layer 20+: Impact effects (flashes, shakes)
    
    ### Output Format
    - Return ONLY the JSON object
    - No markdown code blocks
    - No explanations or comments
    - Valid JSON syntax only
    
    ## FINAL REMINDER
    
    **YOU ARE NOT A ROBOT - YOU ARE AN INTELLIGENT EDITOR**
    
    - Analyze the content deeply
    - Understand the emotional arc
    - Apply effects that MAKE SENSE
    - Less is often more
    - Every effect should have a PURPOSE
    - The best edit is invisible until it needs to be seen
    
    Think like a professional editor who charges $5,000 per video.
    What would THEY do with this content?
    """
  end

  defp parse_composition_response(response, width, height, duration) do
    content = get_in(response, ["choices", Access.at(0), "message", "content"])
    
    if content do
      # Try to extract JSON from markdown code blocks if present
      json_content = case Regex.run(~r/```(?:json)?\s*(\{.*\})\s*```/s, content) do
        [_, json] -> json
        _ -> content
      end
      
      # Extract just the JSON object by finding the first complete JSON object
      # This handles cases where AI adds implementation notes after the JSON
      cleaned_json = extract_first_json_object(json_content)
      
      case Jason.decode(cleaned_json) do
        {:ok, composition} ->
          # Add required fields
          composition = Map.merge(composition, %{
            "id" => Ecto.UUID.generate(),
            "width" => width,
            "height" => height,
            "aspectRatio" => calculate_aspect_ratio(width, height),
            "duration" => duration,
            "fps" => @default_fps
          })

          {:ok, composition}

        {:error, reason} ->
          Logger.error("Failed to parse composition JSON: #{inspect(reason)}")
          Logger.error("Content: #{content}")
          {:error, "Invalid composition format"}
      end
    else
      {:error, "No content in response"}
    end
  end

  defp extract_json(content) do
    # Remove markdown code blocks if present
    content
    |> String.replace(~r/```json\n/, "")
    |> String.replace(~r/```\n?/, "")
    |> String.trim()
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
    content
    |> String.graphemes()
    |> Enum.reduce_while({0, []}, fn char, {depth, acc} ->
      new_depth = case char do
        "{" -> depth + 1
        "}" -> depth - 1
        _ -> depth
      end
      
      new_acc = [char | acc]
      
      if new_depth == 0 do
        {:halt, {new_depth, new_acc}}
      else
        {:cont, {new_depth, new_acc}}
      end
    end)
    |> elem(1)
    |> Enum.reverse()
    |> Enum.join()
  end

  defp calculate_aspect_ratio(1920, 1080), do: "16:9"
  defp calculate_aspect_ratio(1080, 1920), do: "9:16"
  defp calculate_aspect_ratio(1080, 1080), do: "1:1"
  defp calculate_aspect_ratio(1080, 1350), do: "4:5"
  defp calculate_aspect_ratio(_, _), do: "16:9"
end
