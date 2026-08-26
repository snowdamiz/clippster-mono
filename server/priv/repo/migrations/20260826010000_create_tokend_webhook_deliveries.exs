defmodule ClippsterServer.Repo.Migrations.CreateTokendWebhookDeliveries do
  use Ecto.Migration

  def change do
    create table(:tokend_webhook_deliveries) do
      add :delivery_id, :string, null: false
      add :event_type, :string, null: false
      add :event_key, :string
      add :payload, :map, null: false, default: %{}
      add :processed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:tokend_webhook_deliveries, [:delivery_id])
    create index(:tokend_webhook_deliveries, [:event_type])
    create index(:tokend_webhook_deliveries, [:event_key])
  end
end
