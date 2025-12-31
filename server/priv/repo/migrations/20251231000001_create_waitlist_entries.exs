defmodule ClippsterServer.Repo.Migrations.CreateWaitlistEntries do
  use Ecto.Migration

  def change do
    create table(:waitlist_entries) do
      add :email, :string, null: false

      timestamps()
    end

    create unique_index(:waitlist_entries, [:email])
  end
end
