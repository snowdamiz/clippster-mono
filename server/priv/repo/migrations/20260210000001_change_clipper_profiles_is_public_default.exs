defmodule ClippsterServer.Repo.Migrations.ChangeClipperProfilesIsPublicDefault do
  use Ecto.Migration

  def up do
    # Change the column default to true
    alter table(:clipper_profiles) do
      modify :is_public, :boolean, default: true
    end

    # Update existing profiles that are still private to be public
    execute "UPDATE clipper_profiles SET is_public = true WHERE is_public = false"
  end

  def down do
    alter table(:clipper_profiles) do
      modify :is_public, :boolean, default: false
    end
  end
end
