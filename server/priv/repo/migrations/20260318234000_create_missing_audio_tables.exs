defmodule ClippsterServer.Repo.Migrations.CreateMissingAudioTables do
  use Ecto.Migration

  def change do
    # Create audio_playlists table if it doesn't exist
    create_if_not_exists table(:audio_playlists, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :user_id, :binary_id, null: false
      add :organization_id, :binary_id
      add :is_public, :boolean, default: false

      timestamps()
    end

    # Create audio_playlist_tracks table if it doesn't exist
    create_if_not_exists table(:audio_playlist_tracks, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :playlist_id, :binary_id, null: false
      add :audio_id, :binary_id, null: false
      add :position, :integer, null: false
      add :added_at, :utc_datetime, null: false

      timestamps()
    end

    # Add indexes only if they don't exist
    create_if_not_exists index(:audio_playlists, [:user_id])
    create_if_not_exists index(:audio_playlists, [:organization_id])
    create_if_not_exists index(:audio_playlists, [:is_public])
    create_if_not_exists index(:audio_playlist_tracks, [:playlist_id])
    create_if_not_exists index(:audio_playlist_tracks, [:audio_id])
    create_if_not_exists index(:audio_playlist_tracks, [:position])
  end
end
