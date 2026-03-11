defmodule ClippsterServer.Repo.Migrations.AddClipTrackingToPostSubmissions do
  use Ecto.Migration

  def change do
    alter table(:post_submissions) do
      # Note: clip_id and campaign_id already exist from 20260115000002_add_instagram_scheduling_fields.exs
      
      # Clip build tracking
      add :clip_build_id, :string
      
      # Aspect ratio tracking
      add :aspect_ratio, :string
      
      # Build type tracking
      add :build_type, :string  # 'org', 'campaign', 'personal'
    end

    # Note: clip_id and campaign_id indexes already exist
    create index(:post_submissions, [:clip_build_id])
  end
end
