defmodule ClippsterServer.Repo.Migrations.CreateUserCredits do
  use Ecto.Migration

  def change do
    create table(:user_credits, primary_key: false) do
      add :user_id, references(:users, on_delete: :restrict), primary_key: true
      add :hours_remaining, :decimal, precision: 10, scale: 2, default: 0, null: false
      add :hours_used, :decimal, precision: 10, scale: 2, default: 0, null: false

      timestamps(type: :utc_datetime)
    end
  end
end
