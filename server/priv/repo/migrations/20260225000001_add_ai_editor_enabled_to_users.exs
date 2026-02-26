defmodule ClippsterServer.Repo.Migrations.AddAiEditorEnabledToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :ai_editor_enabled, :boolean, default: false, null: false
    end

    # Create index for faster queries
    create index(:users, [:ai_editor_enabled])
  end
end
