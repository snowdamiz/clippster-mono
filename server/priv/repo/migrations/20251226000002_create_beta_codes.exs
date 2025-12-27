defmodule ClippsterServer.Repo.Migrations.CreateBetaCodes do
  use Ecto.Migration

  def change do
    create table(:beta_codes) do
      add :code, :string, null: false
      add :used_by_user_id, references(:users, on_delete: :nilify_all)
      add :used_at, :utc_datetime

      timestamps()
    end

    create unique_index(:beta_codes, [:code])
    create index(:beta_codes, [:used_by_user_id])
  end
end
