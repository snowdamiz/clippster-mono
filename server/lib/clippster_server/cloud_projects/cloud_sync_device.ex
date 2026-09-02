defmodule ClippsterServer.CloudProjects.CloudSyncDevice do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "cloud_sync_devices" do
    field :device_id, Ecto.UUID
    field :platform, :string
    field :device_name, :string
    field :last_seen_at, :utc_datetime

    belongs_to :user, ClippsterServer.Accounts.User, type: :id

    timestamps(type: :utc_datetime)
  end

  def changeset(device, attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    device
    |> cast(attrs, [:user_id, :device_id, :platform, :device_name, :last_seen_at])
    |> validate_required([:user_id, :device_id, :platform])
    |> put_change(:last_seen_at, Map.get(attrs, :last_seen_at, now))
    |> unique_constraint([:user_id, :device_id])
  end
end
