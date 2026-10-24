defmodule ClippsterServer.AI.VideoSessions do
  @moduledoc """
  AI video projects and their visible chat history.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.AI.{ChatMessage, VideoSession}

  def create_session(user_id, attrs \\ %{}) do
    %VideoSession{}
    |> VideoSession.changeset(Map.merge(attrs, %{user_id: user_id, status: "draft"}))
    |> Repo.insert()
  end

  def get_session!(id), do: Repo.get!(VideoSession, id)

  def get_user_session(session_id, user_id) do
    VideoSession
    |> where([s], s.id == ^session_id and s.user_id == ^user_id)
    |> Repo.one()
  end

  def with_messages(%VideoSession{} = session) do
    Repo.preload(session, [messages: from(m in ChatMessage, order_by: [asc: m.inserted_at, asc: m.id])],
      force: true
    )
  end

  def list_user_sessions(user_id, opts \\ []) do
    VideoSession
    |> where([s], s.user_id == ^user_id)
    |> order_by([s], desc: s.updated_at)
    |> limit(^Keyword.get(opts, :limit, 20))
    |> Repo.all()
  end

  def delete_session(session), do: Repo.delete(session)

  def update_session(session, attrs) do
    session
    |> VideoSession.changeset(attrs)
    |> Repo.update()
  end

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

  # Labelling requests run in parallel, so keyed merges happen atomically in SQL.

  @doc "Merge labels for one source (keyed by content hash and chunk) into the source index."
  def put_source_labels(%VideoSession{id: id}, content_hash, chunk_key, entry) do
    {1, _} =
      VideoSession
      |> where([s], s.id == ^id)
      |> update([s],
        set: [
          source_index:
            fragment(
              "jsonb_set(COALESCE(?, '{}'::jsonb), ARRAY[?::text], COALESCE(?, '{}'::jsonb)->? || jsonb_build_object(?::text, ?::jsonb), true)",
              s.source_index,
              ^content_hash,
              s.source_index,
              ^content_hash,
              ^chunk_key,
              ^entry
            ),
          updated_at: ^DateTime.utc_now(:second)
        ]
      )
      |> Repo.update_all([])

    :ok
  end

  @doc "Store one labelled chunk of the example while it is being analysed."
  def put_reference_labels(%VideoSession{id: id}, chunk_index, labels) do
    {1, _} =
      VideoSession
      |> where([s], s.id == ^id)
      |> update([s],
        set: [
          reference_labels:
            fragment(
              "COALESCE(?, '{}'::jsonb) || jsonb_build_object(?::text, ?::jsonb)",
              s.reference_labels,
              ^to_string(chunk_index),
              ^labels
            )
        ]
      )
      |> Repo.update_all([])

    :ok
  end
end
