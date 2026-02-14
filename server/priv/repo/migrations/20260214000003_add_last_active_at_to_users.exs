defmodule ClippsterServer.Repo.Migrations.AddLastActiveAtToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :last_active_at, :utc_datetime
    end

    # Set existing users' last_active_at to their updated_at timestamp
    execute "UPDATE users SET last_active_at = updated_at WHERE last_active_at IS NULL"
  end
end
