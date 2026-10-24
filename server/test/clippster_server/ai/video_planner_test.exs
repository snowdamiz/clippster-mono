defmodule ClippsterServer.AI.VideoPlannerTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.{ChatMessage, VideoPlanner, VideoSession}

  @session %VideoSession{
    media_items: [%{"id" => "m1", "kind" => "video"}, %{"id" => "p1", "kind" => "photo"}, %{"id" => "s1", "kind" => "audio"}]
  }

  test "normalises a plan: trims words, keeps visual media ids and totals the length" do
    plan = %{
      "title" => "  Launch  ",
      "aspect" => "1:1",
      "tone" => "",
      "beats" => [
        %{"seconds" => 2, "kind" => "scene", "what" => "Title", "words" => " HELLO ", "media" => ["p1", "s1"]},
        %{"seconds" => 3.25, "kind" => "footage", "what" => "Demo", "media" => ["m1", "m1"]}
      ]
    }

    assert {:ok,
            %{
              "title" => "Launch",
              "aspect" => "1:1",
              "seconds" => 5.3,
              "beats" => [
                %{"seconds" => 2.0, "kind" => "scene", "what" => "Title", "words" => "HELLO", "media" => ["p1"]},
                %{"seconds" => 3.3, "kind" => "footage", "what" => "Demo", "media" => ["m1"]}
              ]
            } = normalized} = VideoPlanner.validate_plan(plan, @session)

    refute Map.has_key?(normalized, "tone")
  end

  test "the example decides the shape" do
    plan = %{"title" => "T", "aspect" => "9:16", "beats" => [%{"seconds" => 2, "kind" => "scene", "what" => "x"}]}
    assert {:ok, normalized} = VideoPlanner.validate_plan(plan, %{@session | reference_blueprint: %{"shots" => []}})
    refute Map.has_key?(normalized, "aspect")
  end

  test "reports every problem so the model can fix them" do
    plan = %{
      "aspect" => "3:2",
      "beats" => [
        %{"seconds" => 40, "kind" => "footage", "what" => "x", "media" => ["s1"]},
        %{"seconds" => 25, "kind" => "wipe", "what" => ""},
        "nope"
      ]
    }

    assert {:error, errors} = VideoPlanner.validate_plan(plan, @session)

    assert errors == [
             "Give the plan a title.",
             "The beats add up to 65.0 s; the video can be at most 60 s.",
             "aspect must be one of 16:9, 9:16, 1:1, 4:5.",
             "Beat 1: seconds must be 0.5 to 30.",
             "Beat 1: footage needs the id of one of the user's videos or photos.",
             "Beat 2: kind must be scene or footage.",
             "Beat 2: say what the viewer sees.",
             "Beat 3 must be an object."
           ]

    assert {:error, ["plan must be an object."]} = VideoPlanner.validate_plan(nil, @session)
  end

  test "reads the planning chat and its newest plan, ignoring other messages" do
    message = fn id, role, content, metadata -> %ChatMessage{id: id, role: role, content: content, metadata: metadata} end

    session = %{
      @session
      | messages: [
          message.(1, "user", "Make a video", %{"phase" => "plan"}),
          message.(2, "assistant", "Plan one", %{"phase" => "plan", "plan" => %{"title" => "One"}}),
          message.(3, "assistant", "Plan two", %{"phase" => "plan", "plan" => %{"title" => "Two"}}),
          message.(4, "assistant", "Here's your video.", %{"run_id" => 1})
        ]
    }

    assert VideoPlanner.latest_plan(session) == %{"title" => "Two"}
    assert VideoPlanner.chat(session, 2) == [%{"role" => "assistant", "content" => "Plan one"}, %{"role" => "assistant", "content" => "Plan two"}]
    assert VideoPlanner.latest_plan(@session) == nil
  end
end
