defmodule ClippsterServer.Repo.Migrations.CreateBugReportsTable do
  use Ecto.Migration

  def change do
    create table(:bug_reports) do
      add :title, :string, null: false
      add :description, :text, null: false
      add :severity, :string, default: "medium", null: false
      add :expected_behavior, :text
      add :actual_behavior, :text
      add :user_wallet_address, :string, null: false
      add :status, :string, default: "open", null: false

      timestamps(type: :utc_datetime)
    end

    create index(:bug_reports, [:user_wallet_address])
    create index(:bug_reports, [:status])
    create index(:bug_reports, [:severity])
    create index(:bug_reports, [:inserted_at])
  end
end
