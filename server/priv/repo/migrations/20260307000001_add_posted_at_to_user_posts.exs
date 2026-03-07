defmodule ClippsterServer.Repo.Migrations.AddPostedAtToUserPosts do
  use Ecto.Migration

  def change do
    alter table(:user_posts) do
      add :posted_at, :utc_datetime
    end

    create index(:user_posts, [:posted_at])

    # Backfill posted_at with inserted_at for existing records
    execute(
      "UPDATE user_posts SET posted_at = inserted_at WHERE posted_at IS NULL",
      "UPDATE user_posts SET posted_at = NULL"
    )
  end
end
