defmodule ClippsterServer.ClipperProfiles.ClipperEndorsement do
  @moduledoc """
  Schema for clipper endorsements from organizations.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Organizations.Organization
  alias ClippsterServer.Campaigns.Campaign
  alias ClippsterServer.ClipperProfiles.ClipperProfile

  schema "clipper_endorsements" do
    field :content, :string
    field :rating, :integer

    belongs_to :clipper_profile, ClipperProfile
    belongs_to :organization, Organization
    belongs_to :endorsed_by_user, User, foreign_key: :endorsed_by_user_id
    belongs_to :campaign, Campaign

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating an endorsement.
  """
  def create_changeset(endorsement, attrs) do
    endorsement
    |> cast(attrs, [
      :clipper_profile_id,
      :organization_id,
      :endorsed_by_user_id,
      :campaign_id,
      :content,
      :rating
    ])
    |> validate_required([:clipper_profile_id, :organization_id])
    |> validate_length(:content, max: 300)
    |> validate_inclusion(:rating, 1..5)
    |> foreign_key_constraint(:clipper_profile_id)
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:endorsed_by_user_id)
    |> foreign_key_constraint(:campaign_id)
    |> unique_constraint([:clipper_profile_id, :organization_id],
      message: "organization has already endorsed this clipper"
    )
  end

  @doc """
  Changeset for updating an endorsement.
  """
  def update_changeset(endorsement, attrs) do
    endorsement
    |> cast(attrs, [:content, :rating])
    |> validate_length(:content, max: 300)
    |> validate_inclusion(:rating, 1..5)
  end
end
