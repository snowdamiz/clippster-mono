defmodule ClippsterServer.Repo.Migrations.AddPersonalCreatorPlatformLinks do
  use Ecto.Migration

  def change do
    alter table(:user_creator_profiles) do
      add :platform_links, {:array, :map}, default: [], null: false
    end
  end
end
