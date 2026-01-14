defmodule ClippsterServer.Messaging.Conversation do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.Organization
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Messaging.{ConversationParticipant, Message}

  @conversation_types ~w(direct group announcement)

  schema "conversations" do
    field :type, :string
    field :name, :string
    field :last_message_at, :utc_datetime
    field :last_message_preview, :string

    belongs_to :organization, Organization
    belongs_to :created_by, User, foreign_key: :created_by_user_id

    has_many :participants, ConversationParticipant
    has_many :messages, Message

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [:type, :name, :last_message_at, :last_message_preview, :organization_id, :created_by_user_id])
    |> validate_required([:type])
    |> validate_inclusion(:type, @conversation_types)
    |> validate_name_for_group()
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:created_by_user_id)
  end

  defp validate_name_for_group(changeset) do
    type = get_field(changeset, :type)

    if type == "group" do
      validate_required(changeset, [:name])
    else
      changeset
    end
  end

  def update_last_message_changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [:last_message_at, :last_message_preview])
  end
end
