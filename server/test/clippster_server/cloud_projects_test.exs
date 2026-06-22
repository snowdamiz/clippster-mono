defmodule ClippsterServer.CloudProjectsTest do
  use ClippsterServer.DataCase, async: true

  alias ClippsterServer.{Accounts, CloudProjects, Repo}
  alias ClippsterServer.CloudProjects.CloudProject

  @snapshot %{
    "schema_version" => 1,
    "project" => %{
      "id" => "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name" => "Test Project",
      "description" => nil,
      "platform" => "Kick",
      "active_vod_preset_id" => nil,
      "active_vod_preset_config" => nil,
      "thumbnail_path" => nil,
      "updated_at" => 1_719_000_000_000
    },
    "raw_videos" => [],
    "clips" => [],
    "transcripts" => [],
    "clip_builds" => []
  }

  setup do
  {:ok, user} =
      Accounts.register_with_email("cloudsync#{System.unique_integer()}@test.com", "password12345!")

    %{user: user}
  end

  test "push and pull snapshot roundtrip", %{user: user} do
    project_id = @snapshot["project"]["id"]
    device_id = Ecto.UUID.generate()

    assert {:ok, _project} =
             CloudProjects.create_from_snapshot(user.id, @snapshot, device_id, 1_719_000_000_000)

    assert {:ok, data} = CloudProjects.full_project_response(user.id, project_id)
    assert data.snapshot["project"]["name"] == "Test Project"
  end

  test "returns conflict when pushing stale snapshot", %{user: user} do
    project_id = @snapshot["project"]["id"]
    device_id = Ecto.UUID.generate()

    assert {:ok, _} =
             CloudProjects.push_snapshot(user.id, project_id, @snapshot, device_id, 2_000_000_000_000)

    stale_snapshot = put_in(@snapshot, ["project", "updated_at"], 1_000_000_000_000)

    assert {:error, :conflict, body} =
             CloudProjects.push_snapshot(user.id, project_id, stale_snapshot, device_id, 1_000_000_000_000)

    assert body.snapshot["project"]["name"] == "Test Project"
  end

  test "user cannot read another user's project", %{user: user} do
    {:ok, other} =
      Accounts.register_with_email("other#{System.unique_integer()}@test.com", "password12345!")

    project_id = @snapshot["project"]["id"]
    device_id = Ecto.UUID.generate()

    assert {:ok, _} =
             CloudProjects.create_from_snapshot(user.id, @snapshot, device_id, 1_719_000_000_000)

    assert {:error, :not_found} = CloudProjects.get_project!(other.id, project_id)
    refute Repo.get_by(CloudProject, id: project_id, user_id: other.id)
  end
end
