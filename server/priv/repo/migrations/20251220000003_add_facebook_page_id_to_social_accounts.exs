defmodule ClippsterServer.Repo.Migrations.AddFacebookPageIdToSocialAccounts do
  use Ecto.Migration

  def change do
    alter table(:organization_social_accounts) do
      # Facebook Page ID is needed for Instagram Business accounts
      # The Page Access Token is tied to a specific Facebook Page
      add :facebook_page_id, :string
    end

    create index(:organization_social_accounts, [:facebook_page_id])
  end
end
