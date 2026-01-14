defmodule ClippsterServer.Repo.Migrations.MakeConversationsOrganizationIdNullable do
  use Ecto.Migration

  def up do
    alter table(:conversations) do
      modify :organization_id, :integer, null: true
    end
  end

  def down do
    alter table(:conversations) do
      modify :organization_id, :integer, null: false
    end
  end
end
