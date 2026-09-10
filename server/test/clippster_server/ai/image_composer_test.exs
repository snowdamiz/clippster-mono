defmodule ClippsterServer.AI.ImageComposerTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.AI.ImageComposer

  test "preserves a material follow-up question without marking the prompt ready" do
    assert ImageComposer.normalize_discovery(%{
             "message" => "Should this be a square product image or a wide hero banner?",
             "ready_to_generate" => false,
             "expanded_prompt" => nil,
             "aspect_ratio" => "16:9"
           }) == %{
             "message" => "Should this be a square product image or a wide hero banner?",
             "ready_to_generate" => false,
             "expanded_prompt" => nil,
             "aspect_ratio" => "16:9"
           }
  end

  test "requires a non-empty expanded prompt before generation is ready" do
    response =
      ImageComposer.normalize_discovery(%{
        "message" => "Ready",
        "ready_to_generate" => true,
        "expanded_prompt" => ""
      })

    refute response["ready_to_generate"]
    assert is_nil(response["expanded_prompt"])
  end

  test "normalizes unsupported aspect ratios to square" do
    response =
      ImageComposer.normalize_discovery(%{
        "message" => "Ready",
        "ready_to_generate" => true,
        "expanded_prompt" => "Detailed production prompt",
        "aspect_ratio" => "4:3"
      })

    assert response["ready_to_generate"]
    assert response["aspect_ratio"] == "1:1"
  end

  test "extracts http urls from a user message" do
    assert ImageComposer.extract_urls(
             "Use colors from https://openworth.io and also https://example.com/about."
           ) == ["https://openworth.io", "https://example.com/about"]
  end

  test "prefers an already-ready expanded prompt from session metadata" do
    session = %{
      brief_summary: nil,
      messages: [
        %{
          role: "assistant",
          metadata: %{
            "ready_to_generate" => true,
            "expanded_prompt" => "Standalone cyan O+T crypto mark",
            "aspect_ratio" => "1:1"
          }
        }
      ]
    }

    assert ImageComposer.ready_prompt_from_session(session) ==
             {:ok, "Standalone cyan O+T crypto mark", "1:1"}
  end

  test "normalizes revision readiness and requires an edit prompt" do
    ready =
      ImageComposer.normalize_revise(%{
        "message" => "I'll soften the glow and keep the monogram.",
        "ready_to_edit" => true,
        "edit_prompt" => "Reduce neon glow; keep cyan/navy monogram; white background",
        "aspect_ratio" => "1:1"
      })

    assert ready["ready_to_edit"]
    assert ready["edit_prompt"] =~ "Reduce neon glow"

    not_ready =
      ImageComposer.normalize_revise(%{
        "message" => "How strong should the glow be?",
        "ready_to_edit" => true,
        "edit_prompt" => "",
        "aspect_ratio" => "1:1"
      })

    refute not_ready["ready_to_edit"]
    assert is_nil(not_ready["edit_prompt"])
  end

  test "reads a ready edit prompt from session metadata" do
    session = %{
      brief_summary: nil,
      messages: [
        %{
          role: "assistant",
          metadata: %{
            "ready_to_edit" => true,
            "edit_prompt" => "Make the mark sharper and less glowing",
            "aspect_ratio" => "1:1"
          }
        }
      ]
    }

    assert ImageComposer.ready_edit_prompt_from_session(session) ==
             {:ok, "Make the mark sharper and less glowing", "1:1"}
  end

  test "extracts og and twitter image urls from html" do
    html = """
    <html><head>
      <meta property="og:image" content="https://cdn.example.com/a.jpg" />
      <meta name="twitter:image" content="https://cdn.example.com/b.jpg" />
    </head></html>
    """

    assert ImageComposer.extract_og_image_urls(html, "https://example.com/page") == [
             "https://cdn.example.com/a.jpg",
             "https://cdn.example.com/b.jpg"
           ]
  end

  test "select_candidate marks one candidate and updates thumbnail url" do
    session = %{
      candidates: [
        %{"id" => "c0", "url" => "https://img/a.png", "selected" => true},
        %{"id" => "c1", "url" => "https://img/b.png", "selected" => false}
      ],
      composition: %{"mode" => "image_creation"}
    }

    assert {:ok, selected} = ImageComposer.select_candidate(session, 1)
    assert selected.thumbnail_url == "https://img/b.png"
    assert Enum.at(selected.candidates, 0)["selected"] == false
    assert Enum.at(selected.candidates, 1)["selected"] == true
  end

  test "visual_refs_from_session tolerates unloaded messages association" do
    session = %{
      brief_summary: %{
        "visual_reference_urls" => ["https://cdn.example.com/host.jpg"]
      },
      messages: %Ecto.Association.NotLoaded{
        __field__: :messages,
        __owner__: ClippsterServer.AI.ThumbnailSession,
        __cardinality__: :many
      }
    }

    assert ImageComposer.visual_refs_from_session(session) == [
             "https://cdn.example.com/host.jpg"
           ]
  end
end
