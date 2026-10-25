defmodule ClippsterServer.AI.VideoSessionsTest do
  use ClippsterServer.DataCase, async: true

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.AI.VideoSessions

  test "source labels merge per clip and chunk, starting from an empty index" do
    {:ok, session} = VideoSessions.create_session(email_user_fixture().id, %{})

    :ok = VideoSessions.put_source_labels(session, "h1", "0-3", %{"segments" => [%{"index" => 0}]})
    :ok = VideoSessions.put_source_labels(session, "h1", "4-7", %{"segments" => [%{"index" => 4}]})
    :ok = VideoSessions.put_source_labels(session, "h2", "photo", %{"segments" => [%{"index" => 0}]})

    assert VideoSessions.get_session!(session.id).source_index == %{
             "h1" => %{"0-3" => %{"segments" => [%{"index" => 0}]}, "4-7" => %{"segments" => [%{"index" => 4}]}},
             "h2" => %{"photo" => %{"segments" => [%{"index" => 0}]}}
           }
  end

  test "example labels merge per chunk" do
    {:ok, session} = VideoSessions.create_session(email_user_fixture().id, %{})

    :ok = VideoSessions.put_reference_labels(session, 0, [%{"index" => 0}])
    :ok = VideoSessions.put_reference_labels(session, 1, [%{"index" => 5}])

    assert VideoSessions.get_session!(session.id).reference_labels == %{"0" => [%{"index" => 0}], "1" => [%{"index" => 5}]}
  end
end
