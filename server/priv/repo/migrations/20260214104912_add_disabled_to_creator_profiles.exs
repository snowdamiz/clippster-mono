defmodule ClippsterServer.Repo.Migrations.AddDisabledToCreatorProfiles do
  use Ecto.Migration

  def change do
    alter table(:organization_creator_profiles) do
      add :disabled, :boolean, default: false, null: false
    end

    create index(:organization_creator_profiles, [:organization_id, :disabled])
  end
end
