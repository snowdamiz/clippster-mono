defmodule ClippsterServer.Repo.Migrations.CreateAffiliateTables do
  use Ecto.Migration

  def change do
    # ============================================
    # Affiliates table
    # ============================================
    create table(:affiliates) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :status, :string, null: false, default: "active"
      add :referral_code, :string, null: false
      add :signup_commission_pct, :decimal, null: false, default: 0
      add :recurring_commission_pct, :decimal, null: false, default: 0
      add :credit_pack_commission_enabled, :boolean, null: false, default: false
      add :credit_pack_commission_pct, :decimal, null: false, default: 0
      add :payout_method, :string
      add :solana_usdc_address, :string
      add :paypal_email, :string
      add :notes, :text
      add :approved_by_admin_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:affiliates, [:user_id])
    create unique_index(:affiliates, [:referral_code])

    # ============================================
    # Affiliate referrals table
    # ============================================
    create table(:affiliate_referrals) do
      add :affiliate_id, references(:affiliates, on_delete: :delete_all), null: false
      add :referred_user_id, references(:users, on_delete: :nilify_all)
      add :event_type, :string, null: false
      add :subscription_tier, :string
      add :amount_usd, :decimal, null: false, default: 0
      add :commission_pct, :decimal, null: false, default: 0
      add :commission_usd, :decimal, null: false, default: 0
      add :status, :string, null: false, default: "pending"
      add :period_month, :integer, null: false
      add :period_year, :integer, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:affiliate_referrals, [:affiliate_id])
    create index(:affiliate_referrals, [:referred_user_id])
    create index(:affiliate_referrals, [:period_year, :period_month])
    create index(:affiliate_referrals, [:status])

    # ============================================
    # Affiliate payouts table
    # ============================================
    create table(:affiliate_payouts) do
      add :affiliate_id, references(:affiliates, on_delete: :delete_all), null: false
      add :period_month, :integer, null: false
      add :period_year, :integer, null: false
      add :amount_usd, :decimal, null: false, default: 0
      add :payout_method, :string, null: false
      add :payout_address, :string, null: false
      add :transaction_id, :string
      add :proof_screenshot_url, :string
      add :status, :string, null: false, default: "pending"
      add :paid_by_admin_id, references(:users, on_delete: :nilify_all)
      add :paid_at, :utc_datetime
      add :notes, :text

      timestamps(type: :utc_datetime)
    end

    create index(:affiliate_payouts, [:affiliate_id])
    create unique_index(:affiliate_payouts, [:affiliate_id, :period_year, :period_month])

    # ============================================
    # Add referred_by_affiliate_id to users
    # ============================================
    alter table(:users) do
      add :referred_by_affiliate_id, references(:affiliates, on_delete: :nilify_all)
    end

    create index(:users, [:referred_by_affiliate_id])
  end
end
