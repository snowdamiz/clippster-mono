defmodule ClippsterServer.Repo.Migrations.AddPostApproval do
  use Ecto.Migration

  def change do
    alter table(:post_submissions) do
      add :reviewed_by_user_id, references(:users, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime
      add :review_notes, :text
    end
  end
end
