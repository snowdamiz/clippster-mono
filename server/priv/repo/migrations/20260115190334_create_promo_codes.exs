defmodule ClippsterServer.Repo.Migrations.CreatePromoCodes do
  use Ecto.Migration

  def change do
    create table(:promo_codes, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:code, :string, null: false)
      add(:name, :string)
      add(:percent_off, :integer, null: false)
      add(:duration_kind, :string, null: false, default: "repeating")
      add(:duration_months, :integer)
      add(:allowed_tiers, {:array, :string}, null: false)
      add(:max_redemptions, :integer)
      add(:redeem_by, :utc_datetime)
      add(:is_active, :boolean, null: false, default: true)
      add(:created_by_admin_id, references(:users, on_delete: :nilify_all), null: false)
      add(:stripe_coupon_id, :string)
      add(:stripe_promo_code_id, :string)
      add(:notes, :string)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:promo_codes, [:code]))
    create(index(:promo_codes, [:is_active, :redeem_by]))
    create(index(:promo_codes, [:stripe_coupon_id]))
  end
end
