defmodule ClippsterServer.Repo.Migrations.AddPromoCodeToSubscriptions do
  use Ecto.Migration

  def change do
    alter table(:subscriptions) do
      add(:promo_code_id, references(:promo_codes, type: :binary_id, on_delete: :nilify_all))
    end
  end
end
