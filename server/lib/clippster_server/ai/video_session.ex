defmodule ClippsterServer.AI.VideoSession do
  @moduledoc """
  One AI video project: the user's clips, the example video, what the AI learned from both,
  and the current edit (document + generated composition files).
  """

  use Ecto.Schema
  import Ecto.Changeset

  @statuses ~w(draft working ready)

  schema "ai_chat_sessions" do
    field :name, :string
    field :status, :string, default: "draft"
    field :request, :string
    field :media_items, {:array, :map}, default: []
    field :reference, :map
    field :reference_blueprint, :map
    # Gemini shot labels collected while the example is analysed; folded into the blueprint.
    field :reference_labels, :map
    # Source labels keyed by content hash so re-runs never re-label the same footage.
    field :source_index, :map, default: %{}
    field :document, :map
    field :composition_files, :map, default: %{}
    field :thumbnail_url, :string

    belongs_to :user, ClippsterServer.Accounts.User
    has_many :messages, ClippsterServer.AI.ChatMessage, foreign_key: :session_id

    timestamps(type: :utc_datetime)
  end

  def statuses, do: @statuses

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :name,
      :status,
      :request,
      :media_items,
      :reference,
      :reference_blueprint,
      :reference_labels,
      :source_index,
      :document,
      :composition_files,
      :thumbnail_url,
      :user_id
    ])
    |> validate_required([:user_id, :status])
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:name, max: 120)
    |> validate_length(:request, max: 2_000)
    |> foreign_key_constraint(:user_id)
  end
end
