defmodule ClippsterServer.Repo.Migrations.CreateCreditTransactions do
  use Ecto.Migration

  def change do
    create table(:credit_transactions) do
      add :user_id, references(:users, on_delete: :restrict), null: false
      add :pack_type, :string, null: false # 'starter', 'creator', 'pro', 'studio'
      add :hours_purchased, :decimal, precision: 10, scale: 2, null: false
      add :amount_usd, :decimal, precision: 10, scale: 2, null: false
      add :amount_sol, :decimal, precision: 18, scale: 9, null: false
      add :sol_usd_rate, :decimal, precision: 10, scale: 2, null: false
      add :tx_signature, :string, null: false # Solana transaction signature (88 chars)
      add :status, :string, null: false # 'pending', 'confirmed', 'failed'

      timestamps(type: :utc_datetime)
    end

    create index(:credit_transactions, [:user_id])
    create unique_index(:credit_transactions, [:tx_signature])
    create index(:credit_transactions, [:status])
  end
end
