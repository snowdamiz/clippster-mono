defmodule ClippsterServer.Repo.Migrations.CreateClippingCampaigns do
  use Ecto.Migration

  def change do
    # Create clipping_campaigns table
    create table(:clipping_campaigns) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :creator_profile_id, references(:organization_creator_profiles, on_delete: :nilify_all)
      add :title, :string, null: false
      add :description, :text
      add :cover_image_url, :string
      add :budget, :decimal, precision: 12, scale: 2, default: 0
      add :spent, :decimal, precision: 12, scale: 2, default: 0
      add :cpm, :decimal, precision: 8, scale: 4, default: 0
      add :min_views_for_payment, :integer, default: 0
      add :join_type, :string, null: false, default: "open"
      add :allowed_platforms, {:array, :string}, default: []
      add :payment_methods, {:array, :string}, default: []
      add :status, :string, null: false, default: "draft"
      add :starts_at, :utc_datetime
      add :ends_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:clipping_campaigns, [:organization_id])
    create index(:clipping_campaigns, [:creator_profile_id])
    create index(:clipping_campaigns, [:status])
    create index(:clipping_campaigns, [:join_type])

    # Create campaign_participants table
    create table(:campaign_participants) do
      add :campaign_id, references(:clipping_campaigns, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :status, :string, null: false, default: "pending"
      add :application_note, :text
      add :approved_at, :utc_datetime
      add :approved_by_user_id, references(:users, on_delete: :nilify_all)
      add :profile_assignment_id, references(:organization_profile_assignments, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:campaign_participants, [:campaign_id, :user_id])
    create index(:campaign_participants, [:campaign_id])
    create index(:campaign_participants, [:user_id])
    create index(:campaign_participants, [:status])
    create index(:campaign_participants, [:profile_assignment_id])

    # Create clipper_social_accounts table
    create table(:clipper_social_accounts) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :platform, :string, null: false
      add :platform_user_id, :string
      add :username, :string
      add :display_name, :string
      add :access_token, :binary
      add :refresh_token, :binary
      add :token_expires_at, :utc_datetime
      add :profile_url, :string
      add :follower_count, :integer
      add :is_verified, :boolean, default: false

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_social_accounts, [:user_id])
    create index(:clipper_social_accounts, [:platform])
    create unique_index(:clipper_social_accounts, [:user_id, :platform, :platform_user_id],
      name: :clipper_social_accounts_unique)

    # Create clipper_payment_methods table
    create table(:clipper_payment_methods) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :method_type, :string, null: false
      add :details, :binary
      add :is_default, :boolean, default: false

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_payment_methods, [:user_id])
    create index(:clipper_payment_methods, [:method_type])

    # Create campaign_submissions table
    create table(:campaign_submissions) do
      add :campaign_id, references(:clipping_campaigns, on_delete: :delete_all), null: false
      add :participant_id, references(:campaign_participants, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :social_account_id, references(:clipper_social_accounts, on_delete: :nilify_all)
      add :clip_url, :text, null: false
      add :platform, :string, null: false
      add :platform_post_id, :string
      add :view_count, :integer, default: 0
      add :views_last_updated_at, :utc_datetime
      add :status, :string, null: false, default: "pending"
      add :rejection_reason, :text
      add :verified_at, :utc_datetime
      add :verified_by_user_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:campaign_submissions, [:clip_url])
    create index(:campaign_submissions, [:campaign_id])
    create index(:campaign_submissions, [:participant_id])
    create index(:campaign_submissions, [:user_id])
    create index(:campaign_submissions, [:social_account_id])
    create index(:campaign_submissions, [:status])
    create index(:campaign_submissions, [:platform])

    # Create campaign_payments table
    create table(:campaign_payments) do
      add :campaign_id, references(:clipping_campaigns, on_delete: :delete_all), null: false
      add :submission_id, references(:campaign_submissions, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :amount, :decimal, precision: 12, scale: 2, null: false
      add :views_at_payment, :integer
      add :payment_method_id, references(:clipper_payment_methods, on_delete: :nilify_all)
      add :status, :string, null: false, default: "pending"
      add :external_transaction_id, :string
      add :paid_at, :utc_datetime
      add :paid_by_user_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:campaign_payments, [:campaign_id])
    create index(:campaign_payments, [:submission_id])
    create index(:campaign_payments, [:user_id])
    create index(:campaign_payments, [:payment_method_id])
    create index(:campaign_payments, [:status])
  end
end
