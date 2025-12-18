defmodule ClippsterServer.Repo.Migrations.CreateOrganizationCreditTransactions do
  use Ecto.Migration

  def change do
    create table(:organization_credit_transactions) do
      add :organization_id, references(:organizations, on_delete: :restrict), null: false
      add :purchased_by_user_id, references(:users, on_delete: :restrict), null: false
      add :pack_type, :string, null: false  # 'starter', 'creator', 'pro', 'studio'
      add :hours_purchased, :decimal, precision: 10, scale: 2, null: false
      add :amount_usd, :decimal, precision: 10, scale: 2, null: false
      add :amount_sol, :decimal, precision: 18, scale: 9  # Can be null for Stripe payments
      add :sol_usd_rate, :decimal, precision: 10, scale: 2  # Can be null for Stripe payments
      add :tx_signature, :string, null: false  # Solana tx signature or Stripe session ID
      add :status, :string, null: false  # 'pending', 'confirmed', 'failed'
      add :payment_method, :string, null: false, default: "solana"  # 'solana', 'stripe'
      add :stripe_session_id, :string
      add :stripe_payment_intent_id, :string

      timestamps(type: :utc_datetime)
    end

    create index(:organization_credit_transactions, [:organization_id])
    create index(:organization_credit_transactions, [:purchased_by_user_id])
    create unique_index(:organization_credit_transactions, [:tx_signature])
    create index(:organization_credit_transactions, [:status])
    create index(:organization_credit_transactions, [:payment_method])
    create unique_index(:organization_credit_transactions, [:stripe_session_id], where: "stripe_session_id IS NOT NULL")
  end
end

