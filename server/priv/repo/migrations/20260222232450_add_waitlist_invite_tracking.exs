defmodule ClippsterServer.Repo.Migrations.AddWaitlistInviteTracking do
  use Ecto.Migration

  def change do
    # Add fields to waitlist_entries
    alter table(:waitlist_entries) do
      add :invited_at, :utc_datetime
      add :email_sent_at, :utc_datetime
      add :email_delivery_error, :text
      add :beta_code_id, references(:beta_codes, on_delete: :nilify_all)
      add :discount_code, :string
      add :discount_stripe_promo_id, :string
    end

    # Add fields to beta_codes
    alter table(:beta_codes) do
      add :assigned_email, :string
      add :verified_at, :utc_datetime
      add :verified_from_ip, :string
    end

    # Add unique constraint to prevent duplicate code assignments
    create unique_index(:waitlist_entries, [:beta_code_id])

    # Add index for faster lookups
    create index(:beta_codes, [:assigned_email])
    create index(:waitlist_entries, [:invited_at])
  end
end
