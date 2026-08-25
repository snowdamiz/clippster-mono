defmodule ClippsterServer.Repo.Migrations.HardenAdminEmailCampaigns do
  use Ecto.Migration

  def change do
    alter table(:admin_email_campaigns) do
      add :preheader, :string
      add :sent_count, :integer, null: false, default: 0
      add :failed_count, :integer, null: false, default: 0
      add :suppressed_count, :integer, null: false, default: 0
    end

    create table(:admin_email_campaign_recipients) do
      add :campaign_id, references(:admin_email_campaigns, on_delete: :delete_all), null: false
      add :email, :string, null: false
      add :status, :string, null: false, default: "pending"
      add :sent_at, :utc_datetime
      add :error, :text

      timestamps(type: :utc_datetime)
    end

    create index(:admin_email_campaign_recipients, [:campaign_id])
    create index(:admin_email_campaign_recipients, [:status])
    create unique_index(:admin_email_campaign_recipients, [:campaign_id, :email])

    create table(:email_suppressions) do
      add :email, :string, null: false
      add :reason, :string, null: false, default: "unsubscribe"
      add :source, :string
      add :suppressed_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:email_suppressions, ["lower(email)"],
             name: :email_suppressions_email_lower_index
           )
  end
end
