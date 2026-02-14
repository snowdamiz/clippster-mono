defmodule ClippsterServer.Repo.Migrations.AddCreatedByToCreatorProfiles do
  use Ecto.Migration

  def change do
    alter table(:organization_creator_profiles) do
      add :created_by_user_id, references(:users, on_delete: :nilify_all)
    end

    create index(:organization_creator_profiles, [:created_by_user_id])
  end
end
