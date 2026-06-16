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
    field(:promo_type, :string, default: "percent")
    field(:percent_off, :integer)
    field(:fixed_price_cents, :integer)
    field(:access_months, :integer)
    field(:total_credits, :integer)
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
    field(:notes, :string)

    belongs_to(:created_by_admin, User, foreign_key: :created_by_admin_id, type: :id)

    has_many(:redemptions, ClippsterServer.PromoCodes.PromoRedemption)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new promo code.
  """
  def create_changeset(promo_code, attrs) do
    # Sanitize integer fields - convert empty strings to nil
    attrs =
      sanitize_integer_fields(attrs, [
        :duration_months,
        :max_redemptions,
        :fixed_price_cents,
        :access_months,
        :total_credits
      ])

    promo_code
    |> cast(attrs, [
      :code,
      :name,
      :promo_type,
      :percent_off,
      :fixed_price_cents,
      :access_months,
      :total_credits,
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
      :notes,
      :created_by_admin_id
    ])
    |> parse_redeem_by(attrs)
    |> put_default_promo_type()
    |> validate_required([:code, :promo_type, :created_by_admin_id])
    |> validate_inclusion(:promo_type, ["percent", "bundle"])
    |> validate_promo_type_fields()
    |> validate_allowed_tiers()
    |> validate_allowed_org_tiers()
    |> validate_allowed_credit_packs()
    |> validate_at_least_one_tier_or_pack()
    |> validate_redeem_by_future()
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
    |> parse_redeem_by(attrs)
    |> validate_duration_months()
    |> validate_redeem_by_future()
  end

  defp normalize_code(changeset) do
    case get_change(changeset, :code) do
      nil -> changeset
      code -> put_change(changeset, :code, String.upcase(String.trim(code)))
    end
  end

  defp put_default_promo_type(changeset) do
    case get_field(changeset, :promo_type) do
      nil -> put_change(changeset, :promo_type, "percent")
      _ -> changeset
    end
  end

  defp validate_promo_type_fields(changeset) do
    case get_field(changeset, :promo_type) do
      "bundle" ->
        changeset
        |> validate_required([:fixed_price_cents, :access_months, :total_credits])
        |> validate_number(:fixed_price_cents, greater_than: 0)
        |> validate_number(:access_months, greater_than: 0)
        |> validate_number(:total_credits, greater_than_or_equal_to: 0)
        |> validate_bundle_user_tiers_only()

      _ ->
        changeset
        |> validate_required([:percent_off, :duration_kind])
        |> validate_inclusion(:percent_off, 1..100)
        |> validate_inclusion(:duration_kind, ["once", "repeating", "forever"])
        |> validate_duration_months()
    end
  end

  defp validate_bundle_user_tiers_only(changeset) do
    allowed_tiers = get_field(changeset, :allowed_tiers) || []
    allowed_org_tiers = get_field(changeset, :allowed_org_tiers) || []
    allowed_credit_packs = get_field(changeset, :allowed_credit_packs) || []

    cond do
      Enum.empty?(allowed_tiers) ->
        add_error(changeset, :allowed_tiers, "bundle promos require at least one user subscription tier")

      !Enum.empty?(allowed_org_tiers) || !Enum.empty?(allowed_credit_packs) ->
        add_error(
          changeset,
          :allowed_tiers,
          "bundle promos only support user subscription tiers"
        )

      true ->
        changeset
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
          "solo",
          "enterprise_base",
          "enterprise_ai",
          "enterprise_unlimited",
          "seats_5",
          "seats_5_ai",
          "seats_10",
          "seats_10_ai",
          "seats_20",
          "seats_20_ai"
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

  defp parse_redeem_by(changeset, attrs) do
    case Map.get(attrs, "redeem_by") || Map.get(attrs, :redeem_by) do
      nil ->
        changeset

      "" ->
        put_change(changeset, :redeem_by, nil)

      value when is_binary(value) ->
        # Parse datetime-local string (format: "2026-02-24T22:50")
        # Treat it as UTC since datetime-local doesn't include timezone
        case NaiveDateTime.from_iso8601(value) do
          {:ok, naive_dt} ->
            utc_dt = DateTime.from_naive!(naive_dt, "Etc/UTC")
            put_change(changeset, :redeem_by, utc_dt)

          {:error, _} ->
            add_error(changeset, :redeem_by, "invalid datetime format")
        end

      %DateTime{} = dt ->
        put_change(changeset, :redeem_by, dt)

      _ ->
        changeset
    end
  end

  defp validate_redeem_by_future(changeset) do
    case get_field(changeset, :redeem_by) do
      nil ->
        changeset

      redeem_by ->
        if DateTime.compare(redeem_by, DateTime.utc_now()) == :lt do
          add_error(changeset, :redeem_by, "must be in the future")
        else
          changeset
        end
    end
  end

  defp sanitize_integer_fields(attrs, fields) do
    Enum.reduce(fields, attrs, fn field, acc ->
      field_str = to_string(field)
      field_atom = field

      cond do
        # Check string key - handle empty string or "null" string
        Map.has_key?(acc, field_str) and (acc[field_str] == "" or acc[field_str] == "null") ->
          Map.put(acc, field_str, nil)

        # Check atom key - handle empty string or "null" string
        Map.has_key?(acc, field_atom) and (acc[field_atom] == "" or acc[field_atom] == "null") ->
          Map.put(acc, field_atom, nil)

        true ->
          acc
      end
    end)
  end
end
