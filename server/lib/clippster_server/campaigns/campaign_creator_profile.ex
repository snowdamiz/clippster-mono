defmodule ClippsterServer.Campaigns.CampaignCreatorProfile do
  @moduledoc """
  Schema for joining campaigns to creator profiles.
  Allows campaigns to have multiple creator profiles assigned.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Campaigns.Campaign
  alias ClippsterServer.Organizations.OrganizationCreatorProfile

  schema "campaign_creator_profiles" do
    belongs_to :campaign, Campaign
    belongs_to :creator_profile, OrganizationCreatorProfile

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a campaign creator profile assignment.
  """
  def create_changeset(campaign_creator_profile, attrs) do
    campaign_creator_profile
    |> cast(attrs, [:campaign_id, :creator_profile_id])
    |> validate_required([:campaign_id, :creator_profile_id])
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:creator_profile_id)
    |> unique_constraint([:campaign_id, :creator_profile_id],
      name: :campaign_creator_profiles_campaign_id_creator_profile_id_index,
      message: "creator profile already assigned to this campaign"
    )
  end
end
