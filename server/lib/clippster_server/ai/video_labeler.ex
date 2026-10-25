defmodule ClippsterServer.AI.VideoLabeler do
  @moduledoc """
  Gemini labelling for the AI video editor. Shot and segment boundaries are measured by the
  client; Gemini only describes what each already-measured range shows. It makes no editing
  decisions; Opus does all of that.
  """

  alias ClippsterServer.AI.{OpenRouterChat, VideoGenerationPolicy, VideoRun, VideoRuns}

  @max_media_base64_bytes 40_000_000
  @label_max_tokens 8_000

  @reference_prompt """
  You label the shots of an example video that a video editor will imitate. The shot boundaries
  are already measured; times are seconds from the start of this clip. For every listed shot,
  describe only what you can see. Return JSON:
  {"shots": [{"index": <shot index>,
    "shotType": "extreme-wide|wide|medium|close-up|extreme-close-up|insert|aerial|pov|text-only|graphic",
    "subject": "<what is on screen, a few words>",
    "action": "<what happens, a few words>",
    "camera": "static|pan|tilt|push-in|pull-out|tracking|handheld|orbit|zoom|drone",
    "onScreenText": "<exact words on screen, or null>",
    "textStyle": "<font look, weight, case, color, placement and how it animates, or null>",
    "effects": ["<visible effects, e.g. white flash, glitch, speed ramp, light leak, motion blur, letterbox, split screen, film grain>"],
    "color": "<grade: palette, contrast, warmth>",
    "role": "hook|establish|build|hero|payoff|outro|logo|transition",
    "confidence": <0-1>}]}
  Never guess at text you can't read; use null. Keep every string short.
  """

  @source_prompt """
  You label segments of a user's own footage so an editor can pick the best moments. The
  segment boundaries are measured; times are seconds from the start of this clip. For every
  listed segment, describe only what you can see. Return JSON:
  {"segments": [{"index": <segment index>,
    "description": "<plain description, under 12 words>",
    "shotType": "extreme-wide|wide|medium|close-up|extreme-close-up|insert|aerial|pov|text-only|graphic",
    "subject": "<main subject, a few words>",
    "camera": "static|pan|tilt|push-in|pull-out|tracking|handheld|orbit|zoom|drone",
    "quality": "good|soft|shaky|dark|overexposed|unusable",
    "hero": <0-1, how striking and share-worthy this moment is>,
    "text": "<words visible on screen, or null>"}]}
  """

  @photo_prompt """
  You label a user's photo so an editor can place it in a video. Return JSON:
  {"segments": [{"index": 0, "description": "<plain description, under 12 words>",
    "shotType": "extreme-wide|wide|medium|close-up|extreme-close-up|insert|aerial|graphic",
    "subject": "<main subject>", "quality": "good|soft|dark|overexposed|unusable",
    "hero": <0-1>, "text": "<words visible, or null>",
    "focus": {"x": <0-1 horizontal centre of the subject>, "y": <0-1 vertical centre>}}]}
  """

  @summary_prompt """
  You summarise the structure of an example video from its measured, labelled shots. Return JSON:
  {"sections": [{"name": "<plain name, e.g. Intro, Build-up, Fast hero section, Ending>", "start": <s>, "end": <s>}],
   "hero": {"start": <s>, "end": <s>} or null,
   "techniques": ["<3-8 short plain phrases a non-editor understands, e.g. White flash cuts, Bold uppercase titles>"],
   "summary": "<one sentence on the style>"}
  Sections cover the whole video without gaps, use shot boundaries, and follow changes in pace,
  energy and role. Base techniques on the labels and measurements only.
  """

  @doc "Label one chunk of the example. `shots` carry `index`, `start` and `end` relative to the chunk."
  @spec label_reference_chunk(VideoRun.t(), String.t(), [map()]) :: {:ok, %{String.t() => map()}} | {:error, String.t()}
  def label_reference_chunk(%VideoRun{} = run, video_base64, shots) do
    with :ok <- validate_media(video_base64),
         {:ok, %{"shots" => labels}} when is_list(labels) <-
           label(run, "video_reference_label", @reference_prompt, video_part(video_base64), %{"shots" => shots}) do
      {:ok, index_labels(labels, shots)}
    else
      {:ok, _} -> {:error, "The shot labels came back in the wrong shape."}
      error -> error
    end
  end

  @doc """
  Label one chunk of a user's video, or a photo (`kind` \"photo\", one segment). Segments carry
  `index` and absolute `start`/`end` in the source; Gemini sees them relative to `chunk_start`.
  """
  @spec label_source(VideoRun.t(), String.t(), String.t(), [map()], number()) :: {:ok, [map()]} | {:error, String.t()}
  def label_source(%VideoRun{} = run, kind, media_base64, segments, chunk_start) do
    {prompt, part} =
      if kind == "photo",
        do: {@photo_prompt, %{"type" => "image_url", "image_url" => %{"url" => "data:image/jpeg;base64," <> media_base64}}},
        else: {@source_prompt, video_part(media_base64)}

    ranges =
      Enum.map(segments, fn segment ->
        %{
          "index" => segment["index"],
          "start" => relative_time(segment["start"], chunk_start),
          "end" => relative_time(segment["end"], chunk_start)
        }
      end)

    with :ok <- validate_media(media_base64),
         {:ok, %{"segments" => labels}} when is_list(labels) <-
           label(run, "video_source_label", prompt, part, %{"segments" => ranges}) do
      by_index = index_labels(labels, segments)
      {:ok, Enum.map(segments, &Map.merge(&1, Map.get(by_index, to_string(&1["index"]), %{})))}
    else
      {:ok, _} -> {:error, "The segment labels came back in the wrong shape."}
      error -> error
    end
  end

  @doc "Sections, hero range and techniques from the labelled shots (text only)."
  @spec summarize_reference(VideoRun.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def summarize_reference(%VideoRun{} = run, blueprint) do
    shots =
      Enum.map(blueprint["shots"] || [], fn shot ->
        Map.take(shot, ~w(index start end transitionIn motion label))
      end)

    input = %{"duration" => blueprint["duration"], "stats" => blueprint["stats"], "shots" => shots}

    with {:ok, summary} <- request(run, "video_reference_summary", @summary_prompt, [text_part(Jason.encode!(input))]) do
      {:ok, Map.take(summary, ~w(sections hero techniques summary))}
    end
  end

  defp label(run, operation, prompt, media_part, ranges) do
    request(run, operation, prompt, [media_part, text_part(Jason.encode!(ranges))])
  end

  defp request(run, operation, prompt, parts) do
    model = VideoGenerationPolicy.label_model()

    payload = %{
      "model" => model,
      "messages" => [
        %{"role" => "system", "content" => prompt},
        %{"role" => "user", "content" => parts}
      ],
      "response_format" => %{"type" => "json_object"},
      "max_tokens" => @label_max_tokens,
      "temperature" => 0.2
    }

    with {:ok, %{message: message, usage: usage}} <-
           OpenRouterChat.complete(payload, title: "Clippster AI Video Labels", timeout_ms: 180_000) do
      VideoRuns.record_usage(run, model, operation, usage)
      OpenRouterChat.decode_json(OpenRouterChat.message_text(message))
    end
  end

  defp index_labels(labels, ranges) do
    known = MapSet.new(ranges, &to_string(&1["index"]))

    for %{"index" => index} = label <- labels, MapSet.member?(known, to_string(index)), into: %{} do
      {to_string(index), Map.delete(label, "index")}
    end
  end

  defp relative_time(time, chunk_start) when is_number(time), do: Float.round(max(time - chunk_start, 0) / 1, 3)
  defp relative_time(_time, _chunk_start), do: 0.0

  defp validate_media(data) when is_binary(data) and byte_size(data) in 1..@max_media_base64_bytes, do: :ok
  defp validate_media(_), do: {:error, "The media chunk is missing or too large."}

  defp video_part(base64), do: %{"type" => "video_url", "video_url" => %{"url" => "data:video/mp4;base64," <> base64}}
  defp text_part(text), do: %{"type" => "text", "text" => text}
end
