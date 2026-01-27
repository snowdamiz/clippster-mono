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
        "model" => "google/gemini-3-flash-preview",
        "messages" => [
          %{"role" => "system", "content" => system_prompt},
          %{"role" => "user", "content" => user_prompt}
        ],
        "max_tokens" => 4000,
        "temperature" => 0.7
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
    # About Remotion-Based Video Composition
    You are an expert video editor creating compositions for Remotion, a React-based video framework.
    Your task is to generate a JSON composition that will be rendered using Remotion components.
    
    # Available Media
    #{media_context}
    
    # Target Specifications
    - Duration: #{duration} seconds (#{duration * @default_fps} frames at #{@default_fps} FPS)
    - Aspect ratio: #{aspect_ratio}
    - FPS: #{@default_fps}
    #{if style, do: "- Style: #{style}", else: ""}
    
    # CRITICAL RULES FOR CAPTIONS
    
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
    
    ## Caption Styling
    - fontSize: 48-72 (larger for emphasis)
    - fontWeight: 800 (always bold)
    - color: "#ffffff" (white)
    - strokeWidth: 4-6 (for readability)
    - strokeColor: "#000000" (black outline)
    - textAlign: "center"
    - Position: x: 50 (center), y: 85 (bottom)
    - Add fade animation: {"type": "fade", "duration": 0.3}
    
    # ANIMATION & EFFECTS RULES
    
    ## Camera Motion (cameraMotion track)
    - Add MULTIPLE camera effects throughout the video, not just at the start
    - Use different types: "slowZoom", "punchIn", "pan", "shake"
    - Vary intensity: 0.1-0.5 (subtle to dramatic)
    - Easing options: "linear", "easeIn", "easeOut", "easeInOut", "spring"
    - Synchronize with video content (reactions, key moments)
    
    ## Impact Effects (impactFX track)
    - Use at dramatic moments: wins, losses, surprises, reactions
    - Types: "flash", "shake", "glow", "glitch"
    - Flash duration: 0.1-0.2 seconds (quick)
    - Shake duration: 0.2-0.4 seconds
    - Glow duration: 0.5-1.0 seconds (longer)
    - Layer multiple effects simultaneously for maximum impact
    
    ## Animation Principles
    - Use spring animations for natural motion (damping: 200)
    - Use interpolate for linear/eased animations
    - Vary timing: quick (0.2s), medium (0.5s), slow (1s)
    - Add anticipation and follow-through
    - Keep effects synchronized with audio/speech
    
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
            "opacity": 1
          }
        },
        {
          "id": "text-1",
          "type": "text",
          "name": "Caption",
          "startTime": 0,
          "endTime": 3,
          "layer": 10,
          "properties": {
            "x": 50,
            "y": 85,
            "text": {
              "content": "Your text here",
              "fontFamily": "Inter",
              "fontSize": 48,
              "fontWeight": 800,
              "color": "#ffffff",
              "strokeWidth": 4,
              "strokeColor": "#000000",
              "textAlign": "center",
              "animation": {"type": "fade", "duration": 0.3}
            }
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
              {
                "startTime": 0,
                "endTime": 2,
                "type": "slowZoom",
                "intensity": 0.3,
                "easing": "easeInOut"
              },
              {
                "startTime": 4,
                "endTime": 5,
                "type": "punchIn",
                "intensity": 0.5,
                "easing": "spring"
              }
            ]
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
              {
                "time": 4.2,
                "type": "shake",
                "duration": 0.3,
                "intensity": 0.5
              },
              {
                "time": 4.2,
                "type": "flash",
                "duration": 0.13,
                "intensity": 0.6
              }
            ]
          }
        },
        {
          "id": "vignette",
          "type": "shape",
          "name": "Vignette",
          "startTime": 0,
          "endTime": #{duration},
          "layer": 15,
          "properties": {
            "x": 50,
            "y": 50,
            "width": 100,
            "height": 100,
            "gradient": {
              "type": "radial",
              "colors": ["rgba(0,0,0,0)", "rgba(0,0,0,0.4)"]
            }
          }
        }
      ]
    }

    Track types available:
    - "video": Video clips with source path
    - "audio": Audio tracks
    - "text": Text overlays with content, styling, and animations
    - "shape": Visual overlays (vignettes, flashes, gradients)
    - "cameraMotion": Zoom/pan effects applied to video layer
    - "impactFX": Shake, flash, glow effects
    
    Text animations: "fade", "slide-up", "slide-down", "typewriter", "bounce", "scale-in", "blur-in"
    
    Camera motion types: "slowZoom", "punchIn", "punchOut", "microJitter"
    
    Impact FX types: "shake", "flash", "glow", "glitch"
    
    # CRITICAL INSTRUCTIONS
    
    ## File Paths
    - Use the EXACT file paths from the "Path:" field in the media list
    - Copy the full path string exactly - do NOT modify or shorten it
    - For source.type: use "clip" for video clips, "local" for uploaded files
    
    ## Timing
    - All times are in SECONDS (not frames)
    - startTime and endTime must be within 0 to #{duration} seconds
    - Calculate frame counts: multiply seconds by #{@default_fps}
    - Ensure no track exceeds the composition duration
    
    ## Positioning
    - All x/y positions are percentages (0-100)
    - Center: x: 50, y: 50
    - Top: y: 10-20
    - Bottom: y: 80-90
    - Left: x: 10-20
    - Right: x: 80-90
    
    ## Layering
    - Higher layer numbers render on top
    - Use the layer system defined above
    - Ensure proper z-ordering for visual hierarchy
    
    ## Output Format
    - Return ONLY the JSON object
    - No markdown code blocks
    - No explanations or comments
    - Valid JSON syntax only
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
