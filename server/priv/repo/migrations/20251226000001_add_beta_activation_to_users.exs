defmodule ClippsterServer.Repo.Migrations.AddBetaActivationToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :beta_activated, :boolean, default: false, null: false
    end

    # Existing users should be considered beta activated
    execute(
      "UPDATE users SET beta_activated = true",
      "UPDATE users SET beta_activated = false"
    )
  end
end
