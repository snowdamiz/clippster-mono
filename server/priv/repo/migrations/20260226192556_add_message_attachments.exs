defmodule ClippsterServer.Repo.Migrations.AddMessageAttachments do
  use Ecto.Migration

  def change do
    create table(:message_attachments) do
      add :message_id, references(:messages, on_delete: :delete_all), null: false
      add :attachment_type, :string, null: false
      add :url, :string, null: false
      add :thumbnail_url, :string
      add :filename, :string, null: false
      add :mime_type, :string, null: false
      add :file_size, :bigint, null: false
      add :width, :integer
      add :height, :integer

      timestamps(type: :utc_datetime)
    end

    create index(:message_attachments, [:message_id])
  end
end
