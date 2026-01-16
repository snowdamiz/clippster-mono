defmodule ClippsterServer.Repo.Migrations.IncreaseCampaignCoverImageUrlLength do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      modify :cover_image_url, :text
    end
  end
end
