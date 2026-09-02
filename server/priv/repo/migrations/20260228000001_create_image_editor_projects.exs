defmodule ClippsterServer.Repo.Migrations.CreateImageEditorProjects do
  use Ecto.Migration

  def change do
    create table(:image_editor_projects) do
      add :name, :string, null: false
      add :project_data, :jsonb, null: false
      add :thumbnail_url, :text
      add :canvas_width, :integer
      add :canvas_height, :integer
      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:image_editor_projects, [:user_id])
    create index(:image_editor_projects, [:updated_at])
  end
end
