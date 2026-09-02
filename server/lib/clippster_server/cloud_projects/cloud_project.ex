defmodule ClippsterServer.CloudProjects.CloudProject do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "cloud_projects" do
    field :name, :string
    field :schema_version, :integer, default: 1
    field :deleted_at, :utc_datetime
    field :last_writer_device_id, Ecto.UUID
    field :server_updated_at, :utc_datetime
    field :client_updated_at, :integer

    belongs_to :user, ClippsterServer.Accounts.User, type: :id

    has_many :snapshots, ClippsterServer.CloudProjects.CloudProjectSnapshot,
      foreign_key: :cloud_project_id

    has_many :media_assets, ClippsterServer.CloudMedia.CloudMediaAsset,
      foreign_key: :cloud_project_id

    timestamps(type: :utc_datetime)
  end

  def create_changeset(project, attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    project
    |> cast(attrs, [:id, :user_id, :name, :schema_version, :last_writer_device_id, :client_updated_at])
    |> validate_required([:user_id, :name])
    |> put_change(:server_updated_at, now)
    |> unique_constraint(:id)
  end

  def update_meta_changeset(project, attrs) do
    project
    |> cast(attrs, [:name, :schema_version, :last_writer_device_id, :client_updated_at, :server_updated_at])
  end

  def soft_delete_changeset(project) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    project
    |> change()
    |> put_change(:deleted_at, now)
    |> put_change(:server_updated_at, now)
  end
end
