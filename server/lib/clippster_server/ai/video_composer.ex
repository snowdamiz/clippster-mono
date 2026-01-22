defmodule ClippsterServer.AI.VideoComposer do
  @moduledoc """
  AI-powered video composition generator using OpenRouter API.
  Generates Remotion-compatible composition JSON from user prompts and media.
  """

  require Logger

  @openrouter_url "https://openrouter.ai/api/v1/chat/completions"

  @doc """
  Generate a video composition from a prompt and media list.
  """
  def generate_composition(prompt, media, opts \\ []) do
    style = Keyword.get(opts, :style)
    duration = Keyword.get(opts, :duration, 30)
    aspect_ratio = Keyword.get(opts, :aspect_ratio, "16:9")

    system_prompt = build_system_prompt(style, duration, aspect_ratio)
    user_message = build_user_message(prompt, media)

    case call_openrouter(system_prompt, user_message) do
      {:ok, response} ->
        parse_composition_response(response, duration, aspect_ratio)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp build_system_prompt(style, duration, aspect_ratio) do
    base_prompt = """
    You are an expert video editor and motion designer. Generate a Remotion-compatible video composition JSON.

    Requirements:
    - Duration: #{duration} seconds
    - Aspect Ratio: #{aspect_ratio}
    - Output valid JSON only, no markdown or explanations
    - Use provided media files in creative ways
    - Add text overlays, animations, and transitions
    - Create a professional, engaging composition
    """

    style_guidance =
      case style do
        "cinematic" ->
          "\n- Use slow, smooth transitions\n- Add dramatic text animations\n- Focus on visual storytelling"

        "energetic" ->
          "\n- Use fast cuts and transitions\n- Add dynamic text animations\n- Create high-energy pacing"

        "minimal" ->
          "\n- Use simple, clean layouts\n- Minimal text and effects\n- Focus on content clarity"

        "dynamic" ->
          "\n- Mix various animation styles\n- Use creative transitions\n- Balance energy and clarity"

        _ ->
          ""
      end

    base_prompt <> style_guidance <> "\n\n" <> composition_schema()
  end

  defp composition_schema do
    """
    JSON Schema:
    {
      "id": "string (uuid)",
      "name": "string",
      "duration": number (seconds),
      "fps": 30,
      "width": number,
      "height": number,
      "aspectRatio": "16:9" | "9:16" | "1:1" | "4:5",
      "backgroundColor": "string (hex color)",
      "tracks": [
        {
          "id": "string (uuid)",
          "type": "video" | "audio" | "image" | "text" | "shape",
          "name": "string",
          "source": { "type": "local", "path": "string" },
          "startTime": number,
          "endTime": number,
          "layer": number (0-10, higher = on top),
          "properties": {
            "x": number,
            "y": number,
            "width": number,
            "height": number,
            "scale": number (0-2),
            "rotation": number (degrees),
            "opacity": number (0-1),
            "text": {
              "content": "string",
              "fontFamily": "Inter",
              "fontSize": number,
              "fontWeight": 700,
              "color": "string (hex)",
              "backgroundColor": "string (hex)",
              "padding": number,
              "borderRadius": number,
              "textAlign": "left" | "center" | "right",
              "animation": {
                "type": "fade" | "slide-up" | "typewriter" | "bounce" | "scale-in",
                "duration": number
              }
            },
            "enterTransition": {
              "type": "fade" | "slide-left" | "zoom",
              "duration": number
            },
            "exitTransition": {
              "type": "fade" | "slide-right" | "zoom",
              "duration": number
            }
          }
        }
      ]
    }
    """
  end

  defp build_user_message(prompt, media) do
    media_list =
      Enum.map_join(media, "\n", fn item ->
        "- #{item["name"]} (#{item["type"]}, path: #{item["source"]["path"]})"
      end)

    """
    User Prompt: #{prompt}

    Available Media:
    #{media_list}

    Generate a creative video composition using these media files.
    """
  end

  defp call_openrouter(system_prompt, user_message) do
    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY not set"}
    else
      model = "anthropic/claude-3.5-sonnet"
      Logger.info("Using OpenRouter model for AI Video: #{model}")

      headers = [
        {"Authorization", "Bearer #{api_key}"},
        {"Content-Type", "application/json"},
        {"HTTP-Referer", "https://clippster.app"},
        {"X-Title", "Clippster AI Video"}
      ]

      body =
        Jason.encode!(%{
          model: model,
          messages: [
            %{role: "system", content: system_prompt},
            %{role: "user", content: user_message}
          ],
          temperature: 0.7,
          max_tokens: 4000
        })

      case HTTPoison.post(@openrouter_url, body, headers, timeout: 60_000, recv_timeout: 60_000) do
        {:ok, %{status_code: 200, body: response_body}} ->
          case Jason.decode(response_body) do
            {:ok, %{"choices" => [%{"message" => %{"content" => content}} | _]}} ->
              {:ok, content}

            {:ok, response} ->
              Logger.error("Unexpected OpenRouter response: #{inspect(response)}")
              {:error, "Unexpected API response format"}

            {:error, decode_error} ->
              Logger.error("Failed to decode OpenRouter response: #{inspect(decode_error)}")
              {:error, "Failed to parse API response"}
          end

        {:ok, %{status_code: status_code, body: error_body}} ->
          Logger.error("OpenRouter API error #{status_code}: #{error_body}")
          {:error, "API request failed with status #{status_code}"}

        {:error, %HTTPoison.Error{reason: reason}} ->
          Logger.error("HTTP request failed: #{inspect(reason)}")
          {:error, "Network request failed: #{inspect(reason)}"}
      end
    end
  end

  defp parse_composition_response(response, duration, aspect_ratio) do
    json_content =
      response
      |> String.replace(~r/```json\n?/, "")
      |> String.replace(~r/```\n?/, "")
      |> String.trim()

    case Jason.decode(json_content) do
      {:ok, composition} ->
        validated = validate_and_fix_composition(composition, duration, aspect_ratio)
        {:ok, validated}

      {:error, decode_error} ->
        Logger.error("Failed to parse composition JSON: #{inspect(decode_error)}")
        Logger.error("Response content: #{json_content}")
        {:error, "Failed to parse AI-generated composition"}
    end
  end

  defp validate_and_fix_composition(comp, duration, aspect_ratio) do
    {width, height} = get_dimensions(aspect_ratio)

    %{
      "id" => comp["id"] || Ecto.UUID.generate(),
      "name" => comp["name"] || "AI Generated Video",
      "duration" => duration,
      "fps" => 30,
      "width" => width,
      "height" => height,
      "aspectRatio" => aspect_ratio,
      "backgroundColor" => comp["backgroundColor"] || "#000000",
      "tracks" => validate_tracks(comp["tracks"] || [], duration)
    }
  end

  defp validate_tracks(tracks, duration) do
    tracks
    |> Enum.with_index()
    |> Enum.map(fn {track, index} ->
      %{
        "id" => track["id"] || Ecto.UUID.generate(),
        "type" => track["type"] || "video",
        "name" => track["name"] || "Track #{index + 1}",
        "source" => track["source"],
        "startTime" => max(0, track["startTime"] || 0),
        "endTime" => min(duration, track["endTime"] || duration),
        "layer" => track["layer"] || index,
        "properties" => track["properties"] || %{}
      }
    end)
    |> Enum.filter(fn track ->
      track["startTime"] < track["endTime"]
    end)
  end

  defp get_dimensions("16:9"), do: {1920, 1080}
  defp get_dimensions("9:16"), do: {1080, 1920}
  defp get_dimensions("1:1"), do: {1080, 1080}
  defp get_dimensions("4:5"), do: {1080, 1350}
  defp get_dimensions(_), do: {1920, 1080}
end
