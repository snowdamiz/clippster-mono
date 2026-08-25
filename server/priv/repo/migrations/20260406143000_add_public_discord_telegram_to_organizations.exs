defmodule ClippsterServer.Repo.Migrations.AddPublicDiscordTelegramToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      add :public_discord, :string
      add :public_telegram, :string
    end
  end
end
