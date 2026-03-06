defmodule ClippsterServer.Repo.Migrations.AddSpentBudgetToCampaigns do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      # Track how much of the budget has been spent on payments
      add :spent_budget, :decimal, precision: 12, scale: 2, default: 0.0, null: false
    end
  end
end
