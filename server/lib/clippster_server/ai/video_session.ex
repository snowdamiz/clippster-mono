defmodule ClippsterServer.AI.VideoSession do
  @moduledoc """
  One AI video project: the user's clips, the optional example video, what the AI learned from
  them, and the current edit (document + generated composition files). What the user wants lives
  in the planning chat and each run's request.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @statuses ~w(draft working ready)
  @aspect_ratios ~w(16:9 9:16 1:1 4:5)

  schema "ai_chat_sessions" do
    field :name, :string
    field :status, :string, default: "draft"
    # Output shape when there is no example; with one, the example's shape is used.
    field :aspect_ratio, :string
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
      :aspect_ratio,
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
    |> validate_inclusion(:aspect_ratio, @aspect_ratios)
    |> validate_length(:name, max: 120)
    |> foreign_key_constraint(:user_id)
  end
end
