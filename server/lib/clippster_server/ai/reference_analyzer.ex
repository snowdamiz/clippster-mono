defmodule ClippsterServer.AI.ReferenceAnalyzer do
  @moduledoc """
  Analyzes reference videos/images and uploaded media using Gemini Flash vision
  via OpenRouter to extract style profiles and content analysis.
  """

  require Logger

  @openrouter_url "https://openrouter.ai/api/v1/chat/completions"
  @vision_model "google/gemini-2.5-flash-preview"
  @max_retries 2

  @reference_system_prompt """
  You are a professional video editor and creative director. Analyze the provided reference image(s) or video thumbnail(s) and extract a comprehensive style profile.

  Return ONLY a valid JSON object with this exact structure:
  {
    "colorPalette": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "text": "#hex",
      "gradients": ["gradient description 1", "gradient description 2"]
    },
    "typography": {
      "headingStyle": "description of heading font style",
      "bodyStyle": "description of body text style",
      "captionStyle": "description of caption/subtitle style",
      "animationStyle": "how text animates in/out"
    },
    "motionStyle": {
      "pacing": "slow|medium|fast|dynamic",
      "cutFrequency": "rare|moderate|frequent|rapid",
      "cameraMotion": ["zoom_in", "pan_left", etc],
      "transitionTypes": ["cut", "dissolve", "wipe", etc],
      "energyLevel": 1-10
    },
    "visualEffects": {
      "backgroundType": "solid|gradient|pattern|video",
      "overlayEffects": ["glow", "particles", etc],
      "borderStyles": ["none", "rounded", etc],
      "shadowStyles": ["drop", "inner", etc]
    },
    "layout": {
      "contentPlacement": "center|top|bottom|split",
      "textPosition": "center|lower-third|top|dynamic",
      "imagePresentation": "fullscreen|framed|collage|split"
    },
    "mood": "energetic|calm|professional|playful|dramatic|etc",
    "genre": "gaming|educational|lifestyle|tech|etc",
    "summary": "2-3 sentence summary of the overall visual style"
  }
  """

  @media_system_prompt """
  You are a professional video editor. Analyze each uploaded image and provide content analysis to help create the best possible video composition.

  For each image, return a JSON object in an array with this structure:
  [
    {
      "index": 0,
      "contentType": "photo|screenshot|graphic|logo|text|meme|product",
      "dominantColors": ["#hex1", "#hex2", "#hex3"],
      "textContent": "any visible text in the image",
      "brandElements": "logos, brand colors, or brand-related elements",
      "layout": "portrait|landscape|square|complex",
      "suggestedDuration": 3.0,
      "suggestedEffects": "zoom_in|ken_burns|parallax|static|etc",
      "suggestedOrder": 1
    }
  ]

  Return ONLY the JSON array, no other text.
  """

  @doc """
  Analyze a reference image to extract a style profile.
  Accepts base64-encoded image data.
  Returns {:ok, style_profile} or {:error, reason}.
  """
  def analyze_reference(image_base64, mime_type \\ "image/jpeg") do
    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY not set"}
    else
      messages = [
        %{"role" => "system", "content" => @reference_system_prompt},
        %{
          "role" => "user",
          "content" => [
            %{
              "type" => "image_url",
              "image_url" => %{
                "url" => "data:#{mime_type};base64,#{image_base64}"
              }
            },
            %{
              "type" => "text",
              "text" => "Analyze this reference image and extract the complete style profile as JSON."
            }
          ]
        }
      ]

      case call_vision(messages, api_key) do
        {:ok, content} -> parse_json_response(content)
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc """
  Analyze multiple uploaded media images for content understanding.
  Accepts a list of {base64_data, mime_type, original_path} tuples.
  Returns {:ok, [analysis]} or {:error, reason}.
  """
  def analyze_media(images) when is_list(images) do
    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) do
      {:error, "OPENROUTER_API_KEY not set"}
    else
      image_parts = images
      |> Enum.with_index()
      |> Enum.flat_map(fn {{base64_data, mime_type, path}, idx} ->
        [
          %{
            "type" => "image_url",
            "image_url" => %{
              "url" => "data:#{mime_type};base64,#{base64_data}"
            }
          },
          %{
            "type" => "text",
            "text" => "Image #{idx + 1} (#{Path.basename(path)}):"
          }
        ]
      end)

      messages = [
        %{"role" => "system", "content" => @media_system_prompt},
        %{
          "role" => "user",
          "content" => image_parts ++ [
            %{
              "type" => "text",
              "text" => "Analyze all #{length(images)} images above and return the JSON array with analysis for each."
            }
          ]
        }
      ]

      case call_vision(messages, api_key) do
        {:ok, content} -> parse_json_array_response(content)
        {:error, reason} -> {:error, reason}
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp call_vision(messages, api_key) do
    call_vision_with_retry(messages, api_key, 1)
  end

  defp call_vision_with_retry(messages, api_key, attempt) do
    payload = %{
      "model" => @vision_model,
      "messages" => messages,
      "max_tokens" => 4096,
      "temperature" => 0.3
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster Reference Analyzer"}
    ]

    case HTTPoison.post(
      @openrouter_url,
      Jason.encode!(payload),
      headers,
      recv_timeout: 90_000
    ) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            content = get_in(response, ["choices", Access.at(0), "message", "content"])
            if content, do: {:ok, content}, else: {:error, "No content in vision response"}
          {:error, reason} ->
            {:error, "Failed to parse vision response: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} when status in [429, 500, 502, 503, 529] ->
        if attempt < @max_retries do
          delay = :timer.seconds(attempt * 2)
          Logger.warning("[ReferenceAnalyzer] Attempt #{attempt}/#{@max_retries} failed: #{status}. Retrying...")
          Process.sleep(delay)
          call_vision_with_retry(messages, api_key, attempt + 1)
        else
          {:error, "Vision API error #{status}: #{String.slice(body, 0, 200)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "Vision API error #{status}: #{String.slice(body, 0, 200)}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        if attempt < @max_retries do
          Process.sleep(:timer.seconds(attempt * 2))
          call_vision_with_retry(messages, api_key, attempt + 1)
        else
          {:error, "Network error: #{inspect(reason)}"}
        end
    end
  end

  defp parse_json_response(content) do
    cleaned = extract_json_object(content)
    case Jason.decode(cleaned) do
      {:ok, parsed} when is_map(parsed) -> {:ok, parsed}
      {:ok, _} -> {:error, "Expected JSON object, got other type"}
      {:error, _} -> {:error, "Failed to parse style profile JSON"}
    end
  end

  defp parse_json_array_response(content) do
    cleaned = extract_json_array(content)
    case Jason.decode(cleaned) do
      {:ok, parsed} when is_list(parsed) -> {:ok, parsed}
      {:ok, _} -> {:error, "Expected JSON array, got other type"}
      {:error, _} -> {:error, "Failed to parse media analysis JSON"}
    end
  end

  defp extract_json_object(content) do
    # Try to find JSON in code fences first
    case Regex.run(~r/```(?:json)?\s*([\s\S]*?)\s*```/, content) do
      [_, json] -> String.trim(json)
      nil ->
        # Find first { to last }
        case Regex.run(~r/(\{[\s\S]*\})/, content) do
          [_, json] -> json
          nil -> content
        end
    end
  end

  defp extract_json_array(content) do
    case Regex.run(~r/```(?:json)?\s*([\s\S]*?)\s*```/, content) do
      [_, json] -> String.trim(json)
      nil ->
        case Regex.run(~r/(\[[\s\S]*\])/, content) do
          [_, json] -> json
          nil -> content
        end
    end
  end
end
