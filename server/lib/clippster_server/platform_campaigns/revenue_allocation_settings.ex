defmodule ClippsterServer.PlatformCampaigns.RevenueAllocationSettings do
  use Ecto.Schema
  import Ecto.Changeset

  schema "revenue_allocation_settings" do
    field :enabled, :boolean, default: false
    field :allocation_percentage, :decimal
    field :current_balance, :decimal
    field :total_allocated, :decimal
    field :total_spent, :decimal

    timestamps()
  end

  @doc false
  def changeset(settings, attrs) do
    settings
    |> cast(attrs, [:enabled, :allocation_percentage, :current_balance, :total_allocated, :total_spent])
    |> validate_required([:enabled, :allocation_percentage])
    |> validate_number(:allocation_percentage, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:current_balance, greater_than_or_equal_to: 0)
    |> validate_number(:total_allocated, greater_than_or_equal_to: 0)
    |> validate_number(:total_spent, greater_than_or_equal_to: 0)
  end
end
