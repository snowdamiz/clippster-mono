defmodule ClippsterServer.AI.VideoBlueprint do
  @moduledoc """
  Builds the example video's blueprint from the client's frame-accurate measurement, the Gemini
  shot labels collected per chunk, and the music beat grid.
  """

  @on_beat_tolerance 0.1
  @shot_fields ~w(index start end duration transitionIn motion motionPeak brightness saturation averageColor speedRampHint freezeHint flashes)

  @doc "Merge measurement, labels (chunk index => shot index => label) and beats into a blueprint."
  @spec build(map(), map() | nil, map() | nil) :: map()
  def build(measurement, chunk_labels, beats) do
    labels = flatten_labels(chunk_labels || %{})

    shots =
      Enum.map(measurement["shots"] || [], fn shot ->
        shot
        |> Map.take(@shot_fields)
        |> Map.put("label", Map.get(labels, to_string(shot["index"])))
      end)

    beat_times = beat_times(beats)

    %{
      "duration" => measurement["duration"],
      "width" => measurement["width"],
      "height" => measurement["height"],
      "fps" => measurement["fps"],
      "shots" => shots,
      "beats" => beats_summary(beats),
      "stats" => stats(shots, measurement["duration"], beat_times)
    }
  end

  defp flatten_labels(chunk_labels) do
    chunk_labels
    |> Map.values()
    |> Enum.reduce(%{}, fn labels, acc when is_map(labels) -> Map.merge(acc, labels) end)
  end

  defp stats([], _duration, _beats), do: %{"shots" => 0}

  defp stats(shots, duration, beat_times) do
    durations = Enum.map(shots, & &1["duration"]) |> Enum.sort()
    cuts = shots |> Enum.drop(1) |> Enum.map(& &1["start"])

    %{
      "shots" => length(shots),
      "medianShot" => round3(median(durations)),
      "shortestShot" => round3(List.first(durations)),
      "longestShot" => round3(List.last(durations)),
      "cutsPerMinute" => if(is_number(duration) and duration > 0, do: round3(length(cuts) / duration * 60), else: nil),
      "cutsOnBeat" => cuts_on_beat(cuts, beat_times),
      "transitions" => Enum.frequencies_by(shots |> Enum.drop(1), & &1["transitionIn"])
    }
  end

  defp cuts_on_beat(_cuts, []), do: nil
  defp cuts_on_beat([], _beats), do: nil

  defp cuts_on_beat(cuts, beats) do
    on_beat = Enum.count(cuts, fn cut -> Enum.any?(beats, &(abs(&1 - cut) <= @on_beat_tolerance)) end)
    round3(on_beat / length(cuts))
  end

  defp beat_times(%{"beats" => beats}) when is_list(beats), do: for(%{"time" => t} <- beats, is_number(t), do: t)
  defp beat_times(_), do: []

  defp beats_summary(%{"beats" => beats} = grid) when is_list(beats) do
    %{"bpm" => grid["bpm"], "confidence" => grid["bpmConfidence"], "beats" => beats}
  end

  defp beats_summary(_), do: nil

  defp median(sorted) do
    count = length(sorted)
    middle = div(count, 2)

    if rem(count, 2) == 1,
      do: Enum.at(sorted, middle),
      else: (Enum.at(sorted, middle - 1) + Enum.at(sorted, middle)) / 2
  end

  defp round3(value) when is_number(value), do: Float.round(value * 1.0, 3)
  defp round3(value), do: value
end
