defmodule ClippsterServer.Repo.Migrations.CreatePlatformCampaigns do
  use Ecto.Migration

  def change do
    # Platform campaign reward tiers
    create table(:platform_campaign_reward_tiers, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :campaign_id, references(:clipping_campaigns, type: :uuid, on_delete: :delete_all), null: false
      add :tier_number, :integer, null: false
      add :views_required, :integer, null: false

      # Discount settings
      add :discount_enabled, :boolean, default: false, null: false
      add :discount_percent, :integer
      add :discount_duration_months, :integer
      add :discount_recurring, :boolean, default: false
      add :discount_applies_to_tiers, {:array, :string}, default: []

      # Free months settings
      add :free_months_enabled, :boolean, default: false, null: false
      add :free_months_count, :integer
      add :free_months_recurring, :boolean, default: false
      add :free_months_applies_to_tiers, {:array, :string}, default: []

      # AI credits settings
      add :ai_credits_enabled, :boolean, default: false, null: false
      add :ai_credits_amount, :integer
      add :ai_credits_recurring, :boolean, default: false

      timestamps()
    end

    create index(:platform_campaign_reward_tiers, [:campaign_id])
    create unique_index(:platform_campaign_reward_tiers, [:campaign_id, :tier_number])

    # Reward grants tracking
    create table(:platform_campaign_reward_grants, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :campaign_id, references(:clipping_campaigns, type: :uuid, on_delete: :delete_all), null: false
      add :submission_id, references(:campaign_submissions, type: :uuid, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false
      add :reward_tier_id, references(:platform_campaign_reward_tiers, type: :uuid, on_delete: :delete_all), null: false
      
      add :granted_at, :utc_datetime, null: false
      add :expiration_date, :utc_datetime
      
      # For discount rewards
      add :stripe_coupon_id, :string
      
      # For free months rewards
      add :free_months_granted, :integer
      
      # For AI credits rewards
      add :ai_credits_granted, :integer

      timestamps()
    end

    create index(:platform_campaign_reward_grants, [:campaign_id])
    create index(:platform_campaign_reward_grants, [:submission_id])
    create index(:platform_campaign_reward_grants, [:user_id])
    create index(:platform_campaign_reward_grants, [:reward_tier_id])

    # Revenue allocation settings
    create table(:revenue_allocation_settings, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :enabled, :boolean, default: false, null: false
      add :allocation_percentage, :decimal, precision: 5, scale: 2, default: 0.0, null: false
      add :current_balance, :decimal, precision: 12, scale: 2, default: 0.0, null: false
      add :total_allocated, :decimal, precision: 12, scale: 2, default: 0.0, null: false
      add :total_spent, :decimal, precision: 12, scale: 2, default: 0.0, null: false

      timestamps()
    end

    # Revenue allocation transactions
    create table(:revenue_allocation_transactions, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :transaction_type, :string, null: false # "allocation", "campaign_spend", "manual_adjustment"
      add :amount, :decimal, precision: 12, scale: 2, null: false
      add :balance_after, :decimal, precision: 12, scale: 2, null: false
      add :description, :text
      add :campaign_id, references(:clipping_campaigns, type: :uuid, on_delete: :nilify_all)
      add :subscription_id, references(:subscriptions, type: :uuid, on_delete: :nilify_all)
      add :created_by_user_id, references(:users, type: :uuid, on_delete: :nilify_all)

      timestamps()
    end

    create index(:revenue_allocation_transactions, [:transaction_type])
    create index(:revenue_allocation_transactions, [:campaign_id])
    create index(:revenue_allocation_transactions, [:created_at])

    # Add platform campaign flag to campaigns table
    alter table(:clipping_campaigns) do
      add :is_platform_campaign, :boolean, default: false, null: false
      add :platform_payment_model, :string # "cpm_flywheel", "milestone_rewards", "regular_budget"
    end

    create index(:clipping_campaigns, [:is_platform_campaign])
  end
end
