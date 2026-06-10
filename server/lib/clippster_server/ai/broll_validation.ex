defmodule ClippsterServer.AI.BrollValidation do
  @moduledoc """
  Validates and normalizes AI B-roll planner responses.
  """

  @doc """
  Normalize planner suggestions: clamp times, enforce gaps, drop invalid entries.
  """
  def normalize_suggestions(suggestions, clip_duration, opts \\ [])

  def normalize_suggestions(suggestions, clip_duration, opts) when is_list(suggestions) do
    density = Keyword.get(opts, :density, "low")
    min_gap = min_gap_seconds(clip_duration, density)
    max_coverage = max_coverage_ratio(clip_duration, density)

    suggestions
    |> Enum.map(&normalize_one/1)
    |> Enum.filter(&valid_suggestion?/1)
    |> Enum.map(fn s -> clamp_times(s, clip_duration) end)
    |> Enum.filter(fn s -> s["endTime"] > s["startTime"] end)
    |> enforce_minimum_gap(min_gap)
    |> enforce_max_coverage(clip_duration, max_coverage)
  end

  def normalize_suggestions(_, _, _), do: []

  defp min_gap_seconds(duration, "high") when duration < 30, do: 3.0
  defp min_gap_seconds(_duration, "high"), do: 4.0
  defp min_gap_seconds(duration, "medium") when duration < 30, do: 3.5
  defp min_gap_seconds(_duration, "medium"), do: 5.0
  defp min_gap_seconds(_duration, _), do: 5.0

  defp max_coverage_ratio(duration, "high") when duration < 30, do: 0.55
  defp max_coverage_ratio(_duration, "high"), do: 0.50
  defp max_coverage_ratio(duration, "medium") when duration < 30, do: 0.48
  defp max_coverage_ratio(_duration, "medium"), do: 0.42
  defp max_coverage_ratio(_duration, _), do: 0.35

  defp normalize_one(raw) when is_map(raw) do
    %{
      "id" => Map.get(raw, "id") || Map.get(raw, :id) || Ecto.UUID.generate(),
      "startTime" => to_float(Map.get(raw, "startTime") || Map.get(raw, "start_time")),
      "endTime" => to_float(Map.get(raw, "endTime") || Map.get(raw, "end_time")),
      "transcriptText" =>
        as_string(Map.get(raw, "transcriptText") || Map.get(raw, "transcript_text") || ""),
      "reason" => as_string(Map.get(raw, "reason") || ""),
      "visualQuery" => as_string(Map.get(raw, "visualQuery") || Map.get(raw, "visual_query") || ""),
      "generationPrompt" =>
        optional_string(Map.get(raw, "generationPrompt") || Map.get(raw, "generation_prompt")),
      "sourceType" =>
        normalize_source_type(Map.get(raw, "sourceType") || Map.get(raw, "source_type")),
      "confidence" => clamp_confidence(Map.get(raw, "confidence")),
      "status" => "suggested",
      "candidates" => []
    }
  end

  defp normalize_one(_), do: nil

  defp valid_suggestion?(nil), do: false

  defp valid_suggestion?(s) do
    String.trim(s["visualQuery"]) != "" and s["endTime"] > s["startTime"]
  end

  defp clamp_times(s, duration) do
    start_t = max(0.0, min(s["startTime"], duration))
    end_t = max(start_t + 0.5, min(s["endTime"], duration))
    Map.merge(s, %{"startTime" => start_t, "endTime" => end_t})
  end

  defp enforce_minimum_gap(suggestions, min_gap) do
    suggestions
    |> Enum.sort_by(& &1["startTime"])
    |> Enum.reduce([], fn s, acc ->
      case acc do
        [] ->
          [s]

        [prev | _] ->
          if s["startTime"] - prev["endTime"] >= min_gap do
            [s | acc]
          else
            acc
          end
      end
    end)
    |> Enum.reverse()
  end

  defp enforce_max_coverage(suggestions, duration, max_ratio) when duration > 0 do
    total =
      suggestions
      |> Enum.map(fn s -> s["endTime"] - s["startTime"] end)
      |> Enum.sum()

    if total / duration > max_ratio do
      suggestions
      |> Enum.sort_by(& &1["confidence"], :desc)
      |> take_until_coverage(duration * max_ratio)
    else
      suggestions
    end
  end

  defp enforce_max_coverage(suggestions, _, _), do: suggestions

  defp take_until_coverage(suggestions, max_seconds) do
    Enum.reduce(suggestions, {[], 0.0}, fn s, {acc, used} ->
      dur = s["endTime"] - s["startTime"]

      if used + dur <= max_seconds do
        {[s | acc], used + dur}
      else
        {acc, used}
      end
    end)
    |> elem(0)
    |> Enum.reverse()
  end

  defp to_float(v) when is_number(v), do: v * 1.0

  defp to_float(v) when is_binary(v) do
    case Float.parse(v) do
      {f, _} -> f
      :error -> 0.0
    end
  end

  defp to_float(_), do: 0.0

  defp as_string(v) when is_binary(v), do: v
  defp as_string(v) when is_nil(v), do: ""
  defp as_string(v), do: inspect(v)

  defp optional_string(v) when is_binary(v) and v != "", do: v
  defp optional_string(_), do: nil

  defp normalize_source_type("generated"), do: "generated"
  defp normalize_source_type("library"), do: "library"
  defp normalize_source_type("manual"), do: "manual"
  defp normalize_source_type(_), do: "stock"

  defp clamp_confidence(v) when is_number(v), do: max(0.0, min(v, 1.0))
  defp clamp_confidence(_), do: 0.5
end
