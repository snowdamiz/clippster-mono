defmodule ClippsterServer.AI.ThumbnailSessions do
  @moduledoc """
  Context for AI Thumbnail Generator sessions and messages.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.AI.{ThumbnailSession, ThumbnailMessage}

  # ---------------------------------------------------------------------------
  # Sessions
  # ---------------------------------------------------------------------------

  def create_session(user_id, attrs \\ %{}) do
    defaults = %{
      user_id: user_id,
      status: "discovery",
      generation_mode: Map.get(attrs, :generation_mode) || Map.get(attrs, "generation_mode") || "editable"
    }

    %ThumbnailSession{}
    |> ThumbnailSession.changeset(Map.merge(defaults, attrs))
    |> Repo.insert()
  end

  def get_session(id), do: Repo.get(ThumbnailSession, id)

  def get_session_with_messages(id) do
    case Repo.get(ThumbnailSession, id) do
      nil ->
        nil

      session ->
        Repo.preload(session,
          messages: from(m in ThumbnailMessage, order_by: [asc: m.inserted_at])
        )
    end
  end

  def get_user_session(session_id, user_id) do
    ThumbnailSession
    |> where([s], s.id == ^session_id and s.user_id == ^user_id)
    |> Repo.one()
  end

  def list_user_sessions(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    ThumbnailSession
    |> where([s], s.user_id == ^user_id)
    |> order_by([s], desc: s.updated_at)
    |> limit(^limit)
    |> Repo.all()
  end

  def delete_session(session), do: Repo.delete(session)

  @doc """
  Deletes a thumbnail session and best-effort cleans R2 objects under
  ai-thumbnails/{user_id}/{session_id}/.
  """
  def delete_session_with_assets(session) do
    prefix = "ai-thumbnails/#{session.user_id}/#{session.id}/"

    case Repo.delete(session) do
      {:ok, deleted} ->
        Task.start(fn ->
          ClippsterServer.Storage.delete_prefix(prefix)
        end)

        {:ok, deleted}

      error ->
        error
    end
  end

  def update_session(session, attrs) do
    session
    |> ThumbnailSession.changeset(attrs)
    |> Repo.update()
  end

  def update_session_status(session, status) do
    session
    |> ThumbnailSession.update_status_changeset(status)
    |> Repo.update()
  end

  def save_generation(session, attrs) when is_map(attrs) do
    thumb =
      Map.get(attrs, :thumbnail_url) ||
        Map.get(attrs, "thumbnail_url") ||
        Map.get(attrs, :plate_url) ||
        Map.get(attrs, "plate_url") ||
        first_candidate_url(Map.get(attrs, :candidates) || Map.get(attrs, "candidates"))

    attrs =
      attrs
      |> Map.put(:status, Map.get(attrs, :status) || Map.get(attrs, "status") || "generated")
      |> then(fn a -> if thumb, do: Map.put(a, :thumbnail_url, thumb), else: a end)

    session
    |> ThumbnailSession.changeset(attrs)
    |> Repo.update()
  end

  defp first_candidate_url(candidates) when is_list(candidates) do
    candidates
    |> List.first()
    |> case do
      %{"url" => url} when is_binary(url) -> url
      %{url: url} when is_binary(url) -> url
      _ -> nil
    end
  end

  defp first_candidate_url(_), do: nil

  def start_refinement(session) do
    session
    |> ThumbnailSession.increment_refinement_changeset()
    |> Repo.update()
  end

  def increment_refinement_messages(session) do
    session
    |> ThumbnailSession.increment_messages_changeset()
    |> Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Messages
  # ---------------------------------------------------------------------------

  def create_message(session_id, role, content, metadata \\ nil) do
    %ThumbnailMessage{}
    |> ThumbnailMessage.changeset(%{
      session_id: session_id,
      role: role,
      content: content,
      metadata: metadata
    })
    |> Repo.insert()
  end

  def list_messages(session_id) do
    ThumbnailMessage
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
