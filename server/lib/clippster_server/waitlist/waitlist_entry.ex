defmodule ClippsterServer.Waitlist.WaitlistEntry do
  @moduledoc """
  Schema for waitlist entries.
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "waitlist_entries" do
    field :email, :string
    field :invited_at, :utc_datetime
    field :email_sent_at, :utc_datetime
    field :email_delivery_error, :string
    field :discount_code, :string
    field :discount_stripe_promo_id, :string

    belongs_to :beta_code, ClippsterServer.BetaCodes.BetaCode

    timestamps()
  end

  @doc """
  Changeset for creating a waitlist entry.
  """
  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:email])
    |> validate_required([:email])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/,
      message: "must be a valid email address"
    )
    |> unique_constraint(:email, message: "is already on the waitlist")
  end

  @doc """
  Changeset for updating invite tracking fields.
  """
  def invite_changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :invited_at,
      :email_sent_at,
      :email_delivery_error,
      :beta_code_id,
      :discount_code,
      :discount_stripe_promo_id
    ])
    |> unique_constraint(:beta_code_id)
  end
end
