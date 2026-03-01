defmodule ClippsterServer.Repo.Migrations.AddModeratorAndRestrictions do
  use Ecto.Migration

  def change do
    alter table(:users) do
      # Moderator role
      add :is_moderator, :boolean, default: false

      # Platform-level restrictions
      add :is_restricted, :boolean, default: false
      add :restricted_at, :utc_datetime
      add :restricted_reason, :string
      add :scheduled_deletion_at, :utc_datetime

      # Per-user discount tracking
      add :admin_discount_percent, :integer
      add :admin_discount_months_remaining, :integer
      add :admin_discount_applied_at, :utc_datetime
      add :admin_discount_stripe_coupon_id, :string

      # Moderator discount (separate from admin-applied discounts)
      add :mod_discount_enabled, :boolean, default: false
      add :mod_discount_stripe_coupon_id, :string
    end

    # Add support/staff conversation fields
    alter table(:conversations) do
      add :status, :string, default: "open"
      add :archived_at, :utc_datetime
      add :archived_by_user_id, references(:users, on_delete: :nilify_all)
      add :scheduled_deletion_at, :utc_datetime
    end

    # Create mod action logs table
    create table(:mod_action_logs) do
      add :moderator_id, references(:users, on_delete: :delete_all), null: false
      add :action_type, :string, null: false
      add :target_type, :string, null: false
      add :target_id, :integer, null: false
      add :details, :map, default: %{}

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:mod_action_logs, [:moderator_id])
    create index(:mod_action_logs, [:target_type, :target_id])
    create index(:mod_action_logs, [:action_type])
    create index(:mod_action_logs, [:inserted_at])
  end
end
