defmodule ClippsterServer.PlatformCampaigns.RevenueAllocationTransaction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "revenue_allocation_transactions" do
    field :transaction_type, :string
    field :amount, :decimal
    field :balance_after, :decimal
    field :description, :string

    belongs_to :campaign, ClippsterServer.Campaigns.Campaign
    belongs_to :subscription, ClippsterServer.Subscriptions.Subscription
    belongs_to :created_by_user, ClippsterServer.Accounts.User

    timestamps()
  end

  @valid_types ~w(allocation campaign_spend manual_adjustment)

  @doc false
  def changeset(transaction, attrs) do
    transaction
    |> cast(attrs, [
      :transaction_type,
      :amount,
      :balance_after,
      :description,
      :campaign_id,
      :subscription_id,
      :created_by_user_id
    ])
    |> validate_required([:transaction_type, :amount, :balance_after])
    |> validate_inclusion(:transaction_type, @valid_types)
  end
end
