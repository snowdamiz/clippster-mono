defmodule ClippsterServer.Repo.Migrations.AddUserPreferencesToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      # Display preferences
      add :time_format_preference, :string, default: "12hr"

      # Toast notification preferences
      add :toast_enabled, :boolean, default: true
      add :toast_duration, :integer, default: 5000
      add :toast_position, :string, default: "bottom-right"
      add :toast_sound_enabled, :boolean, default: false
      add :toast_background_enabled, :boolean, default: true

      # Per-category notification toggles
      add :notify_livestream, :boolean, default: true
      add :notify_clips, :boolean, default: true
      add :notify_downloads, :boolean, default: true
      add :notify_projects, :boolean, default: true
      add :notify_social, :boolean, default: true
      add :notify_organization, :boolean, default: true
      add :notify_system, :boolean, default: true
    end
  end
end
