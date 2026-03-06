defmodule ClippsterServer.PlatformCampaigns.RewardGrant do
  use Ecto.Schema
  import Ecto.Changeset

  schema "platform_campaign_reward_grants" do
    field :granted_at, :utc_datetime
    field :expiration_date, :utc_datetime
    field :stripe_coupon_id, :string
    field :free_months_granted, :integer
    field :ai_credits_granted, :integer

    belongs_to :campaign, ClippsterServer.Campaigns.Campaign
    belongs_to :submission, ClippsterServer.Campaigns.CampaignSubmission
    belongs_to :user, ClippsterServer.Accounts.User
    belongs_to :reward_tier, ClippsterServer.PlatformCampaigns.RewardTier

    timestamps()
  end

  @doc false
  def changeset(reward_grant, attrs) do
    reward_grant
    |> cast(attrs, [
      :granted_at,
      :expiration_date,
      :stripe_coupon_id,
      :free_months_granted,
      :ai_credits_granted,
      :campaign_id,
      :submission_id,
      :user_id,
      :reward_tier_id
    ])
    |> validate_required([:granted_at, :campaign_id, :submission_id, :user_id, :reward_tier_id])
  end
end
