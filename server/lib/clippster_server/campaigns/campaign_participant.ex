defmodule ClippsterServer.Campaigns.CampaignParticipant do
  @moduledoc """
  Schema for campaign participants - users who have joined or applied to a campaign.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Organizations.OrganizationProfileAssignment
  alias ClippsterServer.Campaigns.{Campaign, CampaignSubmission}

  @statuses ~w(pending approved rejected removed)

  schema "campaign_participants" do
    field :status, :string, default: "pending"
    field :application_note, :string
    field :approved_at, :utc_datetime

    belongs_to :campaign, Campaign
    belongs_to :user, User
    belongs_to :approved_by_user, User, foreign_key: :approved_by_user_id
    belongs_to :profile_assignment, OrganizationProfileAssignment
    has_many :submissions, CampaignSubmission, foreign_key: :participant_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new participant (applying/joining).
  """
  def create_changeset(participant, attrs) do
    participant
    |> cast(attrs, [:campaign_id, :user_id, :status, :application_note])
    |> validate_required([:campaign_id, :user_id])
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:application_note, max: 2000)
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint([:campaign_id, :user_id],
      message: "already participating in this campaign"
    )
  end

  @doc """
  Changeset for approving a participant.
  """
  def approve_changeset(participant, attrs) do
    participant
    |> cast(attrs, [:approved_by_user_id, :profile_assignment_id])
    |> put_change(:status, "approved")
    |> put_change(:approved_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> foreign_key_constraint(:approved_by_user_id)
    |> foreign_key_constraint(:profile_assignment_id)
  end

  @doc """
  Changeset for rejecting a participant.
  """
  def reject_changeset(participant) do
    participant
    |> change(status: "rejected")
  end

  @doc """
  Changeset for removing a participant.
  """
  def remove_changeset(participant) do
    participant
    |> change(status: "removed", profile_assignment_id: nil)
  end

  @doc """
  Changeset for updating profile assignment reference.
  """
  def update_profile_assignment_changeset(participant, attrs) do
    participant
    |> cast(attrs, [:profile_assignment_id])
    |> foreign_key_constraint(:profile_assignment_id)
  end

  def statuses, do: @statuses
end
