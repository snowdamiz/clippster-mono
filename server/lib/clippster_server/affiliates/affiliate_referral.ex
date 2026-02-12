defmodule ClippsterServer.Affiliates.AffiliateReferral do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Affiliates.Affiliate
  alias ClippsterServer.Accounts.User

  @event_types ["first_subscription", "recurring", "credit_pack"]
  @statuses ["pending", "confirmed", "paid", "cancelled"]

  schema "affiliate_referrals" do
    field :event_type, :string
    field :subscription_tier, :string
    field :amount_usd, :decimal, default: Decimal.new("0")
    field :commission_pct, :decimal, default: Decimal.new("0")
    field :commission_usd, :decimal, default: Decimal.new("0")
    field :status, :string, default: "pending"
    field :period_month, :integer
    field :period_year, :integer

    belongs_to :affiliate, Affiliate
    belongs_to :referred_user, User, foreign_key: :referred_user_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new referral commission record.
  """
  def create_changeset(referral, attrs) do
    referral
    |> cast(attrs, [
      :affiliate_id,
      :referred_user_id,
      :event_type,
      :subscription_tier,
      :amount_usd,
      :commission_pct,
      :commission_usd,
      :status,
      :period_month,
      :period_year
    ])
    |> validate_required([
      :affiliate_id,
      :event_type,
      :amount_usd,
      :commission_pct,
      :commission_usd,
      :period_month,
      :period_year
    ])
    |> validate_inclusion(:event_type, @event_types)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:period_month, greater_than_or_equal_to: 1, less_than_or_equal_to: 12)
    |> validate_number(:period_year, greater_than_or_equal_to: 2025)
    |> foreign_key_constraint(:affiliate_id)
    |> foreign_key_constraint(:referred_user_id)
  end

  @doc """
  Changeset for updating referral status.
  """
  def status_changeset(referral, status) do
    referral
    |> change()
    |> put_change(:status, status)
    |> validate_inclusion(:status, @statuses)
  end
end
