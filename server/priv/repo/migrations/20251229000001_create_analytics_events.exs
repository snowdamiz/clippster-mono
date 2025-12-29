defmodule ClippsterServer.Repo.Migrations.CreateAnalyticsEvents do
  use Ecto.Migration

  def change do
    create table(:analytics_events) do
      add :event_type, :string, null: false
      add :user_id, references(:users, on_delete: :nilify_all)
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:analytics_events, [:event_type])
    create index(:analytics_events, [:user_id])
    create index(:analytics_events, [:inserted_at])
  end
end