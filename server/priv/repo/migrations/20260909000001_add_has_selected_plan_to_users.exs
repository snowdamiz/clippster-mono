defmodule ClippsterServer.Repo.Migrations.AddHasSelectedPlanToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :has_selected_plan, :boolean, default: false, null: false
    end
  end
end
