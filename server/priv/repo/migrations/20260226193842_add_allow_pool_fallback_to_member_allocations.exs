defmodule ClippsterServer.Repo.Migrations.AddAllowPoolFallbackToMemberAllocations do
  use Ecto.Migration

  def change do
    alter table(:member_credit_allocations) do
      add :allow_pool_fallback, :boolean, default: false, null: false
    end
  end
end
