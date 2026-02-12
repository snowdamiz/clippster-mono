defmodule ClippsterServer.PromoCodes.PromoCode do
  @moduledoc """
  Schema for promo/discount codes.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "promo_codes" do
    field(:code, :string)
    field(:name, :string)
    field(:percent_off, :integer)
    field(:duration_kind, :string, default: "repeating")
    field(:duration_months, :integer)
    field(:allowed_tiers, {:array, :string})
    field(:allowed_org_tiers, {:array, :string})
    field(:allowed_credit_packs, {:array, :string})
    field(:max_redemptions, :integer)
    field(:redeem_by, :utc_datetime)
    field(:is_active, :boolean, default: true)
    field(:stripe_coupon_id, :string)
    field(:stripe_promo_code_id, :string)
    field(:ls_discount_id, :string)
    field(:notes, :string)

    belongs_to(:created_by_admin, User, foreign_key: :created_by_admin_id, type: :id)

    has_many(:redemptions, ClippsterServer.PromoCodes.PromoRedemption)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new promo code.
  """
  def create_changeset(promo_code, attrs) do
    promo_code
    |> cast(attrs, [
      :code,
      :name,
      :percent_off,
      :duration_kind,
      :duration_months,
      :allowed_tiers,
      :allowed_org_tiers,
      :allowed_credit_packs,
      :max_redemptions,
      :redeem_by,
      :is_active,
      :stripe_coupon_id,
      :stripe_promo_code_id,
      :ls_discount_id,
      :notes,
      :created_by_admin_id
    ])
    |> validate_required([
      :code,
      :percent_off,
      :duration_kind,
      :created_by_admin_id
    ])
    |> validate_inclusion(:percent_off, 1..100)
    |> validate_inclusion(:duration_kind, ["once", "repeating", "forever"])
    |> validate_duration_months()
    |> validate_allowed_tiers()
    |> validate_allowed_org_tiers()
    |> validate_allowed_credit_packs()
    |> validate_at_least_one_tier_or_pack()
    |> unique_constraint(:code)
    |> normalize_code()
  end

  @doc """
  Changeset for updating a promo code.
  """
  def update_changeset(promo_code, attrs) do
    promo_code
    |> cast(attrs, [
      :name,
      :max_redemptions,
      :redeem_by,
      :is_active,
      :notes
    ])
    |> validate_duration_months()
  end

  defp normalize_code(changeset) do
    case get_change(changeset, :code) do
      nil -> changeset
      code -> put_change(changeset, :code, String.upcase(String.trim(code)))
    end
  end

  defp validate_duration_months(changeset) do
    case get_field(changeset, :duration_kind) do
      "repeating" ->
        changeset
        |> validate_required([:duration_months])
        |> validate_number(:duration_months, greater_than: 0)

      _ ->
        changeset
    end
  end

  defp validate_allowed_tiers(changeset) do
    case get_field(changeset, :allowed_tiers) do
      nil ->
        changeset

      [] ->
        changeset

      tiers ->
        valid_tiers = ["starter", "creator", "pro"]

        case Enum.all?(tiers, fn t -> t in valid_tiers end) do
          true -> changeset
          false -> add_error(changeset, :allowed_tiers, "contains invalid tier")
        end
    end
  end

  defp validate_allowed_org_tiers(changeset) do
    case get_field(changeset, :allowed_org_tiers) do
      nil ->
        changeset

      [] ->
        changeset

      tiers ->
        valid_org_tiers = [
          "enterprise",
          "enterprise_ai",
          "enterprise_unlimited",
          "addon_5_seats",
          "addon_5_seats_ai",
          "addon_10_seats",
          "addon_10_seats_ai"
        ]

        case Enum.all?(tiers, fn t -> t in valid_org_tiers end) do
          true -> changeset
          false -> add_error(changeset, :allowed_org_tiers, "contains invalid organization tier")
        end
    end
  end

  defp validate_allowed_credit_packs(changeset) do
    case get_field(changeset, :allowed_credit_packs) do
      nil ->
        changeset

      [] ->
        changeset

      packs ->
        valid_packs = ["starter", "creator", "pro", "enterprise"]

        case Enum.all?(packs, fn p -> p in valid_packs end) do
          true -> changeset
          false -> add_error(changeset, :allowed_credit_packs, "contains invalid credit pack")
        end
    end
  end

  defp validate_at_least_one_tier_or_pack(changeset) do
    allowed_tiers = get_field(changeset, :allowed_tiers) || []
    allowed_org_tiers = get_field(changeset, :allowed_org_tiers) || []
    allowed_credit_packs = get_field(changeset, :allowed_credit_packs) || []

    if Enum.empty?(allowed_tiers) && Enum.empty?(allowed_org_tiers) &&
         Enum.empty?(allowed_credit_packs) do
      add_error(
        changeset,
        :allowed_tiers,
        "must specify at least one of: allowed_tiers, allowed_org_tiers, or allowed_credit_packs"
      )
    else
      changeset
    end
  end
end
