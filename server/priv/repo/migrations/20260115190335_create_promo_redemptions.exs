defmodule ClippsterServer.Repo.Migrations.CreatePromoRedemptions do
  use Ecto.Migration

  def change do
    create table(:promo_redemptions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:promo_code_id, references(:promo_codes, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:user_id, references(:users, on_delete: :delete_all), null: false)
      add(:stripe_customer_id, :string)
      add(:stripe_subscription_id, :string)
      add(:stripe_invoice_id, :string)
      add(:redeemed_at, :utc_datetime, null: false)
      add(:status, :string, null: false, default: "active")

      timestamps(type: :utc_datetime)
    end

    create(index(:promo_redemptions, [:promo_code_id, :status]))
    create(index(:promo_redemptions, [:user_id]))
    create(index(:promo_redemptions, [:stripe_subscription_id]))
  end
end
