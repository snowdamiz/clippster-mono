defmodule ClippsterServer.Repo.Migrations.CreateWorkspaceOauthCodes do
  use Ecto.Migration

  def change do
    create table(:workspace_oauth_codes, primary_key: false) do
      add :code_hash, :string, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :origin, :string, null: false
      add :code_challenge, :string, null: false
      add :expires_at, :utc_datetime, null: false
    end

    create index(:workspace_oauth_codes, [:expires_at])
  end
end
