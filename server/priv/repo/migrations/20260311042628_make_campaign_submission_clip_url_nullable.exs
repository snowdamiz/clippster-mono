defmodule ClippsterServer.Repo.Migrations.MakeCampaignSubmissionClipUrlNullable do
  use Ecto.Migration

  def change do
    alter table(:campaign_submissions) do
      modify :clip_url, :string, null: true
    end
  end
end
