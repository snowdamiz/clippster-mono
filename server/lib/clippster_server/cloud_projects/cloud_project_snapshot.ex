defmodule ClippsterServer.CloudProjects.CloudProjectSnapshot do
  use Ecto.Schema
  import Ecto.Changeset

  schema "cloud_project_snapshots" do
    field :snapshot_json, :map
    field :snapshot_version, :integer, default: 1

    belongs_to :cloud_project, ClippsterServer.CloudProjects.CloudProject, type: :binary_id

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [:cloud_project_id, :snapshot_json, :snapshot_version])
    |> validate_required([:cloud_project_id, :snapshot_json])
  end
end
