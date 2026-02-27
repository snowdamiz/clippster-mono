defmodule ClippsterServer.Organizations.OrganizationSharedClip do
  @moduledoc """
  Schema for organization shared clips - videos distributed to org members.
  Clips auto-expire after 7 days and can include mandatory branding per aspect ratio.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @max_duration_seconds 180
  @expiration_days 7

  schema "organization_shared_clips" do
    field :name, :string
    field :description, :string
    field :url, :string
    field :thumbnail_url, :string
    field :duration, :decimal
    field :file_size, :integer
    field :share_with_all, :boolean, default: true
    field :branding_config, :map, default: %{}
    field :branding_required, :boolean, default: true
    field :expires_at, :utc_datetime

    belongs_to :organization, ClippsterServer.Organizations.Organization
    belongs_to :uploaded_by, ClippsterServer.Accounts.User, foreign_key: :uploaded_by_user_id

    has_many :recipients, ClippsterServer.Organizations.SharedClipRecipient,
      foreign_key: :shared_clip_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new shared clip.
  Automatically sets expires_at to 7 days from now.
  """
  def create_changeset(clip, attrs) do
    clip
    |> cast(attrs, [
      :organization_id,
      :uploaded_by_user_id,
      :name,
      :description,
      :url,
      :thumbnail_url,
      :duration,
      :file_size,
      :share_with_all,
      :branding_config,
      :branding_required
    ])
    |> validate_required([:organization_id, :name, :url])
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 2000)
    |> validate_number(:duration, greater_than: 0, less_than_or_equal_to: @max_duration_seconds)
    |> validate_number(:file_size, greater_than: 0)
    |> put_expiration()
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:uploaded_by_user_id)
  end

  @doc """
  Changeset for updating branding configuration.
  """
  def update_branding_changeset(clip, attrs) do
    clip
    |> cast(attrs, [:branding_config, :branding_required])
  end

  @doc """
  Changeset for updating basic clip info (name, description).
  """
  def update_changeset(clip, attrs) do
    clip
    |> cast(attrs, [:name, :description])
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 2000)
  end

  defp put_expiration(changeset) do
    case get_field(changeset, :expires_at) do
      nil ->
        expires_at =
          DateTime.utc_now()
          |> DateTime.add(@expiration_days * 24 * 60 * 60, :second)
          |> DateTime.truncate(:second)

        put_change(changeset, :expires_at, expires_at)

      _ ->
        changeset
    end
  end

  @doc """
  Returns the maximum allowed duration in seconds.
  """
  def max_duration_seconds, do: @max_duration_seconds

  @doc """
  Returns the expiration period in days.
  """
  def expiration_days, do: @expiration_days

  @doc """
  Checks if a clip has expired.
  """
  def expired?(%__MODULE__{expires_at: expires_at}) do
    DateTime.compare(DateTime.utc_now(), expires_at) == :gt
  end

  @doc """
  Returns the number of days until expiration.
  """
  def days_until_expiration(%__MODULE__{expires_at: expires_at}) do
    diff_seconds = DateTime.diff(expires_at, DateTime.utc_now())
    max(0, div(diff_seconds, 86400))
  end
end
