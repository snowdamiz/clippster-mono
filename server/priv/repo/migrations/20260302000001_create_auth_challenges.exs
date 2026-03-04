defmodule ClippsterServer.Repo.Migrations.CreateAuthChallenges do
  use Ecto.Migration

  def change do
    create table(:auth_challenges, primary_key: false) do
      add :nonce, :string, primary_key: true, null: false
      add :client_id, :string, null: false
      add :domain, :string, null: false
      add :expires_at, :utc_datetime_usec, null: false
      add :timestamp, :bigint, null: false
      timestamps(updated_at: false)
    end

    create index(:auth_challenges, [:expires_at])
  end
end
