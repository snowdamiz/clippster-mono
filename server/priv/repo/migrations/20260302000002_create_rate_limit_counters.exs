defmodule ClippsterServer.Repo.Migrations.CreateRateLimitCounters do
  use Ecto.Migration

  def change do
    create table(:rate_limit_counters, primary_key: false) do
      add :key, :string, null: false
      add :window_start, :bigint, null: false
      add :count, :integer, null: false, default: 0
    end

    create unique_index(:rate_limit_counters, [:key, :window_start])
    create index(:rate_limit_counters, [:window_start])
  end
end
