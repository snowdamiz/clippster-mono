defmodule ClippsterServer.Repo.Migrations.AddStripePaymentFields do
  use Ecto.Migration

  def change do
    alter table(:credit_transactions) do
      # Payment method: 'solana' or 'stripe'
      add :payment_method, :string, null: false, default: "solana"
      
      # Stripe-specific fields (nullable, only used for Stripe payments)
      add :stripe_session_id, :string
      add :stripe_payment_intent_id, :string
    end

    # Index for looking up by Stripe session ID
    create index(:credit_transactions, [:stripe_session_id])
    
    # Make amount_sol and sol_usd_rate nullable for Stripe payments
    # These will be 0 for Stripe transactions
  end
end

