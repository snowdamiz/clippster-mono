defmodule ClippsterServer.Repo.Migrations.AddEmailChangeFieldsToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :email_change_token, :string
      add :email_change_new_email, :string
      add :email_change_sent_at, :utc_datetime
    end
  end
end
