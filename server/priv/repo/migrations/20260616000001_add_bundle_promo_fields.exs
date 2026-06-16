defmodule ClippsterServer.Repo.Migrations.AddBundlePromoFields do
  use Ecto.Migration

  def change do
    alter table(:promo_codes) do
      add(:promo_type, :string, null: false, default: "percent")
      add(:fixed_price_cents, :integer)
      add(:access_months, :integer)
      add(:total_credits, :integer)
    end

    create(index(:promo_codes, [:promo_type]))
  end
end
