defmodule ClippsterServer.AI.ChatSessionsReferenceTest do
  use ClippsterServer.DataCase, async: true

  import ClippsterServer.AccountsFixtures
  alias ClippsterServer.AI.ChatSessions

  test "persists, reopens, and removes a versioned reference recipe" do
    user = google_user_fixture()
    {:ok, session} = ChatSessions.create_session(user.id)

    recipe = %{
      "schemaVersion" => 1,
      "analysisVersion" => "temporal-edit-recipe/1.0.0",
      "summary" => "Fast cuts"
    }

    assert {:ok, _} =
             ChatSessions.save_reference_analysis(session, recipe, "https://youtu.be/video")

    reopened = ChatSessions.get_session!(session.id)
    assert reopened.reference_analysis == recipe
    assert reopened.reference_url == "https://youtu.be/video"

    assert {:ok, _} = ChatSessions.save_reference_analysis(reopened, nil, nil)
    reopened = ChatSessions.get_session!(session.id)
    assert is_nil(reopened.reference_analysis)
    assert is_nil(reopened.reference_url)
  end

  test "persists the complete selected style recipe" do
    user = google_user_fixture()
    {:ok, session} = ChatSessions.create_session(user.id)

    pack = %{
      "schemaVersion" => 1,
      "id" => "viral-social",
      "aspectRatios" => %{"9:16" => %{"layout" => "primary"}}
    }

    assert {:ok, _} =
             ChatSessions.update_session(session, %{
               style_context: %{"style" => "viral-social", "stylePack" => pack}
             })

    assert ChatSessions.get_session!(session.id).style_context["stylePack"] == pack
  end
end
