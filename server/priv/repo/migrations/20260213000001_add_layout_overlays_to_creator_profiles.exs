defmodule ClippsterServer.Repo.Migrations.AddLayoutOverlaysToCreatorProfiles do
  use Ecto.Migration

  def change do
    alter table(:organization_creator_profiles) do
      add :layout_overlays, :map
    end
  end
end
