defmodule ClippsterServer.Repo.Migrations.AddCompletedToursAndCirclesEnabled do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :completed_tours, :map, default: %{}
      add :tour_version_seen, :string
      add :circles_enabled, :boolean, default: false, null: false
    end

    create index(:users, [:circles_enabled])
  end
end
