defmodule ClippsterServer.Repo.Migrations.CreateSubscriptions do
  use Ecto.Migration

  def change do
    create table(:subscriptions) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :status, :string, null: false
      add :start_date, :utc_datetime, null: false
      add :end_date, :utc_datetime, null: false
      add :hours_included, :decimal, precision: 10, scale: 2, default: "15.00"
      add :payment_method, :string, null: false
      add :stripe_subscription_id, :string
      add :amount_usd, :decimal, precision: 10, scale: 2, default: "20.00"

      timestamps(type: :utc_datetime)
    end

    create index(:subscriptions, [:user_id])
    create index(:subscriptions, [:stripe_subscription_id])
    create index(:subscriptions, [:status])
  end
end
