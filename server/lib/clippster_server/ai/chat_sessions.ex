defmodule ClippsterServer.AI.ChatSessions do
  @moduledoc """
  Context for managing AI chat sessions and messages.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.AI.{ChatSession, ChatMessage}

  # ---------------------------------------------------------------------------
  # Sessions
  # ---------------------------------------------------------------------------

  def create_session(user_id, attrs \\ %{}) do
    %ChatSession{}
    |> ChatSession.changeset(Map.merge(%{user_id: user_id, status: "discovery"}, attrs))
    |> Repo.insert()
  end

  def get_session(id) do
    Repo.get(ChatSession, id)
  end

  def get_session!(id) do
    Repo.get!(ChatSession, id)
  end

  def get_session_with_messages(id) do
    case Repo.get(ChatSession, id) do
      nil -> nil
      session -> Repo.preload(session, messages: from(m in ChatMessage, order_by: [asc: m.inserted_at]))
    end
  end

  def get_user_session(session_id, user_id) do
    ChatSession
    |> where([s], s.id == ^session_id and s.user_id == ^user_id)
    |> Repo.one()
  end

  def list_user_sessions(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    ChatSession
    |> where([s], s.user_id == ^user_id)
    |> order_by([s], desc: s.updated_at)
    |> limit(^limit)
    |> Repo.all()
  end

  def update_session(session, attrs) do
    session
    |> ChatSession.changeset(attrs)
    |> Repo.update()
  end

  def update_session_status(session, status) do
    session
    |> ChatSession.update_status_changeset(status)
    |> Repo.update()
  end

  def save_composition(session, composition) do
    session
    |> ChatSession.changeset(%{composition: composition, status: "generated"})
    |> Repo.update()
  end

  def save_reference_analysis(session, analysis, url \\ nil) do
    attrs = %{reference_analysis: analysis}
    attrs = if url, do: Map.put(attrs, :reference_url, url), else: attrs

    session
    |> ChatSession.changeset(attrs)
    |> Repo.update()
  end

  def save_media_analysis(session, analysis) do
    session
    |> ChatSession.changeset(%{media_analysis: analysis})
    |> Repo.update()
  end

  def start_refinement(session) do
    session
    |> ChatSession.increment_refinement_changeset()
    |> Repo.update()
  end

  def increment_refinement_messages(session) do
    session
    |> ChatSession.increment_messages_changeset()
    |> Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Messages
  # ---------------------------------------------------------------------------

  def create_message(session_id, role, content, metadata \\ nil) do
    %ChatMessage{}
    |> ChatMessage.changeset(%{
      session_id: session_id,
      role: role,
      content: content,
      metadata: metadata
    })
    |> Repo.insert()
  end

  def list_messages(session_id) do
    ChatMessage
    |> where([m], m.session_id == ^session_id)
    |> order_by([m], asc: m.inserted_at)
    |> Repo.all()
  end

  def build_conversation_history(session_id) do
    list_messages(session_id)
    |> Enum.map(fn msg ->
      %{"role" => msg.role, "content" => msg.content}
    end)
  end
end
