defmodule ClippsterServer.AI.BrollPlanner do
  @moduledoc """
  Transcript-driven AI B-roll placement planner via OpenRouter.
  Returns conservative timed suggestions with visual search queries.
  """

  require Logger

  alias ClippsterServer.AI.BrollValidation

  @openrouter_url "https://openrouter.ai/api/v1/chat/completions"
  @model "google/gemini-3.1-flash-lite"
  @max_tokens 8_192

  @system_prompt """
  You are a professional short-form video editor specializing in B-roll placement.

  Given a clip transcript with word-level timing, propose conservative B-roll insertions.
  Return ONLY valid JSON with this exact shape:
  {
    "suggestions": [
      {
        "id": "uuid-string",
        "startTime": 12.5,
        "endTime": 16.0,
        "transcriptText": "exact phrase being covered",
        "reason": "why this moment benefits from B-roll",
        "visualQuery": "stock footage search query (visual metaphor when speech is abstract)",
        "generationPrompt": null,
        "sourceType": "stock",
        "confidence": 0.85
      }
    ]
  }

  Rules:
  - Use clip-relative seconds from the provided transcript timing.
  - Prefer 3-5 second insertions; never longer than 8 seconds.
  - For clips under 30s with high density: return 3-4 suggestions spaced ~3s apart.
  - For 30-60s clips: return 3-5 suggestions with 4-5s gaps.
  - For low density: return 1-2 strong suggestions only.
  - Keep gaps between insertions (3s minimum for short/high-density clips).
  - Do NOT cover the opening hook (first 2s) unless the speech is purely abstract.
  - Use visual metaphors for abstract concepts (e.g. "growth" -> "sunrise over city skyline").
  - Use literal queries for concrete nouns/actions.
  - sourceType must be "stock" unless generationPrompt is provided (then "generated").
  - confidence is 0.0-1.0; mark uncertain placements below 0.6.
  - Return fewer, higher-quality suggestions rather than many weak ones.
  """

  @doc """
  Plan B-roll suggestions for a clip.
  Returns `{:ok, suggestions}` or `{:error, reason}`.
  """
  def suggest(params) do
    api_key = System.get_env("OPENROUTER_API_KEY")

    if is_nil(api_key) or api_key == "" do
      {:error, "OPENROUTER_API_KEY not configured"}
    else
      duration = parse_float(params["duration"] || params[:duration], 60.0)
      density = params["density"] || params[:density] || "low"
      style = params["style"] || params[:style] || "mixed"
      aspect = params["aspectRatio"] || params["aspect_ratio"] || "9:16"
      clip_id = params["clipId"] || params[:clip_id] || "unknown"

      user_prompt = build_user_prompt(params, duration, density, style, aspect)

      case call_openrouter(api_key, user_prompt) do
        {:ok, content} ->
          suggestions =
            content
            |> parse_json_suggestions()
            |> Enum.map(fn s -> Map.put(s, "clipId", clip_id) end)
            |> BrollValidation.normalize_suggestions(duration, density: density)

          {:ok, suggestions}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp build_user_prompt(params, duration, density, style, aspect) do
    words = Map.get(params, "transcriptWords") || Map.get(params, :transcript_words) || []
    segments = Map.get(params, "transcriptSegments") || Map.get(params, :transcript_segments) || []

    """
    Clip duration: #{duration} seconds
    Target aspect ratio: #{aspect}
    B-roll density preference: #{density}
    Visual style preference: #{style}

    Transcript words (clip-relative timing):
    #{Jason.encode!(words)}

    Transcript segments:
    #{Jason.encode!(segments)}

    Target suggestion count for this clip:
    #{density_target(density, duration)}

    Prefer concrete, visually specific stock queries tied to what is being said.
    Avoid generic finance charts unless the speech is explicitly about markets/trading.

    Propose B-roll placements for this clip. Return JSON only.
    """
  end

  defp density_target("high", duration) when duration < 30,
    do: "3-4 suggestions across the full clip duration."

  defp density_target("high", _), do: "4-5 suggestions spread across the clip."
  defp density_target("medium", duration) when duration < 30, do: "2-3 suggestions."
  defp density_target("medium", _), do: "3-4 suggestions."
  defp density_target("low", _), do: "1-2 high-confidence suggestions only."
  defp density_target(_, _), do: "2-3 suggestions."

  defp call_openrouter(api_key, user_prompt) do
    body = %{
      "model" => @model,
      "messages" => [
        %{"role" => "system", "content" => @system_prompt},
        %{"role" => "user", "content" => user_prompt}
      ],
      "temperature" => 0.4,
      "max_tokens" => @max_tokens,
      "response_format" => %{"type" => "json_object"}
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster-prototype"},
      {"X-Title", "Clippster AI B-Roll Planner"}
    ]

    case Req.post(@openrouter_url,
           json: body,
           headers: headers,
           receive_timeout: 120_000
         ) do
      {:ok, %Req.Response{status: 200, body: resp}} ->
        content =
          resp
          |> get_in(["choices", Access.at(0), "message", "content"])
          |> case do
            c when is_binary(c) -> c
            _ -> nil
          end

        if content, do: {:ok, content}, else: {:error, "Empty AI response"}

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error("[BrollPlanner] OpenRouter #{status}: #{inspect(body)}")
        {:error, "AI planner returned #{status}"}

      {:error, err} ->
        Logger.error("[BrollPlanner] Request failed: #{inspect(err)}")
        {:error, "AI planner request failed"}
    end
  end

  defp parse_json_suggestions(content) do
    case Jason.decode(content) do
      {:ok, %{"suggestions" => list}} when is_list(list) ->
        list

      {:ok, list} when is_list(list) ->
        list

      {:ok, _} ->
        []

      {:error, _} ->
        # Try extracting JSON object from markdown fences
        content
        |> String.replace(~r/^```json\s*/m, "")
        |> String.replace(~r/^```\s*/m, "")
        |> String.trim()
        |> case do
          trimmed ->
            case Jason.decode(trimmed) do
              {:ok, %{"suggestions" => list}} when is_list(list) -> list
              _ -> []
            end
        end
    end
  end

  defp parse_float(v, _default) when is_number(v), do: v * 1.0

  defp parse_float(v, default) when is_binary(v) do
    case Float.parse(v) do
      {f, _} -> f
      :error -> default
    end
  end

  defp parse_float(_, default), do: default
end
