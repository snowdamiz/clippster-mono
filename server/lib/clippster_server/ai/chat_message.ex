defmodule ClippsterServer.AI.ChatMessage do
  use Ecto.Schema
  import Ecto.Changeset

  @valid_roles ~w(user assistant system)

  schema "ai_chat_messages" do
    field :role, :string
    field :content, :string
    field :metadata, :map

    belongs_to :session, ClippsterServer.AI.ChatSession

    timestamps(type: :utc_datetime)
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:role, :content, :metadata, :session_id])
    |> validate_required([:role, :content, :session_id])
    |> validate_inclusion(:role, @valid_roles)
    |> foreign_key_constraint(:session_id)
  end
end
