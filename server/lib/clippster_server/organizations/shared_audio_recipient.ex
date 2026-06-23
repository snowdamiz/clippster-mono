defmodule ClippsterServer.Organizations.SharedAudioRecipient do
  @moduledoc """
  Schema for tracking shared audio recipients and their actions.
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "organization_shared_audio_recipients" do
    field :viewed_at, :utc_datetime
    field :downloaded_at, :utc_datetime

    belongs_to :shared_audio, ClippsterServer.Organizations.OrganizationSharedAudio
    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def create_changeset(recipient, attrs) do
    recipient
    |> cast(attrs, [:shared_audio_id, :user_id])
    |> validate_required([:shared_audio_id, :user_id])
    |> unique_constraint([:shared_audio_id, :user_id])
    |> foreign_key_constraint(:shared_audio_id)
    |> foreign_key_constraint(:user_id)
  end

  def mark_viewed_changeset(recipient) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    case recipient.viewed_at do
      nil -> change(recipient, viewed_at: now)
      _ -> change(recipient)
    end
  end

  def mark_downloaded_changeset(recipient) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    change(recipient, downloaded_at: now)
  end
end
