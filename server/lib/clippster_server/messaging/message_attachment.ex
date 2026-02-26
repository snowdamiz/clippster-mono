defmodule ClippsterServer.Messaging.MessageAttachment do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Messaging.Message

  @attachment_types ~w(image)
  @max_file_size 15_728_640  # 15MB in bytes

  schema "message_attachments" do
    field :attachment_type, :string
    field :url, :string
    field :thumbnail_url, :string
    field :filename, :string
    field :mime_type, :string
    field :file_size, :integer
    field :width, :integer
    field :height, :integer

    belongs_to :message, Message

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(attachment, attrs) do
    attachment
    |> cast(attrs, [
      :message_id,
      :attachment_type,
      :url,
      :thumbnail_url,
      :filename,
      :mime_type,
      :file_size,
      :width,
      :height
    ])
    |> validate_required([
      :message_id,
      :attachment_type,
      :url,
      :filename,
      :mime_type,
      :file_size
    ])
    |> validate_inclusion(:attachment_type, @attachment_types)
    |> validate_number(:file_size, less_than_or_equal_to: @max_file_size)
    |> validate_number(:width, greater_than: 0)
    |> validate_number(:height, greater_than: 0)
    |> foreign_key_constraint(:message_id)
  end

  @doc """
  Returns the list of valid attachment types.
  """
  def attachment_types, do: @attachment_types

  @doc """
  Returns the maximum file size in bytes.
  """
  def max_file_size, do: @max_file_size
end
