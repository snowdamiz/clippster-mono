defmodule ClippsterServer.Repo.Migrations.CreateOrganizationSharedAudio do
  use Ecto.Migration

  def change do
    create table(:organization_shared_audio) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :uploaded_by_user_id, references(:users, on_delete: :nilify_all)
      add :name, :string, null: false
      add :description, :text
      add :url, :text, null: false
      add :mime_type, :string
      add :duration, :decimal
      add :file_size, :bigint
      add :share_with_all, :boolean, default: true, null: false
      add :expires_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:organization_shared_audio, [:organization_id])
    create index(:organization_shared_audio, [:uploaded_by_user_id])
    create index(:organization_shared_audio, [:expires_at])

    create table(:organization_shared_audio_recipients) do
      add :shared_audio_id, references(:organization_shared_audio, on_delete: :delete_all),
        null: false

      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :viewed_at, :utc_datetime
      add :downloaded_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:organization_shared_audio_recipients, [:shared_audio_id, :user_id])
    create index(:organization_shared_audio_recipients, [:user_id])
  end
end
