defmodule ClippsterServer.AI.VideoBlueprintTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.VideoBlueprint

  @measurement %{
    "duration" => 6.0,
    "width" => 1920,
    "height" => 1080,
    "fps" => 30,
    "shots" => [
      %{"index" => 0, "start" => 0.0, "end" => 2.0, "duration" => 2.0, "transitionIn" => "start", "keyframePath" => "C:/tmp/k0.jpg"},
      %{"index" => 1, "start" => 2.0, "end" => 3.0, "duration" => 1.0, "transitionIn" => "cut"},
      %{"index" => 2, "start" => 3.0, "end" => 6.0, "duration" => 3.0, "transitionIn" => "flash"}
    ]
  }

  test "merges labels, drops local paths and computes pacing stats" do
    labels = %{"0" => %{"0" => %{"shotType" => "wide"}}, "1" => %{"2" => %{"shotType" => "close-up"}}}
    beats = %{"bpm" => 120, "bpmConfidence" => "high", "beats" => [%{"time" => 2.04, "strength" => 1.0}, %{"time" => 4.5, "strength" => 0.4}]}

    blueprint = VideoBlueprint.build(@measurement, labels, beats)

    assert Enum.map(blueprint["shots"], & &1["label"]) == [%{"shotType" => "wide"}, nil, %{"shotType" => "close-up"}]
    refute Enum.any?(blueprint["shots"], &Map.has_key?(&1, "keyframePath"))

    assert blueprint["stats"] == %{
             "shots" => 3,
             "medianShot" => 2.0,
             "shortestShot" => 1.0,
             "longestShot" => 3.0,
             "cutsPerMinute" => 20.0,
             "cutsOnBeat" => 0.5,
             "transitions" => %{"cut" => 1, "flash" => 1}
           }

    assert blueprint["beats"]["bpm"] == 120
  end

  test "leaves the beat share empty without music" do
    blueprint = VideoBlueprint.build(@measurement, nil, nil)
    assert blueprint["stats"]["cutsOnBeat"] == nil
    assert blueprint["beats"] == nil
  end
end
