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
          "#{Float.round(time, 1)}s (amp: #{Float.round(amp, 2)})"
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
    
    ## STEP 2: INTELLIGENT MOMENT DETECTION (CRITICAL - MUST FOLLOW)
    
    ### MANDATORY: Use Provided Audio Peak Data
    **IF "TOP 5 LOUDEST" audio peaks are listed in the media context:**
    1. You MUST place effects at those EXACT timestamps
    2. Match the effect intensity to the amplitude value
    3. Higher amplitude (>0.7) = Explosive effects (flash + shake + glow + particles)
    4. Medium amplitude (0.4-0.7) = Strong effects (shake + glow)
    5. Lower amplitude (0.2-0.4) = Subtle effects (zoom only)
    
    **Example from media context:**
    "TOP 5 LOUDEST: 12.3s (amp: 0.85), 18.7s (amp: 0.78), 25.1s (amp: 0.72), 8.4s (amp: 0.65), 31.2s (amp: 0.58)"
    
    **Required effects at those times:**
    - 12.3s (amp 0.85): flash + screenShake + radialGlow + particleBurst + punchZoom
    - 18.7s (amp 0.78): flash + screenShake + radialGlow + punchZoom
    - 25.1s (amp 0.72): screenShake + radialGlow + punchZoom
    - 8.4s (amp 0.65): screenShake + glow
    - 31.2s (amp 0.58): subtle zoom
    
    ### MANDATORY: Use Detected Excitement Words
    **IF "EXCITEMENT DETECTED" is listed in the media context:**
    - Find those EXACT words in the transcript
    - Estimate their timing based on transcript position
    - Place effects when those words are spoken
    - Words like "BOOM", "WOW", "INSANE" = Maximum intensity effects
    
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
    - USE the provided audio peak timestamps - they are REAL data
    - USE the detected excitement words - they are REAL moments
    - Don't randomly place effects - use the DATA provided
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
    
    ## ADVANCED EFFECT LIBRARY & USAGE GUIDELINES
    
    ### Scene Transitions (transition track)
    
    **CRITICAL**: Use transitions between major scene changes, not just effects on one continuous clip.
    
    **Hard Cut**:
    - Type: "cut"
    - Instant switch between scenes
    - Use for: Fast-paced content, beat-synced edits, action sequences
    - Duration: 0s (instant)
    
    **Fade (Cross Dissolve)**:
    - Type: "fade"
    - Smooth opacity blend between scenes
    - Use for: Calm transitions, time passage, mood shifts
    - Duration: 0.3-0.8s
    
    **Slide Transitions**:
    - Type: "slideLeft", "slideRight", "slideUp", "slideDown"
    - One scene pushes the other off screen
    - Use for: Sequential content, location changes, before/after
    - Duration: 0.4-0.6s
    - Direction: Match content flow (left→right for progression)
    
    **Wipe Transitions**:
    - Type: "wipeLeft", "wipeRight", "wipeUp", "wipeDown"
    - New scene reveals over old scene
    - Use for: Reveals, comparisons, dramatic changes
    - Duration: 0.4-0.7s
    
    **Diagonal Wipe**:
    - Type: "diagonalWipe"
    - Wipe from corner (adds dynamic energy)
    - Use for: Modern aesthetic, tech content, product reveals
    - Duration: 0.5-0.7s
    
    **Spin/Rotate Transition**:
    - Type: "spin", "rotate180", "rotate360"
    - Scene rotates to reveal next scene
    - Use for: Energetic content, music videos, sports highlights
    - Duration: 0.3-0.5s
    - Direction: "clockwise" or "counterClockwise"
    
    **Spiral Transition**:
    - Type: "spiralIn", "spiralOut"
    - Scene spirals in/out from center
    - Use for: Hypnotic effect, music videos, psychedelic content
    - Duration: 0.5-0.8s
    
    **Zoom Transition**:
    - Type: "zoomIn", "zoomOut"
    - Scene zooms in/out to reveal next scene
    - Use for: Focus shifts, dramatic reveals, impact moments
    - Duration: 0.4-0.6s
    
    **Flip Transition**:
    - Type: "flipHorizontal", "flipVertical"
    - Scene flips like a card to reveal back side
    - Use for: Before/after, reveals, card-style presentations
    - Duration: 0.5-0.7s
    
    **Clock Wipe**:
    - Type: "clockWipe"
    - Circular wipe like clock hands
    - Use for: Time-based content, countdowns, reveals
    - Duration: 0.6-0.9s
    
    **Iris Transition**:
    - Type: "irisIn", "irisOut"
    - Circular mask expands/contracts from center
    - Use for: Focus on subject, vintage aesthetic, dramatic reveals
    - Duration: 0.5-0.8s
    
    **Pixelate Transition**:
    - Type: "pixelate"
    - Scene breaks into pixels then reforms
    - Use for: Gaming content, tech aesthetic, glitch style
    - Duration: 0.4-0.6s
    
    **Glitch Transition**:
    - Type: "glitchTransition"
    - Digital distortion between scenes
    - Use for: Tech content, cyberpunk aesthetic, error moments
    - Duration: 0.2-0.4s
    
    **Burn Transition**:
    - Type: "burn"
    - Scene burns away with fire effect
    - Use for: Dramatic reveals, intense moments, action content
    - Duration: 0.5-0.8s
    - Color: Orange/red gradient
    
    **Liquid Transition**:
    - Type: "liquidStreaks", "liquidDrops"
    - Liquid-like motion between scenes
    - Use for: Smooth, organic transitions, beauty/fashion content
    - Duration: 0.6-0.9s
    
    **Page Turn**:
    - Type: "pageTurn"
    - Scene peels away like turning a page
    - Use for: Storytelling, tutorials, book-style presentations
    - Duration: 0.7-1.0s
    
    **Blinds Transition**:
    - Type: "blinds"
    - Horizontal/vertical blinds reveal next scene
    - Use for: Retro aesthetic, reveals, suspense
    - Duration: 0.5-0.7s
    
    **Cube 3D Transition**:
    - Type: "cube3D"
    - Scenes on sides of rotating 3D cube
    - Use for: Premium content, product showcases, modern aesthetic
    - Duration: 0.8-1.2s
    
    ### Camera Motion (cameraMotion track)
    
    **Handheld Shake (Continuous)**:
    - Type: "handheldShake"
    - Almost always use for cinematic feel
    - Commercial/Tutorial: 0.03 intensity
    - Vlog/Story: 0.04-0.05 intensity
    - Gaming/Viral: 0.06-0.07 intensity
    
    **Slow Zoom**:
    - Type: "slowZoom"
    - Use for: Building suspense, emphasizing features, opening/closing
    - Don't use for: Fast action, tutorials (distracting)
    - Intensity: 0.15-0.25, Duration: 2-4s
    - Direction: "in" or "out"
    
    **Punch Zoom**:
    - Type: "punchZoom"
    - Use for: Genuine surprises, big reveals, beat drops
    - Don't use for: Every audio peak, calm content, sad moments
    - Intensity: 0.4-0.6, Duration: 0.2-0.4s
    - Direction: "in" or "out"
    - MAX 3-4 times per video
    
    **Dolly Pan**:
    - Type: "dollyPan"
    - Use for: Product showcases, transitions, building anticipation
    - Intensity: 0.15-0.25, Duration: 2-4s
    - Direction: "left", "right", "up", "down"
    
    **Orbit/Arc Shot**:
    - Type: "orbit"
    - Camera circles around subject
    - Use for: Product showcases, 3D reveals, hero moments
    - Intensity: 0.2-0.4, Duration: 2-4s
    - Direction: "clockwise" or "counterClockwise"
    
    **Dutch Angle/Tilt**:
    - Type: "dutchAngle"
    - Camera tilts on Z-axis
    - Use for: Unease, action, dynamic energy
    - Angle: 5-15 degrees
    - Duration: 1-3s
    
    **Impact Shake**:
    - Type: "impactShake"
    - Use for: Explosions, big wins/losses, shocking revelations
    - Don't use for: Calm content, professional presentations
    - Intensity: 0.4-0.6, Duration: 0.3-0.4s
    - MAX 2-3 times per video
    
    **Parallax Effect**:
    - Type: "parallax"
    - Layers move at different speeds
    - Use for: Depth, 3D feel, modern aesthetic
    - Intensity: 0.1-0.3, Duration: 2-4s
    
    ### Impact Effects (impactFX track)
    
    **Flash**:
    - Type: "flash"
    - Use for: Major reveals, transitions, beat drops
    - Colors: White (neutral), Gold (wins), Red (losses), Blue (tech)
    - Duration: 0.12-0.2s
    - Intensity: 0.5-0.8
    
    **Radial Glow**:
    - Type: "radialGlow"
    - Use for: Highlighting elements, magical moments, victories
    - Duration: 0.6-1.0s
    - Color: Match content (gold for wins, blue for tech)
    - Intensity: 0.4-0.7
    
    **Impact Lines** (Anime style):
    - Type: "impactLines"
    - Use for: Anime/gaming content, extreme reactions
    - Don't use for: Professional/corporate, tutorials
    - Duration: 0.2-0.4s
    - Pattern: "radial" or "directional"
    
    **Chromatic Aberration**:
    - Type: "chromaticAberration"
    - Use for: Tech aesthetic, impact moments (sparingly)
    - Don't use for: Clean professional content
    - MAX 1-2 times per video
    - Duration: 0.2-0.3s
    - Intensity: 0.3-0.6
    
    **Glitch Effect**:
    - Type: "glitch"
    - Use for: Tech/gaming, transitions, error moments
    - Duration: 0.08-0.15s
    - Style: "digital", "analog", "rgb"
    
    **Lens Flare**:
    - Type: "lensFlare"
    - Use for: Cinematic moments, sun reveals, dramatic lighting
    - Duration: 0.5-1.5s
    - Position: Follow light source
    - Intensity: 0.4-0.7
    
    **Light Rays/God Rays**:
    - Type: "lightRays"
    - Use for: Dramatic reveals, spiritual moments, beauty shots
    - Duration: 1.0-3.0s
    - Angle: Match light direction
    - Intensity: 0.3-0.6
    
    **Particle Burst**:
    - Type: "particleBurst"
    - Use for: Celebrations, wins, magical moments
    - Duration: 0.5-1.0s
    - Particle type: "sparkles", "confetti", "smoke", "dust"
    - Count: 50-200 particles
    
    **Screen Shake**:
    - Type: "screenShake"
    - Use for: Impacts, explosions, bass drops
    - Duration: 0.2-0.4s
    - Intensity: 0.3-0.6
    - Axis: "both", "horizontal", "vertical"
    
    **Freeze Frame**:
    - Type: "freezeFrame"
    - Use for: Dramatic pauses, record scratch moments, emphasis
    - Duration: 0.3-1.0s
    - Effect: Optional slow-mo lead-in
    
    **Speed Ramp**:
    - Type: "speedRamp"
    - Use for: Action sequences, dramatic moments, transitions
    - Speed: 0.25x to 3.0x
    - Duration: 0.5-2.0s
    - Curve: "easeIn", "easeOut", "easeInOut"
    
    **Motion Blur**:
    - Type: "motionBlur"
    - Use for: Fast action, speed emphasis, dynamic movement
    - Duration: 0.2-0.5s
    - Intensity: 0.3-0.7
    - Direction: Match movement
    
    **Vignette Pulse**:
    - Type: "vignettePulse"
    - Use for: Beat-synced effects, tension, focus
    - Duration: 0.3-0.6s per pulse
    - Intensity: 0.3-0.6
    - Sync to: Audio beats
    
    **Color Flash**:
    - Type: "colorFlash"
    - Use for: Beat drops, transitions, energy bursts
    - Duration: 0.1-0.3s
    - Color: Match mood (red=energy, blue=calm, purple=mystery)
    - Intensity: 0.4-0.8
    
    **Distortion Wave**:
    - Type: "distortionWave"
    - Use for: Bass drops, impact moments, surreal effects
    - Duration: 0.3-0.6s
    - Intensity: 0.2-0.5
    - Direction: "horizontal", "vertical", "radial"
    
    **RGB Split**:
    - Type: "rgbSplit"
    - Use for: Glitch aesthetic, tech content, impact moments
    - Duration: 0.1-0.3s
    - Offset: 5-20 pixels
    - Intensity: 0.4-0.8
    
    **Split Screen / Slice**:
    - Type: "splitScreen" or "slice"
    - Use for: EXTREME hype moments, big wins, explosive reactions
    - Creates layered angled segments (like anime impact frames)
    - Duration: 0.5-1.5s
    - Segments: 3-5 (number of slices)
    - Angle: -15 to 15 degrees (skew angle)
    - Intensity: 0.6-1.0 (controls offset distance)
    - Color: "rgba(0, 0, 0, 0.3)" (overlay color between segments)
    - PERFECT for: "BOOM!", big wins, clutch moments, celebrations
    
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
    
    - **Commercial/Product**: 4-8 effects + 2-4 transitions (polished, professional)
    - **Viral/Gaming**: 10-15 effects + 4-6 transitions (high energy, fast-paced)
    - **Tutorial**: 2-4 effects + 1-2 transitions (functional only, clear)
    - **Vlog**: 3-6 effects + 2-3 transitions (natural, authentic)
    - **Music Video**: 15-25 effects + 6-10 transitions (artistic freedom, beat-synced)
    - **3D Product Reveal**: 6-10 effects + 4-6 transitions (cinematic, premium)
    
    ## TRANSITION STRATEGY
    
    **When to Use Transitions:**
    - Scene changes (different location, time, subject)
    - Major topic shifts
    - Beat drops in music
    - Before/after comparisons
    - Chapter/section breaks
    
    **When NOT to Use Transitions:**
    - Within same continuous shot
    - Every 2 seconds (too chaotic)
    - During important dialogue
    - In calm, contemplative moments
    
    **Transition Pacing:**
    - **Fast-paced content**: Transition every 3-5s
    - **Medium-paced**: Transition every 5-8s
    - **Slow-paced**: Transition every 8-12s
    - **Match to music**: Sync transitions to beat/measure changes
    
    # TRACK LAYER SYSTEM
    - Layer 0: Main video/media
    - Layer 1-5: Camera motion and transforms
    - Layer 6-9: Transitions between scenes
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
          "id": "transitions",
          "type": "transition",
          "name": "Scene Transitions",
          "startTime": 0,
          "endTime": #{duration},
          "layer": 6,
          "properties": {
            "transitions": [
              {"time": 3.5, "type": "slideLeft", "duration": 0.5},
              {"time": 7.2, "type": "spin", "duration": 0.4, "direction": "clockwise"},
              {"time": 10.8, "type": "zoomIn", "duration": 0.5}
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
              {"startTime": 0, "endTime": 2.5, "type": "slowZoom", "direction": "in", "intensity": 0.2, "easing": "easeIn"},
              {"startTime": 5.0, "endTime": 7.5, "type": "orbit", "direction": "clockwise", "intensity": 0.3},
              {"startTime": 8.5, "endTime": 8.7, "type": "punchZoom", "direction": "in", "intensity": 0.5}
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
              {"time": 4.2, "type": "screenShake", "duration": 0.3, "intensity": 0.5, "axis": "both"},
              {"time": 6.8, "type": "radialGlow", "duration": 0.8, "color": "#FFD700", "intensity": 0.6},
              {"time": 9.5, "type": "particleBurst", "duration": 0.7, "particleType": "sparkles", "count": 150}
            ]
          }
        }
      ]
    }

    Track types available:
    - "video": Video clips with source path and filters
    - "audio": Audio tracks
    - "transition": Scene transitions (cuts, slides, spins, wipes, etc.)
    - "text": Text overlays with content, styling, and animations
    - "shape": Visual overlays (vignettes, flashes, gradients)
    - "cameraMotion": Zoom/pan effects applied to video layer
    - "impactFX": Impact effects (flash, shake, glow, particles, etc.)
    
    Text animations: "fade", "slide-up", "slide-down", "typewriter", "bounce", "scale-in", "blur-in"
    
    Transition types: "cut", "fade", "slideLeft", "slideRight", "slideUp", "slideDown", "wipeLeft", "wipeRight", "wipeUp", "wipeDown", "diagonalWipe", "spin", "rotate180", "rotate360", "spiralIn", "spiralOut", "zoomIn", "zoomOut", "flipHorizontal", "flipVertical", "clockWipe", "irisIn", "irisOut", "pixelate", "glitchTransition", "burn", "liquidStreaks", "liquidDrops", "pageTurn", "blinds", "cube3D"
    
    Camera motion types: "handheldShake", "slowZoom", "punchZoom", "dollyPan", "orbit", "dutchAngle", "impactShake", "parallax"
    
    Impact FX types: "flash", "radialGlow", "impactLines", "chromaticAberration", "glitch", "lensFlare", "lightRays", "particleBurst", "screenShake", "freezeFrame", "speedRamp", "motionBlur", "vignettePulse", "colorFlash", "distortionWave", "rgbSplit"
    
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
    
    ## CRITICAL REQUIREMENTS (MUST FOLLOW)
    
    ### EFFECTS MUST COVER ENTIRE VIDEO
    - Place effects from 0s to the FULL duration (#{duration}s)
    - Do NOT stop placing effects after 20-30 seconds
    - The LAST 1/3 of the video needs effects too
    - Distribute effects evenly: beginning, middle, AND end
    
    ### MANDATORY: EXPLOSIVE EFFECTS AT AUDIO PEAKS
    **THIS IS THE MOST IMPORTANT RULE - DO NOT SKIP THIS**
    
    If "TOP 5 LOUDEST MOMENTS" are provided in the media context:
    1. **YOU MUST CREATE EFFECTS AT EVERY SINGLE AUDIO PEAK TIMESTAMP**
    2. **EACH PEAK REQUIRES 8-15 SIMULTANEOUS EFFECTS**
    3. **Match effect intensity to the amplitude value (0.5-1.0)**
    
    For EACH audio peak, create ALL of these effects simultaneously:
    - **Flash effect** (white overlay, opacity based on amplitude)
    - **Screen shake** (intensity based on amplitude)
    - **Radial glow** (gold/white, pulsing)
    - **Particle burst** (sparkles, confetti)
    - **Lens flare** (sweep across screen)
    - **Light rays** (god rays from center)
    - **Color flash** (gold/red tint)
    - **RGB split** (chromatic aberration)
    - **Split screen / slice** (layered angled segments - MUST USE for amplitude > 0.8)
    - **Impact shake** (camera shake)
    - **Vignette pulse** (darken edges)
    - **Distortion wave** (ripple effect)
    - **Zoom punch** (quick zoom in/out)
    
    **AMPLITUDE MAPPING:**
    - 0.9-1.0 (EXTREME): Use ALL 12 effects, max intensity, 2-3 second duration
    - 0.7-0.9 (VERY LOUD): Use 8-10 effects, high intensity, 1.5-2 second duration
    - 0.5-0.7 (LOUD): Use 6-8 effects, medium intensity, 1-1.5 second duration
    
    ### EXCITEMENT WORDS = INSTANT EFFECTS
    If excitement words are detected (boom, wild, holy, shit, fuck, yes, etc.):
    - Place effects when these words are spoken
    - Layer 5-8 effects at each excitement word
    - Use celebration-style effects (gold glow, particles, flash)
    
    ### SMOOTH EFFECT TRANSITIONS
    - Effects should fade in and out smoothly
    - Use easing: "easeInOut" for all effects
    - No abrupt starts or stops
    - Overlap effects slightly for smooth transitions
    
    ## FINAL REMINDER
    
    **YOU ARE A PROFESSIONAL VIDEO EDITOR, NOT A LAZY AI**
    
    - If you receive audio peak data, YOU MUST USE IT
    - Every peak = explosive multi-effect combo
    - The user will be EXTREMELY disappointed if you ignore the peaks
    - This is gambling content - it needs HYPE, ENERGY, and CELEBRATION
    - Think: "What would a $10,000 editor do at the moment someone wins $900?"
    
    **DO NOT BE SUBTLE. BE EXPLOSIVE. BE CREATIVE. BE INTENSE.**
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
