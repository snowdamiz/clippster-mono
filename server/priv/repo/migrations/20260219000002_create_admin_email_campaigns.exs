defmodule ClippsterServer.Repo.Migrations.CreateAdminEmailCampaigns do
  use Ecto.Migration

  def change do
    create table(:admin_email_campaigns) do
      add :subject, :string, null: false
      add :body, :text, null: false
      add :audience, :string, null: false
      add :target_email, :string
      add :sent_by, references(:users, on_delete: :nilify_all)
      add :sent_at, :utc_datetime
      add :recipient_count, :integer, default: 0
      add :status, :string, null: false, default: "draft"

      timestamps(type: :utc_datetime)
    end

    create index(:admin_email_campaigns, [:sent_by])
    create index(:admin_email_campaigns, [:status])
    create index(:admin_email_campaigns, [:inserted_at])
  end
end
