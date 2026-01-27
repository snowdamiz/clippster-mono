defmodule ClippsterServer.AI.VideoComposer do
  @moduledoc """
  AI-powered video composition generator using OpenRouter API.
  Analyzes media and prompt to create a complete video composition with tracks, timing, and effects.
  """

  require Logger

  @default_fps 30
  @default_duration 10

  def generate(prompt, media, style, target_duration, aspect_ratio, user) do
    Logger.info("Generating AI video composition for user #{user.id}")

    # Build context about available media
    media_context = build_media_context(media)

    # Determine video dimensions based on aspect ratio
    {width, height} = get_dimensions(aspect_ratio || "16:9")

    # Calculate target duration
    duration = target_duration || calculate_duration(media)

    # Create system prompt
    system_prompt = build_system_prompt(media_context, duration, aspect_ratio, style)

    # Create user prompt
    user_prompt = """
    Create a video composition based on this request:

    #{prompt}

    Available media:
    #{media_context}

    Target duration: #{duration} seconds
    Aspect ratio: #{aspect_ratio || "16:9"}
    #{if style, do: "Style: #{style}", else: ""}
    """

    # Call OpenRouter API directly
    api_key = System.get_env("OPENROUTER_API_KEY")
    
    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY not configured"}
    else
      payload = %{
        "model" => "anthropic/claude-3.5-sonnet",
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
      duration = Map.get(item, "duration")
      dimensions = Map.get(item, "dimensions")

      info = [
        "#{index}. #{name} (#{type})"
      ]

      info = if duration, do: info ++ ["Duration: #{Float.round(duration, 2)}s"], else: info
      info = if dimensions do
        info ++ ["Size: #{dimensions["width"]}x#{dimensions["height"]}"]
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
    You are an expert video editor and compositor. Your task is to create a complete video composition in JSON format.

    The composition should include:
    - Multiple tracks (video, audio, text, shapes)
    - Proper timing and layering
    - Smooth transitions
    - Text overlays with animations
    - Background music if audio is available
    - Visual effects where appropriate

    Available media:
    #{media_context}

    Target specifications:
    - Duration: #{duration} seconds
    - Aspect ratio: #{aspect_ratio}
    - FPS: #{@default_fps}
    #{if style, do: "- Style: #{style}", else: ""}

    Return ONLY valid JSON in this exact format:
    {
      "name": "Video Title",
      "duration": #{duration},
      "fps": #{@default_fps},
      "backgroundColor": "#000000",
      "tracks": [
        {
          "id": "track-1",
          "type": "video",
          "name": "Main Video",
          "source": {"type": "local", "path": "path from media list"},
          "startTime": 0,
          "endTime": 5,
          "layer": 0,
          "properties": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "opacity": 1,
            "trimStart": 0,
            "trimEnd": 5
          }
        },
        {
          "id": "track-2",
          "type": "text",
          "name": "Title",
          "startTime": 0,
          "endTime": 3,
          "layer": 10,
          "properties": {
            "x": 50,
            "y": 20,
            "text": {
              "content": "Your Text Here",
              "fontFamily": "Inter",
              "fontSize": 72,
              "fontWeight": 700,
              "color": "#ffffff",
              "textAlign": "center",
              "animation": {"type": "fade", "duration": 0.5}
            }
          }
        }
      ]
    }

    Track types available: "video", "audio", "image", "text", "shape"
    Text animations: "fade", "slide-up", "slide-down", "typewriter", "bounce", "scale-in", "blur-in"
    
    Important:
    - Use actual media paths from the provided list
    - Ensure timing doesn't exceed total duration
    - Layer higher numbers appear on top
    - All positions are percentages (0-100)
    - Return ONLY the JSON, no explanations
    """
  end

  defp parse_composition_response(response, width, height, duration) do
    content = get_in(response, ["choices", Access.at(0), "message", "content"])

    if content do
      # Extract JSON from response (may have markdown code blocks)
      json_str = extract_json(content)

      case Jason.decode(json_str) do
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

  defp calculate_aspect_ratio(1920, 1080), do: "16:9"
  defp calculate_aspect_ratio(1080, 1920), do: "9:16"
  defp calculate_aspect_ratio(1080, 1080), do: "1:1"
  defp calculate_aspect_ratio(1080, 1350), do: "4:5"
  defp calculate_aspect_ratio(_, _), do: "16:9"
end
