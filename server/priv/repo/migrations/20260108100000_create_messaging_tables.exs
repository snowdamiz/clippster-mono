defmodule ClippsterServer.Repo.Migrations.CreateMessagingTables do
  use Ecto.Migration

  def change do
    create table(:conversations) do
      # "direct", "group", "announcement"
      add :type, :string, null: false
      # For group chats (null for direct)
      add :name, :string
      add :last_message_at, :utc_datetime
      add :last_message_preview, :string

      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :created_by_user_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:conversations, [:organization_id])
    create index(:conversations, [:last_message_at])
    create index(:conversations, [:type])

    create table(:conversation_participants) do
      # "admin", "member"
      add :role, :string, default: "member", null: false
      add :joined_at, :utc_datetime
      add :left_at, :utc_datetime
      add :last_read_at, :utc_datetime
      add :muted, :boolean, default: false, null: false

      add :conversation_id, references(:conversations, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:conversation_participants, [:conversation_id, :user_id])
    create index(:conversation_participants, [:user_id])

    create table(:messages) do
      add :content, :text, null: false
      # "text", "system"
      add :message_type, :string, default: "text", null: false
      add :edited_at, :utc_datetime
      add :deleted_at, :utc_datetime

      add :conversation_id, references(:conversations, on_delete: :delete_all), null: false
      add :sender_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:messages, [:conversation_id, :inserted_at])
    create index(:messages, [:sender_id])

    create table(:message_read_status) do
      add :read_at, :utc_datetime, null: false

      add :message_id, references(:messages, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:message_read_status, [:message_id, :user_id])
    create index(:message_read_status, [:user_id])
  end
end
