defmodule ClippsterServer.AI.VideoSessionContextTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.{VideoAgent, VideoSession}

  test "offers web research alongside editing tools" do
    assert Enum.any?(VideoAgent.tools(), &(&1["type"] == "openrouter:web_search"))
    assert Enum.any?(VideoAgent.tools(), &(&1["type"] == "openrouter:web_fetch"))
    assert Enum.any?(VideoAgent.tools(), &(&1["function"]["name"] == "read_speech_window"))
  end

  test "summarizes a long source while keeping exact timing available through tools" do
    segments =
      for index <- 0..299 do
        %{
          "index" => index,
          "start" => index * 4,
          "end" => (index + 1) * 4,
          "description" => "Speaker view"
        }
      end

    session = %VideoSession{
      media_items: [
        %{
          "id" => "video",
          "contentHash" => "hash",
          "kind" => "video",
          "name" => "Podcast",
          "duration" => 1200
        }
      ],
      source_index: %{"hash" => %{"all" => %{"segments" => segments}}},
      speech_index: %{
        "hash" => [
          %{
            "start" => 0,
            "end" => 3,
            "text" => "Welcome",
            "speakerId" => "0:1",
            "speakerName" => "Host",
            "speakerPosition" => "left"
          },
          %{
            "start" => 4,
            "end" => 8,
            "text" => "Thanks",
            "speakerId" => "0:2",
            "speakerName" => "Guest",
            "speakerPosition" => "right"
          }
        ]
      }
    }

    "# Session context\n" <> json = VideoAgent.session_context(session)
    context = Jason.decode!(json)
    assert length(context["sources"]["video"]) == 20
    assert hd(context["sources"]["video"])["end"] == 60

    assert context["speech"]["video"] |> hd() |> Map.fetch!("speakers") == [
             %{"speakerId" => "0:1", "speakerName" => "Host", "speakerPosition" => "left"},
             %{"speakerId" => "0:2", "speakerName" => "Guest", "speakerPosition" => "right"}
           ]
  end
end
