defmodule ClippsterServer.Repo.Migrations.AddLsDiscountIdToPromoCodes do
  use Ecto.Migration

  def change do
    alter table(:promo_codes) do
      add :ls_discount_id, :string
    end
  end
end
