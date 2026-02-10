defmodule ClippsterServer.Repo.Migrations.CreateHiringPostsAndApplications do
  use Ecto.Migration

  def change do
    create table(:hiring_posts) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :title, :string, null: false
      add :description, :text
      add :content_types, {:array, :string}, default: []
      add :languages, {:array, :string}, default: []
      add :platforms, {:array, :string}, default: []
      add :payment_type, :string
      add :payment_details, :string
      add :streamer_count, :integer
      add :clipper_slots, :integer
      add :clipper_slots_filled, :integer, default: 0
      add :experience_level, :string
      add :status, :string, default: "active"
      add :is_public, :boolean, default: true

      timestamps(type: :utc_datetime)
    end

    create unique_index(:hiring_posts, [:organization_id])
    create index(:hiring_posts, [:status])

    create table(:hiring_applications) do
      add :hiring_post_id, references(:hiring_posts, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :message, :text
      add :status, :string, default: "pending"
      add :reviewed_at, :utc_datetime
      add :reviewed_by_id, references(:users, on_delete: :nilify_all)
      add :admin_notes, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:hiring_applications, [:hiring_post_id, :user_id])
    create index(:hiring_applications, [:user_id])
    create index(:hiring_applications, [:status])
  end
end
