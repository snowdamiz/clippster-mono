defmodule ClippsterServer.Messaging.Message do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Messaging.{Conversation, MessageReadStatus, MessageAttachment}

  @message_types ~w(text system)

  schema "messages" do
    field :content, :string
    field :message_type, :string, default: "text"
    field :edited_at, :utc_datetime
    field :deleted_at, :utc_datetime

    belongs_to :conversation, Conversation
    belongs_to :sender, User

    has_many :read_statuses, MessageReadStatus
    has_many :attachments, MessageAttachment

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(message, attrs) do
    message
    |> cast(attrs, [:content, :message_type, :conversation_id, :sender_id])
    |> validate_required([:content, :conversation_id])
    |> validate_inclusion(:message_type, @message_types)
    |> foreign_key_constraint(:conversation_id)
    |> foreign_key_constraint(:sender_id)
  end

  def edit_changeset(message, attrs) do
    message
    |> cast(attrs, [:content, :edited_at])
    |> validate_required([:content, :edited_at])
  end

  def delete_changeset(message, attrs) do
    message
    |> cast(attrs, [:deleted_at])
  end
end
