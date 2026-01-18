defmodule ClippsterServer.PromoCodes.PromoRedemption do
  @moduledoc """
  Schema for promo code redemptions.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.PromoCodes.PromoCode
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Organizations.Organization

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
    belongs_to(:organization, Organization, type: :id)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new redemption.
  For user redemptions, user_id is required.
  For organization redemptions, organization_id is required and user_id is the admin who redeemed it.
  """
  def create_changeset(redemption, attrs) do
    redemption
    |> cast(attrs, [
      :promo_code_id,
      :user_id,
      :organization_id,
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
    |> validate_redemption_type()
  end

  defp validate_redemption_type(changeset) do
    # At least one of user or organization redemption, but not conflicting
    # If organization_id is present, this is an org redemption
    # If organization_id is nil, this is a user redemption
    changeset
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
