defmodule ClippsterServer.Repo.Migrations.MakeExternalPostSubmissionsOrgNullable do
  use Ecto.Migration

  def change do
    execute "ALTER TABLE external_post_submissions ALTER COLUMN organization_id DROP NOT NULL",
            "ALTER TABLE external_post_submissions ALTER COLUMN organization_id SET NOT NULL"
  end
end
