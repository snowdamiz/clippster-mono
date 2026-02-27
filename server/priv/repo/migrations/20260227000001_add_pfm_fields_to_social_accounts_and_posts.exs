defmodule ClippsterServer.Repo.Migrations.AddPfmFieldsToSocialAccountsAndPosts do
  use Ecto.Migration

  def change do
    # Add pfm_account_id to organization_social_accounts
    alter table(:organization_social_accounts) do
      add :pfm_account_id, :string
      add :account_type, :string  # "personal" or "business" (for Instagram)
    end

    create index(:organization_social_accounts, [:pfm_account_id])

    # Add pfm_account_id to clipper_social_accounts (user-level)
    alter table(:clipper_social_accounts) do
      add :pfm_account_id, :string
      add :account_type, :string  # "personal" or "business" (for Instagram)
    end

    create index(:clipper_social_accounts, [:pfm_account_id])

    # Add pfm_post_id to post_submissions
    alter table(:post_submissions) do
      add :pfm_post_id, :string
    end

    create index(:post_submissions, [:pfm_post_id])
  end
end
