defmodule ClippsterServer.Repo.Migrations.CreateAiChatTables do
  use Ecto.Migration

  def change do
    create table(:ai_chat_sessions) do
      add :status, :string, null: false, default: "discovery"
      add :media_items, :jsonb, default: "[]"
      add :composition, :jsonb
      add :refinement_round, :integer, default: 0, null: false
      add :refinement_messages_used, :integer, default: 0, null: false
      add :max_refinement_rounds, :integer, default: 3, null: false
      add :max_messages_per_round, :integer, default: 6, null: false
      add :style_context, :jsonb, default: "{}"
      add :reference_analysis, :jsonb
      add :media_analysis, :jsonb
      add :reference_url, :text

      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:ai_chat_sessions, [:user_id])
    create index(:ai_chat_sessions, [:status])

    create table(:ai_chat_messages) do
      add :role, :string, null: false
      add :content, :text, null: false
      add :metadata, :jsonb

      add :session_id, references(:ai_chat_sessions, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:ai_chat_messages, [:session_id, :inserted_at])
  end
end
