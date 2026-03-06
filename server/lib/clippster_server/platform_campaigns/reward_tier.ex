defmodule ClippsterServer.PlatformCampaigns.RewardTier do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "platform_campaign_reward_tiers" do
    field :tier_number, :integer
    field :views_required, :integer

    # Discount settings
    field :discount_enabled, :boolean, default: false
    field :discount_percent, :integer
    field :discount_duration_months, :integer
    field :discount_recurring, :boolean, default: false
    field :discount_applies_to_tiers, {:array, :string}, default: []

    # Free months settings
    field :free_months_enabled, :boolean, default: false
    field :free_months_count, :integer
    field :free_months_recurring, :boolean, default: false
    field :free_months_applies_to_tiers, {:array, :string}, default: []

    # AI credits settings
    field :ai_credits_enabled, :boolean, default: false
    field :ai_credits_amount, :integer
    field :ai_credits_recurring, :boolean, default: false

    belongs_to :campaign, ClippsterServer.Campaigns.Campaign
    has_many :reward_grants, ClippsterServer.PlatformCampaigns.RewardGrant

    timestamps()
  end

  @doc false
  def changeset(reward_tier, attrs) do
    reward_tier
    |> cast(attrs, [
      :tier_number,
      :views_required,
      :discount_enabled,
      :discount_percent,
      :discount_duration_months,
      :discount_recurring,
      :discount_applies_to_tiers,
      :free_months_enabled,
      :free_months_count,
      :free_months_recurring,
      :free_months_applies_to_tiers,
      :ai_credits_enabled,
      :ai_credits_amount,
      :ai_credits_recurring,
      :campaign_id
    ])
    |> validate_required([:tier_number, :views_required, :campaign_id])
    |> validate_number(:tier_number, greater_than: 0)
    |> validate_number(:views_required, greater_than: 0)
    |> validate_discount_fields()
    |> validate_free_months_fields()
    |> validate_ai_credits_fields()
    |> unique_constraint([:campaign_id, :tier_number])
  end

  defp validate_discount_fields(changeset) do
    if get_field(changeset, :discount_enabled) do
      changeset
      |> validate_required([:discount_percent, :discount_duration_months])
      |> validate_number(:discount_percent, greater_than: 0, less_than_or_equal_to: 100)
      |> validate_number(:discount_duration_months, greater_than: 0)
      |> validate_tier_list(:discount_applies_to_tiers)
    else
      changeset
    end
  end

  defp validate_free_months_fields(changeset) do
    if get_field(changeset, :free_months_enabled) do
      changeset
      |> validate_required([:free_months_count])
      |> validate_number(:free_months_count, greater_than: 0)
      |> validate_tier_list(:free_months_applies_to_tiers)
    else
      changeset
    end
  end

  defp validate_ai_credits_fields(changeset) do
    if get_field(changeset, :ai_credits_enabled) do
      changeset
      |> validate_required([:ai_credits_amount])
      |> validate_number(:ai_credits_amount, greater_than: 0)
    else
      changeset
    end
  end

  defp validate_tier_list(changeset, field) do
    tiers = get_field(changeset, field) || []
    valid_tiers = ["starter", "creator", "pro"]

    if Enum.all?(tiers, &(&1 in valid_tiers)) do
      changeset
    else
      add_error(changeset, field, "contains invalid tier names")
    end
  end
end
