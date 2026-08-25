defmodule ClippsterServer.AI.ReferenceAnalyzer do
  @moduledoc """
  Converts measured temporal evidence from a reference video into a versioned edit recipe.
  Video download, probing, and frame extraction happen in the Tauri process; this module
  validates that evidence and performs the multimodal inference step.
  """

  require Logger

  @openrouter_url "https://openrouter.ai/api/v1/chat/completions"
  @default_vision_model "google/gemini-3.7-flash"
  @analysis_version "temporal-edit-recipe/1.0.0"
  @max_retries 2
  @max_frames 16
  @max_frame_base64_bytes 1_500_000
  @default_max_duration_seconds 30 * 60
  @default_max_file_bytes 500 * 1024 * 1024

  @reference_system_prompt """
  You are a professional video editor analyzing a time-ordered contact sheet plus measured
  video evidence. Infer the editing language across time. Never claim to see a behavior unless
  the supplied timestamps, cut data, audio peaks, or frames support it. Use confidence values
  between 0 and 1 and cite concise timestamp evidence for transitions, motion, effects, and layout.

  Return ONLY a valid JSON object with exactly these top-level fields:
  {
    "confidence": {
      "overall": 0.0,
      "pacing": 0.0,
      "captions": 0.0,
      "motion": 0.0,
      "transitions": 0.0,
      "color": 0.0,
      "layout": 0.0
    },
    "pacing": {
      "description": "concise pacing description",
      "cutsPerMinute": 0.0,
      "shotLengthSeconds": {"min": 0.0, "median": 0.0, "max": 0.0},
      "quietSections": "timestamp ranges or none detected",
      "peakSections": "timestamp ranges or none detected"
    },
    "captions": {
      "detected": true,
      "placement": "placement",
      "size": "relative size",
      "weight": "weight",
      "colors": ["#hex"],
      "treatment": "stroke, background, emphasis, and animation",
      "wordsPerScreen": 0,
      "cadence": "caption timing behavior"
    },
    "typography": {
      "heading": "heading recipe",
      "body": "body recipe",
      "lowerThird": "lower-third recipe",
      "animation": "text animation recipe"
    },
    "colorGrade": {
      "palette": ["#hex"],
      "contrast": "low|neutral|high",
      "saturation": "muted|neutral|boosted",
      "temperature": "cool|neutral|warm|mixed",
      "treatment": ["grain", "vignette", "letterbox", "other observed treatment"]
    },
    "transitions": {
      "families": ["cut", "dissolve", "wipe", "zoom", "other"],
      "approximateDurationSeconds": 0.0,
      "frequency": "rare|low|moderate|frequent",
      "evidence": ["timestamp and observation"]
    },
    "motion": {
      "cameraBehaviors": ["static", "pan", "push-in", "punch-zoom", "shake", "reframe"],
      "cropAndReframe": "behavior",
      "intensity": "low|medium|high|dynamic",
      "evidence": ["timestamp and observation"]
    },
    "effects": {
      "families": ["effect family"],
      "frequency": "rare|low|moderate|frequent",
      "evidence": ["timestamp and observation"]
    },
    "layout": {
      "patterns": ["full screen", "split screen", "framed", "title card", "other"],
      "overlays": ["lower third", "CTA", "frame", "other"],
      "textPlacement": "placement behavior",
      "evidence": ["timestamp and observation"]
    },
    "audioCues": {
      "available": true,
      "rhythm": "observed peak rhythm or unavailable",
      "relationshipToCuts": "relationship",
      "relationshipToCaptions": "relationship or unknown"
    },
    "aspectRatioAdaptation": {
      "16:9": "layout adaptation",
      "9:16": "layout adaptation",
      "1:1": "layout adaptation",
      "4:5": "layout adaptation"
    },
    "unsupported": [
      {"technique": "observed technique", "fallback": "closest supported behavior", "reason": "renderer limitation"}
    ],
    "mood": "mood",
    "genre": "genre",
    "summary": "two or three sentences describing the learned editing approach"
  }

  Style-match the editing family only. Never recommend copying footage, music, watermarks,
  logos, exact text, or protected brand assets from the reference.
  """

  @doc """
  Analyze a validated temporal reference payload and return a versioned edit recipe.
  """
  def analyze_reference(payload) do
    with {:ok, payload} <- validate_payload(payload),
         api_key when is_binary(api_key) <- System.get_env("OPENROUTER_API_KEY"),
         {:ok, content} <- call_vision(build_messages(payload), api_key),
         {:ok, inferred} <- parse_json_response(content),
         :ok <- validate_inferred_recipe(inferred) do
      {:ok, build_recipe(payload, inferred)}
    else
      nil -> {:error, "OPENROUTER_API_KEY not set"}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc false
  def validate_payload(%{"metadata" => metadata, "frames" => frames} = payload)
      when is_map(metadata) and is_list(frames) do
    duration = number(metadata["duration"])
    file_size = number(metadata["fileSizeBytes"])

    max_duration =
      configured_number("AI_REFERENCE_MAX_DURATION_SECONDS", @default_max_duration_seconds)

    max_file_size = configured_number("AI_REFERENCE_MAX_BYTES", @default_max_file_bytes)

    cond do
      is_nil(duration) or duration <= 0 ->
        {:error, "Reference duration is missing or invalid"}

      duration > max_duration ->
        {:error, "Reference exceeds the configured duration limit"}

      is_nil(file_size) or file_size <= 0 ->
        {:error, "Reference file size is missing or invalid"}

      file_size > max_file_size ->
        {:error, "Reference exceeds the configured file-size limit"}

      not valid_dimensions?(metadata) ->
        {:error, "Reference dimensions or frame rate are missing"}

      frames == [] ->
        {:error, "Reference analysis requires timeline frames"}

      length(frames) > @max_frames ->
        {:error, "Reference analysis accepts at most #{@max_frames} frames"}

      not Enum.all?(frames, &valid_frame?(&1, duration)) ->
        {:error, "Reference contains an invalid sampled frame"}

      not valid_timestamps?(payload["cutTimestamps"], duration) ->
        {:error, "Reference contains invalid cut timestamps"}

      not valid_audio_peaks?(payload["audioPeaks"], duration) ->
        {:error, "Reference contains invalid audio peaks"}

      true ->
        {:ok,
         payload
         |> Map.put_new("cutTimestamps", [])
         |> Map.put_new("audioPeaks", [])}
    end
  end

  def validate_payload(_), do: {:error, "Reference analysis payload is invalid"}

  defp build_messages(payload) do
    metadata = payload["metadata"]
    cuts = payload["cutTimestamps"]
    peaks = payload["audioPeaks"]
    stats = pacing_stats(number(metadata["duration"]), cuts)

    evidence_text = """
    Analyze this reference across its full timeline.

    Measured metadata: #{Jason.encode!(metadata)}
    Measured cuts: #{Jason.encode!(cuts)}
    Measured pacing: #{Jason.encode!(stats)}
    Measured audio peaks: #{Jason.encode!(peaks)}

    Frames follow in chronological order. Each frame label states its exact timestamp and
    whether it is a uniform sample or immediately before/after a detected cut. Compare adjacent
    samples to infer motion, transitions, caption cadence, overlays, grade, effects, and layout.
    """

    frame_parts =
      payload["frames"]
      |> Enum.sort_by(&number(&1["timestamp"]))
      |> Enum.flat_map(fn frame ->
        [
          %{
            "type" => "text",
            "text" => "Frame at #{frame["timestamp"]}s (#{frame["kind"]})"
          },
          %{
            "type" => "image_url",
            "image_url" => %{
              "url" => "data:#{frame["mimeType"]};base64,#{frame["base64Data"]}"
            }
          }
        ]
      end)

    [
      %{"role" => "system", "content" => @reference_system_prompt},
      %{
        "role" => "user",
        "content" => [%{"type" => "text", "text" => evidence_text}] ++ frame_parts
      }
    ]
  end

  defp call_vision(messages, api_key), do: call_vision_with_retry(messages, api_key, 1)

  defp call_vision_with_retry(messages, api_key, attempt) do
    payload = %{
      "model" => System.get_env("OPENROUTER_VISION_MODEL") || @default_vision_model,
      "messages" => messages,
      "max_tokens" => 8192,
      "temperature" => 0.2
    }

    headers = [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"HTTP-Referer", "https://github.com/snowdamiz/clippster"},
      {"X-Title", "Clippster Temporal Reference Analyzer"}
    ]

    case HTTPoison.post(
           @openrouter_url,
           Jason.encode!(payload),
           headers,
           recv_timeout: configured_integer("AI_REFERENCE_MODEL_TIMEOUT_MS", 120_000),
           timeout: 20_000
         ) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        with {:ok, response} <- Jason.decode(body),
             content when is_binary(content) <-
               get_in(response, ["choices", Access.at(0), "message", "content"]) do
          {:ok, content}
        else
          _ -> {:error, "Reference model returned an invalid response"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: _body}}
      when status in [408, 429, 500, 502, 503, 529] and attempt < @max_retries ->
        Logger.warning(
          "[ReferenceAnalyzer] model attempt #{attempt} failed with #{status}; retrying"
        )

        Process.sleep(:timer.seconds(attempt * 2))
        call_vision_with_retry(messages, api_key, attempt + 1)

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, model_error(status, body)}

      {:error, %HTTPoison.Error{reason: reason}} when attempt < @max_retries ->
        Logger.warning(
          "[ReferenceAnalyzer] network attempt #{attempt} failed: #{inspect(reason)}"
        )

        Process.sleep(:timer.seconds(attempt * 2))
        call_vision_with_retry(messages, api_key, attempt + 1)

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error,
         "Reference analysis timed out or could not reach the model provider: #{inspect(reason)}"}
    end
  end

  defp build_recipe(payload, inferred) do
    evidence = %{
      "sampledFrames" =>
        Enum.map(payload["frames"], fn frame ->
          Map.take(frame, ["timestamp", "kind"])
        end),
      "cutTimestamps" => payload["cutTimestamps"],
      "audioPeaks" => payload["audioPeaks"]
    }

    inferred
    |> Map.put("schemaVersion", 1)
    |> Map.put("analysisVersion", @analysis_version)
    |> Map.put("metadata", payload["metadata"])
    |> Map.put("evidence", evidence)
  end

  defp validate_inferred_recipe(recipe) when is_map(recipe) do
    required_maps =
      ~w(confidence pacing captions typography colorGrade transitions motion effects layout audioCues aspectRatioAdaptation)

    required_scalars = ~w(mood genre summary)

    cond do
      not Enum.all?(required_maps, &is_map(recipe[&1])) ->
        {:error, "Reference model omitted required recipe sections"}

      not is_list(recipe["unsupported"]) ->
        {:error, "Reference model returned invalid renderer limitations"}

      not Enum.all?(required_scalars, &is_binary(recipe[&1])) ->
        {:error, "Reference model omitted the recipe summary"}

      true ->
        :ok
    end
  end

  defp validate_inferred_recipe(_), do: {:error, "Reference model returned an invalid recipe"}

  defp valid_dimensions?(metadata) do
    Enum.all?(~w(width height fps), fn key ->
      value = number(metadata[key])
      is_number(value) and value > 0
    end)
  end

  defp valid_frame?(frame, duration) when is_map(frame) do
    timestamp = number(frame["timestamp"])
    data = frame["base64Data"]

    is_number(timestamp) and timestamp >= 0 and timestamp <= duration and
      frame["kind"] in ["uniform", "cut-before", "cut-after"] and
      frame["mimeType"] == "image/jpeg" and is_binary(data) and data != "" and
      byte_size(data) <= @max_frame_base64_bytes and valid_base64?(data)
  end

  defp valid_frame?(_, _), do: false

  defp valid_base64?(data) do
    case Base.decode64(data) do
      {:ok, decoded} ->
        byte_size(decoded) > 0 and
          byte_size(decoded) <= div(@max_frame_base64_bytes * 3, 4)

      :error ->
        false
    end
  end

  defp valid_timestamps?(nil, _duration), do: true

  defp valid_timestamps?(timestamps, duration)
       when is_list(timestamps) and length(timestamps) <= 120 do
    Enum.all?(timestamps, fn value ->
      value = number(value)
      is_number(value) and value >= 0 and value <= duration
    end)
  end

  defp valid_timestamps?(_, _), do: false

  defp valid_audio_peaks?(nil, _duration), do: true

  defp valid_audio_peaks?(peaks, duration) when is_list(peaks) and length(peaks) <= 120 do
    Enum.all?(peaks, fn peak ->
      time = is_map(peak) && number(peak["time"])
      amplitude = is_map(peak) && number(peak["amplitude"])

      is_number(time) and time >= 0 and time <= duration and
        is_number(amplitude) and amplitude >= 0 and amplitude <= 1
    end)
  end

  defp valid_audio_peaks?(_, _), do: false

  defp pacing_stats(duration, cuts) do
    boundaries = [0.0] ++ cuts ++ [duration]

    shots =
      boundaries
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.map(fn [start_time, end_time] -> end_time - start_time end)
      |> Enum.sort()

    %{
      "cutsPerMinute" =>
        if(duration > 0, do: Float.round(length(cuts) * 60 / duration, 2), else: 0),
      "shotLengthSeconds" => %{
        "min" => shots |> List.first() |> round_number(),
        "median" => median(shots) |> round_number(),
        "max" => shots |> List.last() |> round_number()
      }
    }
  end

  defp median([]), do: 0

  defp median(values) do
    middle = div(length(values), 2)

    if rem(length(values), 2) == 0 do
      (Enum.at(values, middle - 1) + Enum.at(values, middle)) / 2
    else
      Enum.at(values, middle)
    end
  end

  defp round_number(nil), do: 0
  defp round_number(value), do: Float.round(value * 1.0, 2)

  defp parse_json_response(content) do
    cleaned =
      case Regex.run(~r/```(?:json)?\s*([\s\S]*?)\s*```/, content) do
        [_, json] ->
          String.trim(json)

        nil ->
          case Regex.run(~r/(\{[\s\S]*\})/, content) do
            [_, json] -> json
            nil -> content
          end
      end

    case Jason.decode(cleaned) do
      {:ok, parsed} when is_map(parsed) -> {:ok, parsed}
      _ -> {:error, "Reference model returned malformed recipe JSON"}
    end
  end

  defp model_error(402, _body), do: "Reference model provider quota is exhausted"
  defp model_error(429, _body), do: "Reference model provider is rate-limited; retry shortly"

  defp model_error(status, body),
    do: "Reference model failed with HTTP #{status}: #{String.slice(body, 0, 180)}"

  defp number(value) when is_number(value), do: value * 1.0

  defp number(value) when is_binary(value) do
    case Float.parse(value) do
      {number, ""} -> number
      _ -> nil
    end
  end

  defp number(_), do: nil

  defp configured_number(name, default) do
    case System.get_env(name) do
      nil -> default
      value -> number(value) || default
    end
  end

  defp configured_integer(name, default) do
    case Integer.parse(System.get_env(name) || "") do
      {value, ""} when value > 0 -> value
      _ -> default
    end
  end
end
