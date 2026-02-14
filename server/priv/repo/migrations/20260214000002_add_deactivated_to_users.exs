defmodule ClippsterServer.Repo.Migrations.AddDeactivatedToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :deactivated, :boolean, default: false
      add :deactivated_at, :utc_datetime
    end
  end
end
