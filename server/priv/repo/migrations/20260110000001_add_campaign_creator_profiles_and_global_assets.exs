defmodule ClippsterServer.Repo.Migrations.AddCampaignCreatorProfilesAndGlobalAssets do
  use Ecto.Migration

  def change do
    # Join table for assigning multiple creator profiles to a campaign
    create table(:campaign_creator_profiles) do
      add :campaign_id, references(:clipping_campaigns, on_delete: :delete_all), null: false

      add :creator_profile_id, references(:organization_creator_profiles, on_delete: :delete_all),
        null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:campaign_creator_profiles, [:campaign_id, :creator_profile_id])
    create index(:campaign_creator_profiles, [:campaign_id])
    create index(:campaign_creator_profiles, [:creator_profile_id])

    # Add global asset fields to campaigns
    # Watermarks are stored as a map with aspect ratio keys (e.g., "16:9", "9:16", "1:1")
    # Each key maps to an asset_id
    alter table(:clipping_campaigns) do
      add :global_watermarks, :map, default: %{}
      add :global_intro_id, references(:organization_assets, on_delete: :nilify_all)
      add :global_outro_id, references(:organization_assets, on_delete: :nilify_all)
      add :require_watermark, :boolean, default: false
      add :require_intro, :boolean, default: false
      add :require_outro, :boolean, default: false
    end

    create index(:clipping_campaigns, [:global_intro_id])
    create index(:clipping_campaigns, [:global_outro_id])
  end
end
