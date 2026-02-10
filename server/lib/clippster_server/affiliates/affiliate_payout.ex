defmodule ClippsterServer.Affiliates.AffiliatePayout do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Affiliates.Affiliate
  alias ClippsterServer.Accounts.User

  @statuses ["pending", "processing", "completed", "failed"]
  @payout_methods ["crypto", "paypal"]

  schema "affiliate_payouts" do
    field :period_month, :integer
    field :period_year, :integer
    field :amount_usd, :decimal, default: Decimal.new("0")
    field :payout_method, :string
    field :payout_address, :string
    field :transaction_id, :string
    field :proof_screenshot_url, :string
    field :status, :string, default: "pending"
    field :paid_at, :utc_datetime
    field :notes, :string

    belongs_to :affiliate, Affiliate
    belongs_to :paid_by_admin, User, foreign_key: :paid_by_admin_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new payout record.
  """
  def create_changeset(payout, attrs) do
    payout
    |> cast(attrs, [
      :affiliate_id,
      :period_month,
      :period_year,
      :amount_usd,
      :payout_method,
      :payout_address,
      :transaction_id,
      :proof_screenshot_url,
      :status,
      :paid_by_admin_id,
      :paid_at,
      :notes
    ])
    |> validate_required([
      :affiliate_id,
      :period_month,
      :period_year,
      :amount_usd,
      :payout_method,
      :payout_address
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:payout_method, @payout_methods)
    |> validate_number(:period_month, greater_than_or_equal_to: 1, less_than_or_equal_to: 12)
    |> validate_number(:period_year, greater_than_or_equal_to: 2025)
    |> unique_constraint([:affiliate_id, :period_year, :period_month])
    |> foreign_key_constraint(:affiliate_id)
    |> foreign_key_constraint(:paid_by_admin_id)
  end

  @doc """
  Changeset for updating payout status and proof.
  """
  def update_changeset(payout, attrs) do
    payout
    |> cast(attrs, [
      :status,
      :transaction_id,
      :proof_screenshot_url,
      :paid_at,
      :notes
    ])
    |> validate_inclusion(:status, @statuses)
  end
end
