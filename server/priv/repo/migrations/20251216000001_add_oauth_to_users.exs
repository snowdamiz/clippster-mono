defmodule ClippsterServer.Repo.Migrations.AddOAuthToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :email, :string
      add :name, :string
      add :avatar_url, :string
      add :provider, :string, default: "wallet"
      add :provider_id, :string
    end

    # Make wallet_address nullable for Google-only users
    execute "ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL",
            "ALTER TABLE users ALTER COLUMN wallet_address SET NOT NULL"

    # Set provider_id to wallet_address for existing wallet users
    execute "UPDATE users SET provider_id = wallet_address WHERE provider = 'wallet' OR provider IS NULL",
            "SELECT 1"

    # Update provider for existing users
    execute "UPDATE users SET provider = 'wallet' WHERE provider IS NULL",
            "SELECT 1"

    create unique_index(:users, [:email], where: "email IS NOT NULL")
    create unique_index(:users, [:provider, :provider_id])
  end
end
