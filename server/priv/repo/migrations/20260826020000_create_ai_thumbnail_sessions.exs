defmodule ClippsterServer.Repo.Migrations.CreateAiThumbnailSessions do
  use Ecto.Migration

  def change do
    create table(:ai_thumbnail_sessions) do
      add :name, :string
      add :status, :string, null: false, default: "discovery"
      add :generation_mode, :string, null: false, default: "editable"
      add :media_items, :jsonb, default: "[]"
      add :key_frames, :jsonb, default: "[]"
      add :reference_image_url, :text
      add :reference_image_meta, :jsonb
      add :brief_summary, :jsonb
      add :candidates, :jsonb, default: "[]"
      add :plate_url, :text
      add :recipe, :jsonb
      add :composition, :jsonb
      add :result, :jsonb
      add :thumbnail_url, :text
      add :refinement_round, :integer, default: 0, null: false
      add :refinement_messages_used, :integer, default: 0, null: false
      add :max_refinement_rounds, :integer, default: 3, null: false
      add :max_messages_per_round, :integer, default: 6, null: false
      add :canvas_width, :integer, default: 1280
      add :canvas_height, :integer, default: 720

      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:ai_thumbnail_sessions, [:user_id])
    create index(:ai_thumbnail_sessions, [:status])
    create index(:ai_thumbnail_sessions, [:generation_mode])

    create table(:ai_thumbnail_messages) do
      add :role, :string, null: false
      add :content, :text, null: false
      add :metadata, :jsonb

      add :session_id, references(:ai_thumbnail_sessions, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:ai_thumbnail_messages, [:session_id, :inserted_at])
  end
end
