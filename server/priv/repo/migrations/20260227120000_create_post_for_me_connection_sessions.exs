defmodule ClippsterServer.Repo.Migrations.CreatePostForMeConnectionSessions do
  use Ecto.Migration

  def change do
    create table(:post_for_me_connection_sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :scope, :string, null: false
      add :organization_id, references(:organizations, on_delete: :nilify_all)
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :platform, :string, null: false
      add :external_id, :string, null: false
      add :status, :string, null: false, default: "pending"
      add :success, :boolean
      add :account_ids, {:array, :string}, null: false, default: []
      add :callback_payload, :map
      add :error_message, :text
      add :return_mode, :string, null: false, default: "tauri"
      add :return_url, :text
      add :expires_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:post_for_me_connection_sessions, [:external_id],
             name: :post_for_me_connection_sessions_external_id_index
           )

    create index(:post_for_me_connection_sessions, [:user_id])
    create index(:post_for_me_connection_sessions, [:organization_id])
    create index(:post_for_me_connection_sessions, [:status])
    create index(:post_for_me_connection_sessions, [:expires_at])

    create index(
             :post_for_me_connection_sessions,
             [:scope, :user_id, :organization_id, :status],
             name: :post_for_me_connection_sessions_lookup_index
           )
  end
end
