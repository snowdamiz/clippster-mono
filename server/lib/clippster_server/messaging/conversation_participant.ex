defmodule ClippsterServer.Messaging.ConversationParticipant do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Messaging.Conversation

  @participant_roles ~w(admin member)

  schema "conversation_participants" do
    field :role, :string, default: "member"
    field :joined_at, :utc_datetime
    field :left_at, :utc_datetime
    field :last_read_at, :utc_datetime
    field :muted, :boolean, default: false

    belongs_to :conversation, Conversation
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(participant, attrs) do
    participant
    |> cast(attrs, [
      :role,
      :joined_at,
      :left_at,
      :last_read_at,
      :muted,
      :conversation_id,
      :user_id
    ])
    |> validate_required([:conversation_id, :user_id])
    |> validate_inclusion(:role, @participant_roles)
    |> unique_constraint([:conversation_id, :user_id])
    |> foreign_key_constraint(:conversation_id)
    |> foreign_key_constraint(:user_id)
  end

  def update_read_changeset(participant, attrs) do
    participant
    |> cast(attrs, [:last_read_at])
  end

  def toggle_mute_changeset(participant, attrs) do
    participant
    |> cast(attrs, [:muted])
  end

  def leave_changeset(participant, attrs) do
    participant
    |> cast(attrs, [:left_at])
  end
end
