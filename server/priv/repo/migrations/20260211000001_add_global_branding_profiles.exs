defmodule ClippsterServer.Repo.Migrations.AddGlobalBrandingProfiles do
  @moduledoc """
  WARNING: This migration shares timestamp 20260211000001 with CreateAffiliateTables.
  Due to the collision, this migration was recorded as "up" but never actually executed.
  The columns are instead added by 20260211040000_repair_global_branding_profiles.exs.
  """
  use Ecto.Migration

  def change do
    alter table(:organization_creator_profiles) do
      add :scope, :string, default: "streamer", null: false
    end

    alter table(:organization_members) do
      add :branding_profile_id, references(:organization_creator_profiles, on_delete: :nilify_all)
    end

    alter table(:clipping_campaigns) do
      add :branding_profile_id, references(:organization_creator_profiles, on_delete: :nilify_all)
    end

    create index(:organization_creator_profiles, [:organization_id, :scope])
  end
end
