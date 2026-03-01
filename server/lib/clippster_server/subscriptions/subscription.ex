defmodule ClippsterServer.Subscriptions.Subscription do
  @moduledoc """
  Schema for subscription history records.
  Each record represents a subscription period (monthly).
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "subscriptions" do
    # active, expired, cancelled
    field :status, :string
    # starter, creator, pro
    field :subscription_tier, :string
    field :start_date, :utc_datetime
    field :end_date, :utc_datetime
    field :hours_included, :decimal
    field :credits_granted, :decimal
    # stripe, crypto
    field :payment_method, :string
    field :stripe_subscription_id, :string
    field :amount_usd, :decimal

    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new subscription record.
  """
  def create_changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [
      :user_id,
      :status,
      :subscription_tier,
      :start_date,
      :end_date,
      :hours_included,
      :credits_granted,
      :payment_method,
      :stripe_subscription_id,
      :amount_usd
    ])
    |> validate_required([
      :user_id,
      :status,
      :subscription_tier,
      :start_date,
      :end_date,
      :payment_method
    ])
    |> validate_inclusion(:status, ["active", "expired", "cancelled"])
    |> validate_inclusion(:subscription_tier, ["starter", "creator", "pro"])
    |> validate_inclusion(:payment_method, ["stripe", "crypto", "trial", "admin"])
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Changeset for updating subscription status.
  """
  def status_changeset(subscription, status) do
    subscription
    |> change()
    |> put_change(:status, status)
    |> validate_inclusion(:status, ["active", "expired", "cancelled"])
  end
end
