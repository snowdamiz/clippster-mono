defmodule ClippsterServer.Repo.Migrations.CreateUsersTable do
  use Ecto.Migration

  def change do
    create table(:users) do
      add :wallet_address, :string, null: false
      add :is_admin, :boolean, default: false, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:users, [:wallet_address])
  end
end
