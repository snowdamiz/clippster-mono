defmodule ClippsterServer.OrganizationSubscriptions.OrganizationSubscription do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organization_subscriptions" do
    # "base" or "addon"
    field :subscription_type, :string
    field :tier, :string
    field :status, :string
    field :start_date, :utc_datetime
    field :end_date, :utc_datetime
    field :seats, :integer, default: 0
    field :credits_granted, :decimal
    field :payment_method, :string
    field :stripe_subscription_id, :string
    field :stripe_session_id, :string
    field :amount_usd, :decimal

    belongs_to :organization, ClippsterServer.Organizations.Organization

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new subscription history record.
  """
  def create_changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [
      :organization_id,
      :subscription_type,
      :tier,
      :status,
      :start_date,
      :end_date,
      :seats,
      :credits_granted,
      :payment_method,
      :stripe_subscription_id,
      :stripe_session_id,
      :amount_usd
    ])
    |> validate_required([
      :organization_id,
      :subscription_type,
      :tier,
      :status,
      :start_date,
      :end_date,
      :payment_method
    ])
    |> validate_inclusion(:subscription_type, ["base", "addon"])
    |> validate_inclusion(:status, ["active", "cancelled", "expired"])
    |> foreign_key_constraint(:organization_id)
  end
end
