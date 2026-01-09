defmodule ClippsterServer.Messaging.MessageReadStatus do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Messaging.Message

  schema "message_read_status" do
    field :read_at, :utc_datetime

    belongs_to :message, Message
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(read_status, attrs) do
    read_status
    |> cast(attrs, [:read_at, :message_id, :user_id])
    |> validate_required([:read_at, :message_id, :user_id])
    |> unique_constraint([:message_id, :user_id])
    |> foreign_key_constraint(:message_id)
    |> foreign_key_constraint(:user_id)
  end
end
