defmodule ClippsterServer.Repo.Migrations.AddAffiliateDiscountSettings do
  use Ecto.Migration

  def change do
    alter table(:affiliates) do
      # Discount settings
      add :discount_enabled, :boolean, default: false
      # "one_time", "recurring", "tiered"
      add :discount_type, :string
      add :first_month_discount_pct, :decimal, precision: 5, scale: 2
      add :recurring_discount_pct, :decimal, precision: 5, scale: 2
    end
  end
end
