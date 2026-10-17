defmodule ClippsterServer.AI.ThumbnailSessions do
  @moduledoc """
  Context for AI Thumbnail Generator sessions and messages.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Storage
  alias ClippsterServer.AI.{ThumbnailSession, ThumbnailMessage}

  # ---------------------------------------------------------------------------
  # Sessions
  # ---------------------------------------------------------------------------

  def create_session(user_id, attrs \\ %{}) do
    defaults = %{
      user_id: user_id,
      status: "discovery",
      creator_mode:
        Map.get(attrs, :creator_mode) || Map.get(attrs, "creator_mode") || "thumbnail",
      generation_mode:
        Map.get(attrs, :generation_mode) || Map.get(attrs, "generation_mode") || "editable"
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

  def get_user_session(session_id, user_id, creator_mode) do
    ThumbnailSession
    |> where(
      [s],
      s.id == ^session_id and s.user_id == ^user_id and s.creator_mode == ^creator_mode
    )
    |> Repo.one()
  end

  def list_user_sessions(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    creator_mode = Keyword.get(opts, :creator_mode)

    ThumbnailSession
    |> where([s], s.user_id == ^user_id)
    |> maybe_filter_creator_mode(creator_mode)
    |> order_by([s], desc: s.updated_at)
    |> limit(^limit)
    |> Repo.all()
  end

  def delete_session(session), do: Repo.delete(session)

  @doc """
  Deletes an image-creator session and best-effort cleans its R2 objects.
  """
  def delete_session_with_assets(session) do
    storage_namespace = if session.creator_mode == "image", do: "ai-images", else: "ai-thumbnails"
    prefix = "#{storage_namespace}/#{session.user_id}/#{session.id}/"

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

  def claim_generation(session, attrs \\ %{}) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    generation_mode = Map.get(attrs, :generation_mode) || Map.get(attrs, "generation_mode")

    updates = [status: "generating", updated_at: now]

    updates =
      if generation_mode, do: [{:generation_mode, generation_mode} | updates], else: updates

    query =
      from(s in ThumbnailSession,
        where:
          s.id == ^session.id and s.user_id == ^session.user_id and
            s.creator_mode == ^session.creator_mode and s.status == "discovery"
      )

    case Repo.update_all(query, set: updates) do
      {1, _rows} -> {:ok, get_session(session.id)}
      {0, _rows} -> {:error, :generation_already_claimed}
    end
  end

  @doc """
  Claim an in-progress revision edit on an already-generated image session.
  """
  def claim_revision(session) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    query =
      from(s in ThumbnailSession,
        where:
          s.id == ^session.id and s.user_id == ^session.user_id and
            s.creator_mode == ^session.creator_mode and
            s.status in ["generated", "refining"]
      )

    case Repo.update_all(query, set: [status: "generating", updated_at: now]) do
      {1, _rows} -> {:ok, get_session(session.id)}
      {0, _rows} -> {:error, :revision_already_claimed}
    end
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

  defp maybe_filter_creator_mode(query, nil), do: query

  defp maybe_filter_creator_mode(query, creator_mode) do
    where(query, [s], s.creator_mode == ^creator_mode)
  end

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

  def delete_message(%ThumbnailMessage{} = message), do: Repo.delete(message)

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

  def serialize_session(session) do
    messages =
      if Ecto.assoc_loaded?(session.messages) do
        Enum.map(session.messages, fn msg ->
          %{
            id: msg.id,
            role: msg.role,
            content: msg.content,
            metadata: msg.metadata,
            inserted_at: msg.inserted_at
          }
        end)
      else
        []
      end

    %{
      id: session.id,
      name: session.name,
      status: session.status,
      creator_mode: session.creator_mode,
      generation_mode: session.generation_mode,
      media_items: sign_media_items(session.media_items),
      key_frames: session.key_frames,
      reference_image_url: Storage.browser_accessible_url(session.reference_image_url),
      reference_image_meta: session.reference_image_meta,
      brief_summary: session.brief_summary,
      candidates: sign_candidates(session.candidates),
      plate_url: Storage.browser_accessible_url(session.plate_url),
      recipe: session.recipe,
      composition: sign_composition(session.composition),
      result: session.result,
      thumbnail_url: Storage.browser_accessible_url(session.thumbnail_url),
      refinement_round: session.refinement_round,
      refinement_messages_used: session.refinement_messages_used,
      max_refinement_rounds: session.max_refinement_rounds,
      max_messages_per_round: session.max_messages_per_round,
      canvas_width: session.canvas_width,
      canvas_height: session.canvas_height,
      youtube_url: session.youtube_url,
      video_title: session.video_title,
      transcript: session.transcript,
      transcript_backed: session.transcript_backed,
      transcript_source: session.transcript_source,
      concepts: session.concepts || [],
      video_summary: session.video_summary,
      selected_concept_id: session.selected_concept_id,
      messages: messages,
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end

  defp sign_candidates(candidates) when is_list(candidates) do
    Enum.map(candidates, fn
      %{"url" => url} = candidate when is_binary(url) ->
        Map.put(candidate, "url", Storage.browser_accessible_url(url))

      other ->
        other
    end)
  end

  defp sign_candidates(other), do: other

  defp sign_media_items(items) when is_list(items) do
    Enum.map(items, fn
      %{"url" => url} = item when is_binary(url) ->
        Map.put(item, "url", Storage.browser_accessible_url(url))

      other ->
        other
    end)
  end

  defp sign_media_items(other), do: other

  defp sign_composition(%{"plate_url" => url} = composition) when is_binary(url) do
    Map.put(composition, "plate_url", Storage.browser_accessible_url(url))
  end

  defp sign_composition(other), do: other
end
