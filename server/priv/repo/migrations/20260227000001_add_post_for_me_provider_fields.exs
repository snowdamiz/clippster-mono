defmodule ClippsterServer.Repo.Migrations.AddPostForMeProviderFields do
  use Ecto.Migration

  def up do
    alter table(:organization_social_accounts) do
      add :provider, :string
      add :provider_platform, :string
      add :provider_account_id, :string
      add :provider_payload, :map
    end

    create index(:organization_social_accounts, [:provider])
    create index(:organization_social_accounts, [:provider_account_id])

    create unique_index(
             :organization_social_accounts,
             [:organization_id, :provider, :provider_account_id],
             where: "provider IS NOT NULL AND provider_account_id IS NOT NULL",
             name: :org_social_accounts_provider_unique
           )

    alter table(:post_submissions) do
      add :provider, :string
      add :provider_post_id, :string
      add :provider_payload, :map
    end

    create index(:post_submissions, [:provider])
    create index(:post_submissions, [:provider_post_id])

    create unique_index(
             :post_submissions,
             [:provider, :provider_post_id],
             where: "provider IS NOT NULL AND provider_post_id IS NOT NULL",
             name: :post_submissions_provider_post_unique
           )

    alter table(:clipper_social_accounts) do
      add :provider, :string
      add :provider_platform, :string
      add :provider_account_id, :string
      add :provider_payload, :map
    end

    create index(:clipper_social_accounts, [:provider])
    create index(:clipper_social_accounts, [:provider_account_id])

    create unique_index(
             :clipper_social_accounts,
             [:user_id, :provider, :provider_account_id],
             where: "provider IS NOT NULL AND provider_account_id IS NOT NULL",
             name: :clipper_social_accounts_provider_unique
           )

    alter table(:user_posts) do
      add :provider, :string
      add :provider_post_id, :string
      add :provider_payload, :map
    end

    create index(:user_posts, [:provider])
    create index(:user_posts, [:provider_post_id])

    create unique_index(
             :user_posts,
             [:provider, :provider_post_id],
             where: "provider IS NOT NULL AND provider_post_id IS NOT NULL",
             name: :user_posts_provider_post_unique
           )

    # Normalize platform keys for Twitter -> X.
    execute("UPDATE organization_social_accounts SET platform = 'x' WHERE platform = 'twitter'")
    execute("UPDATE post_submissions SET platform = 'x' WHERE platform = 'twitter'")
    execute("UPDATE clipper_social_accounts SET platform = 'x' WHERE platform = 'twitter'")
    execute("UPDATE user_posts SET platform = 'x' WHERE platform = 'twitter'")

    # Mark existing rows as legacy-backed.
    execute("UPDATE organization_social_accounts SET provider = 'legacy' WHERE provider IS NULL")
    execute("UPDATE post_submissions SET provider = 'legacy' WHERE provider IS NULL")
    execute("UPDATE clipper_social_accounts SET provider = 'legacy' WHERE provider IS NULL")
    execute("UPDATE user_posts SET provider = 'legacy' WHERE provider IS NULL")
  end

  def down do
    drop_if_exists index(:user_posts, [:provider, :provider_post_id],
                     name: :user_posts_provider_post_unique
                   )

    drop_if_exists index(:user_posts, [:provider_post_id])
    drop_if_exists index(:user_posts, [:provider])

    alter table(:user_posts) do
      remove :provider_payload
      remove :provider_post_id
      remove :provider
    end

    drop_if_exists(
      index(:clipper_social_accounts, [:user_id, :provider, :provider_account_id],
        name: :clipper_social_accounts_provider_unique
      )
    )

    drop_if_exists index(:clipper_social_accounts, [:provider_account_id])
    drop_if_exists index(:clipper_social_accounts, [:provider])

    alter table(:clipper_social_accounts) do
      remove :provider_payload
      remove :provider_account_id
      remove :provider_platform
      remove :provider
    end

    drop_if_exists(
      index(:post_submissions, [:provider, :provider_post_id],
        name: :post_submissions_provider_post_unique
      )
    )

    drop_if_exists index(:post_submissions, [:provider_post_id])
    drop_if_exists index(:post_submissions, [:provider])

    alter table(:post_submissions) do
      remove :provider_payload
      remove :provider_post_id
      remove :provider
    end

    drop_if_exists(
      index(:organization_social_accounts, [:organization_id, :provider, :provider_account_id],
        name: :org_social_accounts_provider_unique
      )
    )

    drop_if_exists index(:organization_social_accounts, [:provider_account_id])
    drop_if_exists index(:organization_social_accounts, [:provider])

    alter table(:organization_social_accounts) do
      remove :provider_payload
      remove :provider_account_id
      remove :provider_platform
      remove :provider
    end
  end
end
