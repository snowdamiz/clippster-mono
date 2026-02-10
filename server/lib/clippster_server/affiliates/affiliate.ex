defmodule ClippsterServer.Affiliates.Affiliate do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  @statuses ["active", "suspended", "deactivated"]
  @payout_methods ["crypto", "paypal"]

  schema "affiliates" do
    field :status, :string, default: "active"
    field :referral_code, :string
    field :signup_commission_pct, :decimal, default: Decimal.new("0")
    field :recurring_commission_pct, :decimal, default: Decimal.new("0")
    field :credit_pack_commission_enabled, :boolean, default: false
    field :credit_pack_commission_pct, :decimal, default: Decimal.new("0")
    field :payout_method, :string
    field :solana_usdc_address, :string
    field :paypal_email, :string
    field :notes, :string

    belongs_to :user, User
    belongs_to :approved_by_admin, User, foreign_key: :approved_by_admin_id

    has_many :referrals, ClippsterServer.Affiliates.AffiliateReferral
    has_many :payouts, ClippsterServer.Affiliates.AffiliatePayout

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new affiliate.
  """
  def create_changeset(affiliate, attrs) do
    affiliate
    |> cast(attrs, [
      :user_id,
      :referral_code,
      :signup_commission_pct,
      :recurring_commission_pct,
      :credit_pack_commission_enabled,
      :credit_pack_commission_pct,
      :payout_method,
      :solana_usdc_address,
      :paypal_email,
      :notes,
      :approved_by_admin_id
    ])
    |> validate_required([:user_id, :referral_code])
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:signup_commission_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:recurring_commission_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:credit_pack_commission_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_payout_method()
    |> normalize_referral_code()
    |> unique_constraint(:user_id)
    |> unique_constraint(:referral_code)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:approved_by_admin_id)
  end

  @doc """
  Changeset for updating an affiliate.
  """
  def update_changeset(affiliate, attrs) do
    affiliate
    |> cast(attrs, [
      :status,
      :referral_code,
      :signup_commission_pct,
      :recurring_commission_pct,
      :credit_pack_commission_enabled,
      :credit_pack_commission_pct,
      :payout_method,
      :solana_usdc_address,
      :paypal_email,
      :notes
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:signup_commission_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:recurring_commission_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:credit_pack_commission_pct, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_payout_method()
    |> maybe_normalize_referral_code()
    |> unique_constraint(:referral_code)
  end

  @doc """
  Changeset for affiliate updating their own payout settings.
  """
  def settings_changeset(affiliate, attrs) do
    affiliate
    |> cast(attrs, [:payout_method, :solana_usdc_address, :paypal_email])
    |> validate_payout_method()
  end

  defp normalize_referral_code(changeset) do
    case get_change(changeset, :referral_code) do
      nil -> changeset
      code -> put_change(changeset, :referral_code, String.upcase(String.trim(code)))
    end
  end

  defp maybe_normalize_referral_code(changeset) do
    case get_change(changeset, :referral_code) do
      nil -> changeset
      code -> put_change(changeset, :referral_code, String.upcase(String.trim(code)))
    end
  end

  defp validate_payout_method(changeset) do
    case get_field(changeset, :payout_method) do
      nil -> changeset
      method when method in @payout_methods -> changeset
      _ -> add_error(changeset, :payout_method, "must be crypto or paypal")
    end
  end
end
