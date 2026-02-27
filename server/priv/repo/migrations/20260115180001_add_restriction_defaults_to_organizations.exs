defmodule ClippsterServer.Repo.Migrations.AddRestrictionDefaultsToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      # Organization-level defaults for all restricted members
      add :restriction_defaults, :jsonb,
        default:
          fragment("""
            '{
              "allow_ai": true,
              "allow_asset_uploads": false,
              "allow_custom_prompts": false,
              "allow_clipper_profile": false,
              "allow_personal_social": true,
              "allow_clip_deletion": false,
              "force_org_watermark": true,
              "require_clip_approval": false,
              "clips_visible_to_admins": true
            }'::jsonb
          """)
    end
  end
end
