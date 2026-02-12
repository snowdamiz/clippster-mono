defmodule ClippsterServer.AI.ChatSession do
  use Ecto.Schema
  import Ecto.Changeset

  @valid_statuses ~w(discovery generating generated refining completed)

  schema "ai_chat_sessions" do
    field :status, :string, default: "discovery"
    field :media_items, {:array, :map}, default: []
    field :composition, :map
    field :refinement_round, :integer, default: 0
    field :refinement_messages_used, :integer, default: 0
    field :max_refinement_rounds, :integer, default: 3
    field :max_messages_per_round, :integer, default: 6
    field :style_context, :map, default: %{}
    field :reference_analysis, :map
    field :media_analysis, {:array, :map}
    field :reference_url, :string

    belongs_to :user, ClippsterServer.Accounts.User
    has_many :messages, ClippsterServer.AI.ChatMessage, foreign_key: :session_id

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :status, :media_items, :composition, :refinement_round,
      :refinement_messages_used, :max_refinement_rounds, :max_messages_per_round,
      :style_context, :reference_analysis, :media_analysis, :reference_url, :user_id
    ])
    |> validate_required([:user_id, :status])
    |> validate_inclusion(:status, @valid_statuses)
    |> foreign_key_constraint(:user_id)
  end

  def update_status_changeset(session, status) do
    session
    |> change(%{status: status})
    |> validate_inclusion(:status, @valid_statuses)
  end

  def increment_refinement_changeset(session) do
    session
    |> change(%{
      refinement_round: session.refinement_round + 1,
      refinement_messages_used: 0,
      status: "refining"
    })
  end

  def increment_messages_changeset(session) do
    session
    |> change(%{refinement_messages_used: session.refinement_messages_used + 1})
  end

  def can_refine?(%__MODULE__{} = session) do
    session.refinement_round < session.max_refinement_rounds
  end

  def can_send_refinement_message?(%__MODULE__{} = session) do
    session.refinement_messages_used < session.max_messages_per_round
  end
end
