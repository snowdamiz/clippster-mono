defmodule ClippsterServer.CloudMedia.CloudMediaAsset do
  use Ecto.Schema
  import Ecto.Changeset

  @asset_types ~w(raw_vod built_clip thumbnail)
  @upload_statuses ~w(pending uploading completed failed)

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "cloud_media_assets" do
    field :asset_type, :string
    field :r2_key, :string
    field :filename, :string
    field :size_bytes, :integer, default: 0
    field :reserved_bytes, :integer, default: 0
    field :checksum, :string
    field :upload_status, :string, default: "pending"
    field :optional, :boolean, default: true

    belongs_to :cloud_project, ClippsterServer.CloudProjects.CloudProject, type: :binary_id
    belongs_to :user, ClippsterServer.Accounts.User, type: :id

    timestamps(type: :utc_datetime)
  end

  def create_changeset(asset, attrs) do
    asset
    |> cast(attrs, [
      :id,
      :cloud_project_id,
      :user_id,
      :asset_type,
      :r2_key,
      :filename,
      :size_bytes,
      :reserved_bytes,
      :checksum,
      :upload_status,
      :optional
    ])
    |> validate_required([:cloud_project_id, :user_id, :asset_type, :r2_key, :filename])
    |> validate_inclusion(:asset_type, @asset_types)
    |> validate_inclusion(:upload_status, @upload_statuses)
    |> unique_constraint(:r2_key)
  end

  def complete_changeset(asset, attrs) do
    asset
    |> cast(attrs, [:size_bytes, :checksum, :upload_status, :reserved_bytes])
    |> validate_required([:size_bytes, :upload_status])
    |> validate_inclusion(:upload_status, @upload_statuses)
  end

  def asset_types, do: @asset_types
end
