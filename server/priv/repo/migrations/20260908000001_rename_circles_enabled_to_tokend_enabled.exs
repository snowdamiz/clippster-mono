defmodule ClippsterServer.Repo.Migrations.RenameCirclesEnabledToTokendEnabled do
  use Ecto.Migration

  def change do
    drop_if_exists index(:users, [:circles_enabled])

    rename table(:users), :circles_enabled, to: :tokend_enabled

    create index(:users, [:tokend_enabled])
  end
end
