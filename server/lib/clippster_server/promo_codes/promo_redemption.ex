defmodule ClippsterServer.PromoCodes.PromoRedemption do
  @moduledoc """
  Schema for promo code redemptions.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.PromoCodes.PromoCode
  alias ClippsterServer.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "promo_redemptions" do
    field(:stripe_customer_id, :string)
    field(:stripe_subscription_id, :string)
    field(:stripe_invoice_id, :string)
    field(:redeemed_at, :utc_datetime)
    field(:status, :string, default: "active")

    belongs_to(:promo_code, PromoCode)
    belongs_to(:user, User, type: :id)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new redemption.
  """
  def create_changeset(redemption, attrs) do
    redemption
    |> cast(attrs, [
      :promo_code_id,
      :user_id,
      :stripe_customer_id,
      :stripe_subscription_id,
      :stripe_invoice_id,
      :redeemed_at,
      :status
    ])
    |> validate_required([
      :promo_code_id,
      :user_id,
      :redeemed_at,
      :status
    ])
    |> validate_inclusion(:status, ["active", "ended", "cancelled", "expired"])
  end

  @doc """
  Changeset for updating redemption status.
  """
  def update_status_changeset(redemption, status) do
    redemption
    |> change()
    |> put_change(:status, status)
    |> validate_inclusion(:status, ["active", "ended", "cancelled", "expired"])
  end
end
