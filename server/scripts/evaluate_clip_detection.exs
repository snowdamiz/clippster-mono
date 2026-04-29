defmodule ClipDetectionEvaluation do
  @moduledoc """
  Offline evaluator for AI clip detection output.

  Usage:
      mix run scripts/evaluate_clip_detection.exs path/to/detection-result.json

  The JSON file should contain either `%{"clips" => [...]}` or a raw clips array.
  This evaluates output shape only; pair it with human-reviewed golden clips for
  recall scoring.
  """

  @ideal_min 30
  @ideal_max 45
  @weak_start_words ~w(and but or so then um uh like)

  def run([path]) do
    path
    |> File.read!()
    |> Jason.decode!()
    |> extract_clips()
    |> report()
  end

  def run(_) do
    IO.puts("Usage: mix run scripts/evaluate_clip_detection.exs path/to/detection-result.json")
    System.halt(1)
  end

  defp extract_clips(%{"clips" => %{"clips" => clips}}) when is_list(clips), do: clips
  defp extract_clips(%{"clips" => clips}) when is_list(clips), do: clips
  defp extract_clips(clips) when is_list(clips), do: clips

  defp extract_clips(_other) do
    IO.puts("Could not find clips in JSON.")
    System.halt(1)
  end

  defp report(clips) do
    total = length(clips)
    durations = Enum.map(clips, &duration/1)
    in_target = Enum.count(durations, &(&1 >= @ideal_min and &1 <= @ideal_max))
    overlong = Enum.count(durations, &(&1 > 90))
    weak_hooks = Enum.count(clips, &weak_start?/1)
    duplicates = duplicate_count(clips)
    avg_duration = if total > 0, do: Enum.sum(durations) / total, else: 0

    IO.puts("""
    Clip Detection Evaluation
    -------------------------
    clips_total: #{total}
    avg_duration_seconds: #{Float.round(avg_duration, 2)}
    percent_30_45s: #{percent(in_target, total)}
    weak_first_word_count: #{weak_hooks}
    duplicate_like_count: #{duplicates}
    over_90s_exception_count: #{overlong}
    avg_virality_score: #{Float.round(avg_score(clips), 2)}
    """)
  end

  defp duration(%{"total_duration" => value}) when is_number(value), do: value

  defp duration(%{"segments" => segments}) when is_list(segments) and length(segments) > 0 do
    first = hd(segments)
    last = List.last(segments)
    (last["end_time"] || 0) - (first["start_time"] || 0)
  end

  defp duration(_), do: 0

  defp weak_start?(clip) do
    clip
    |> transcript()
    |> String.downcase()
    |> String.trim()
    |> String.split(~r/\s+/, parts: 2)
    |> case do
      [word | _] -> String.replace(word, ~r/[^a-z0-9]/, "") in @weak_start_words
      _ -> false
    end
  end

  defp transcript(clip) do
    clip["combined_transcript"] ||
      (clip["segments"] || [])
      |> Enum.map_join(" ", &(&1["transcript"] || ""))
  end

  defp duplicate_count(clips) do
    normalized =
      clips
      |> Enum.map(&normalize(transcript(&1)))
      |> Enum.reject(&(&1 == ""))

    length(normalized) - length(Enum.uniq(normalized))
  end

  defp normalize(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s]/, "")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  defp avg_score([]), do: 0

  defp avg_score(clips) do
    clips
    |> Enum.map(fn clip -> clip["virality_score"] || 0 end)
    |> Enum.sum()
    |> Kernel./(length(clips))
  end

  defp percent(_count, 0), do: "0.0%"
  defp percent(count, total), do: "#{Float.round(count / total * 100, 1)}%"
end

ClipDetectionEvaluation.run(System.argv())
