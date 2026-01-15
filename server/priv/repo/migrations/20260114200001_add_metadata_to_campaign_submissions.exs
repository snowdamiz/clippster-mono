defmodule ClippsterServer.Repo.Migrations.AddMetadataToCampaignSubmissions do
  use Ecto.Migration

  def change do
    alter table(:campaign_submissions) do
      # Analytics fields (to match external_post_submissions)
      add :like_count, :integer, default: 0
      add :comment_count, :integer, default: 0
      add :share_count, :integer, default: 0
      add :save_count, :integer, default: 0

      # Author metadata from platform API
      add :author_username, :string
      add :author_name, :string
      add :author_profile_image, :string

      # Additional metadata
      add :caption, :text
      add :media_type, :string
    end
  end
end
