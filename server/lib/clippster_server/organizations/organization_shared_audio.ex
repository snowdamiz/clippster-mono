defmodule ClippsterServer.Organizations.OrganizationSharedAudio do
  @moduledoc """
  Schema for organization shared audio - music and sound files distributed to org members.
  Audio auto-expires after 30 days.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @max_duration_seconds 600
  @expiration_days 30

  schema "organization_shared_audio" do
    field :name, :string
    field :description, :string
    field :url, :string
    field :mime_type, :string
    field :duration, :decimal
    field :file_size, :integer
    field :share_with_all, :boolean, default: true
    field :expires_at, :utc_datetime

    belongs_to :organization, ClippsterServer.Organizations.Organization
    belongs_to :uploaded_by, ClippsterServer.Accounts.User, foreign_key: :uploaded_by_user_id

    has_many :recipients, ClippsterServer.Organizations.SharedAudioRecipient,
      foreign_key: :shared_audio_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new shared audio file.
  Automatically sets expires_at to 30 days from now.
  """
  def create_changeset(audio, attrs) do
    audio
    |> cast(attrs, [
      :organization_id,
      :uploaded_by_user_id,
      :name,
      :description,
      :url,
      :mime_type,
      :duration,
      :file_size,
      :share_with_all
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
  Changeset for updating basic audio info (name, description).
  """
  def update_changeset(audio, attrs) do
    audio
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

  def max_duration_seconds, do: @max_duration_seconds
  def expiration_days, do: @expiration_days

  def expired?(%__MODULE__{expires_at: expires_at}) do
    DateTime.compare(DateTime.utc_now(), expires_at) == :gt
  end

  def days_until_expiration(%__MODULE__{expires_at: expires_at}) do
    diff_seconds = DateTime.diff(expires_at, DateTime.utc_now())
    max(0, div(diff_seconds, 86400))
  end
end
