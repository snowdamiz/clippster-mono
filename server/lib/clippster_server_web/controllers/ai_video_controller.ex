defmodule ClippsterServerWeb.AIVideoController do
  @moduledoc """
  AI video editor API: projects, example analysis, and the paid agent runs that the desktop
  client drives turn by turn.
  """

  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.AI.{
    EditorAccess,
    VideoAgent,
    VideoBlueprint,
    VideoGenerationPolicy,
    VideoLabeler,
    VideoRun,
    VideoRuns,
    VideoSessions
  }

  plug :require_video_editor_access

  @media_item_keys ~w(id name kind path duration width height hasAudio contentHash)
  @media_kinds ~w(video photo audio)
  @max_media_items 60
  @max_document_bytes 1_000_000
  @max_composition_bytes 2_000_000
  @composition_path ~r/\Acompositions\/[A-Za-z0-9_-]{1,64}\.html\z/
  @reference_keys ~w(path displayName sourceUrl sourceType duration width height fps)

  # -- Projects ----------------------------------------------------------------

  def policy(conn, _params) do
    json(conn, %{
      credits: %{
        generate: VideoGenerationPolicy.credit_cost("generate"),
        revise: VideoGenerationPolicy.credit_cost("revise"),
        reference: VideoGenerationPolicy.credit_cost("reference")
      },
      max_output_seconds: VideoGenerationPolicy.max_output_seconds(),
      max_label_calls: VideoGenerationPolicy.max_label_calls(),
      max_reference_chunks: VideoGenerationPolicy.max_reference_chunks()
    })
  end

  def index(conn, _params) do
    sessions = VideoSessions.list_user_sessions(user_id(conn), limit: 30)

    json(conn, %{
      sessions:
        Enum.map(sessions, fn session ->
          Map.take(session, [:id, :name, :status, :thumbnail_url, :inserted_at, :updated_at])
        end)
    })
  end

  def create(conn, params) do
    with {:ok, attrs} <- session_attrs(params),
         {:ok, session} <- VideoSessions.create_session(user_id(conn), attrs) do
      json(conn, serialize_session(VideoSessions.with_messages(session)))
    else
      error -> render_error(conn, error)
    end
  end

  def show(conn, %{"id" => id}) do
    with {:ok, session} <- fetch_video_session(conn, id) do
      VideoRuns.expire_stale_runs(session.id)
      session = reset_status_if_idle(session)
      json(conn, serialize_session(VideoSessions.with_messages(session)))
    end
    |> respond(conn)
  end

  def update(conn, %{"id" => id} = params) do
    with {:ok, session} <- fetch_video_session(conn, id),
         {:ok, attrs} <- session_attrs(params),
         :ok <- ensure_no_run_for_edit(session, attrs),
         {:ok, session} <- VideoSessions.update_session(session, attrs) do
      json(conn, serialize_session(VideoSessions.with_messages(session)))
    end
    |> respond(conn)
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, session} <- fetch_video_session(conn, id),
         {:ok, _} <- VideoSessions.delete_session(session) do
      json(conn, %{ok: true})
    end
    |> respond(conn)
  end

  # -- Example analysis ----------------------------------------------------------

  def start_reference(conn, %{"id" => id}) do
    with {:ok, session} <- fetch_video_session(conn, id),
         {:ok, run} <- VideoRuns.start_reference_run(user_id(conn), session),
         {:ok, _} <- VideoSessions.update_session(session, %{reference_labels: %{}, reference_blueprint: nil}) do
      json(conn, %{run_id: run.id})
    end
    |> respond(conn)
  end

  def reference_chunk(conn, %{"id" => id, "run_id" => run_id, "chunk_index" => chunk_index, "video" => video, "shots" => shots})
      when is_integer(chunk_index) and is_list(shots) do
    with {:ok, session} <- fetch_video_session(conn, id),
         {:ok, run} <- fetch_run(conn, run_id, "reference", session.id),
         :ok <- VideoRuns.reserve_label_call(run, VideoGenerationPolicy.max_reference_chunks()),
         {:ok, labels} <- VideoLabeler.label_reference_chunk(run, video, shots) do
      :ok = VideoSessions.put_reference_labels(session, chunk_index, labels)
      json(conn, %{labels: labels})
    end
    |> respond(conn)
  end

  def reference_chunk(conn, _params), do: render_error(conn, {:error, "Missing chunk fields."})

  def finish_reference(conn, %{"id" => id, "run_id" => run_id, "measurement" => %{"shots" => [_ | _]} = measurement} = params) do
    with {:ok, session} <- fetch_video_session(conn, id),
         {:ok, run} <- fetch_run(conn, run_id, "reference", session.id) do
      blueprint = VideoBlueprint.build(measurement, session.reference_labels, params["beats"])

      with {:ok, summary} <- VideoLabeler.summarize_reference(run, blueprint),
           blueprint = Map.merge(blueprint, summary),
           {:ok, _} <- VideoRuns.charge_reference_run(run),
           {:ok, session} <- VideoSessions.update_session(session, %{reference_blueprint: blueprint}) do
        json(conn, %{blueprint: session.reference_blueprint})
      else
        error ->
          VideoRuns.fail(run, inspect(error))
          error
      end
    end
    |> respond(conn)
  end

  def finish_reference(conn, _params), do: render_error(conn, {:error, "The example measurement has no shots."})

  # -- Agent runs ------------------------------------------------------------------

  def start_run(conn, %{"id" => id, "kind" => kind, "request" => request})
      when kind in ~w(generate revise) and is_binary(request) do
    request = String.trim(request)

    with {:ok, session} <- fetch_video_session(conn, id),
         :ok <- ensure_can_run(session, kind),
         {:ok, run} <- VideoRuns.start_agent_run(user_id(conn), session, kind, request) do
      {:ok, _} = VideoSessions.create_message(session.id, "user", request, %{"run_id" => run.id})
      {:ok, _} = VideoSessions.update_session(session, %{status: "working"})
      json(conn, %{run: serialize_run(run)})
    end
    |> respond(conn)
  end

  def start_run(conn, _params), do: render_error(conn, {:error, "Choose generate or revise and include a request."})

  def label_source(
        conn,
        %{"run_id" => run_id, "content_hash" => hash, "chunk_key" => chunk_key, "chunk_start" => chunk_start, "kind" => kind, "media" => media, "segments" => segments}
      )
      when is_binary(hash) and is_binary(chunk_key) and is_number(chunk_start) and is_list(segments) do
    with {:ok, run} <- fetch_agent_run(conn, run_id),
         {:ok, session} <- fetch_video_session(conn, run.session_id),
         :ok <- VideoRuns.reserve_label_call(run, VideoGenerationPolicy.max_label_calls()),
         {:ok, labelled} <- VideoLabeler.label_source(run, kind, media, segments, chunk_start) do
      :ok = VideoSessions.put_source_labels(session, hash, chunk_key, %{"segments" => labelled})
      json(conn, %{segments: labelled})
    end
    |> respond(conn)
  end

  def label_source(conn, _params), do: render_error(conn, {:error, "Missing source label fields."})

  def turn(conn, %{"run_id" => run_id} = params) do
    with {:ok, run} <- fetch_agent_run(conn, run_id),
         {:ok, session} <- fetch_video_session(conn, run.session_id) do
      session = VideoSessions.with_messages(session)
      input = %{brief: params["brief"], results: params["results"]}

      case VideoAgent.turn(run, session, input) do
        {:tools, calls, text, _run} -> json(conn, %{type: "tools", calls: calls, text: text})
        {:finish, message, _run} -> json(conn, %{type: "finish", message: message})
        {:limit, _run} -> json(conn, %{type: "limit"})
        {:error, :invalid, reason} -> {:error, reason}
        {:error, reason} -> {:error, :bad_gateway, reason}
      end
    end
    |> respond(conn)
  end

  def complete_run(conn, %{"run_id" => run_id, "document" => document, "composition_files" => files}) do
    with {:ok, run} <- fetch_agent_run(conn, run_id),
         {:ok, session} <- fetch_video_session(conn, run.session_id),
         {:ok, attrs} <- session_attrs(%{"document" => document, "composition_files" => files}) do
      unchanged? = attrs.document == session.document and attrs.composition_files == session.composition_files
      refund? = run.kind == "revise" and unchanged?
      message = (run.finish || %{})["message"] || default_finish_message(run.kind, refund?)

      {:ok, session} = VideoSessions.update_session(session, Map.put(attrs, :status, "ready"))
      {:ok, _} = VideoSessions.create_message(session.id, "assistant", message, %{"run_id" => run.id, "refunded" => refund?})
      {:ok, run} = VideoRuns.complete(run, refund?)

      json(conn, %{run: serialize_run(run), session: serialize_session(VideoSessions.with_messages(session))})
    end
    |> respond(conn)
  end

  def complete_run(conn, _params), do: render_error(conn, {:error, "The finished edit is missing."})

  def fail_run(conn, %{"run_id" => run_id} = params) do
    with {:ok, run} <- fetch_user_run(conn, run_id) do
      reason = params["reason"] |> to_string() |> String.slice(0, 500)
      {:ok, run} = VideoRuns.fail(run, if(reason == "", do: "Cancelled", else: reason))

      if run.session_id && run.kind != "reference" do
        run.session_id |> VideoSessions.get_session!() |> reset_status_if_idle()
      end

      json(conn, %{run: serialize_run(run)})
    end
    |> respond(conn)
  end

  # -- Helpers ---------------------------------------------------------------------

  defp require_video_editor_access(conn, _opts) do
    if EditorAccess.can_access_video_editor?(conn.assigns.current_user) do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "AI Video requires access on a Creator or Pro plan."})
      |> halt()
    end
  end

  defp user_id(conn), do: conn.assigns.current_user.id

  defp fetch_video_session(conn, id) do
    case VideoSessions.get_user_session(id, user_id(conn)) do
      nil -> {:error, :not_found}
      session -> {:ok, session}
    end
  end

  defp fetch_user_run(conn, run_id) do
    case VideoRuns.get_user_run(run_id, user_id(conn)) do
      nil -> {:error, :not_found}
      run -> {:ok, run}
    end
  end

  defp fetch_run(conn, run_id, kind, session_id) do
    case fetch_user_run(conn, run_id) do
      {:ok, %VideoRun{kind: ^kind, session_id: ^session_id, status: "running"} = run} -> {:ok, run}
      {:ok, %VideoRun{status: "running"}} -> {:error, :not_found}
      {:ok, %VideoRun{error: error}} -> {:error, :conflict, error || "This run has already ended."}
      error -> error
    end
  end

  defp fetch_agent_run(conn, run_id) do
    case fetch_user_run(conn, run_id) do
      {:ok, %VideoRun{kind: kind, status: "running"} = run} when kind in ~w(generate revise) -> {:ok, run}
      {:ok, %VideoRun{kind: "reference"}} -> {:error, :not_found}
      {:ok, %VideoRun{error: error}} -> {:error, :conflict, error || "This run has already ended."}
      error -> error
    end
  end

  defp ensure_can_run(session, "generate") do
    cond do
      is_nil(session.reference_blueprint) -> {:error, "Add an example video first."}
      not Enum.any?(session.media_items || [], &(&1["kind"] in ~w(video photo))) -> {:error, "Add at least one clip or photo first."}
      true -> :ok
    end
  end

  defp ensure_can_run(session, "revise") do
    if is_map(session.document), do: :ok, else: {:error, "There's no video to change yet. Press Go first."}
  end

  defp ensure_no_run_for_edit(session, attrs) do
    editing? = Map.has_key?(attrs, :document) or Map.has_key?(attrs, :composition_files) or Map.has_key?(attrs, :media_items)

    if editing? and VideoRuns.running_agent_run(session.id),
      do: {:error, :conflict, "Wait for the AI to finish before editing."},
      else: :ok
  end

  defp reset_status_if_idle(%{status: "working"} = session) do
    if VideoRuns.running_agent_run(session.id) do
      session
    else
      {:ok, session} = VideoSessions.update_session(session, %{status: if(session.document, do: "ready", else: "draft")})
      session
    end
  end

  defp reset_status_if_idle(session), do: session

  defp session_attrs(params) do
    Enum.reduce_while(~w(name request media_items reference document composition_files), {:ok, %{}}, fn key, {:ok, acc} ->
      if Map.has_key?(params, key) do
        case cast_attr(key, params[key]) do
          {:ok, value} -> {:cont, {:ok, Map.put(acc, String.to_existing_atom(key), value)}}
          {:error, _} = error -> {:halt, error}
        end
      else
        {:cont, {:ok, acc}}
      end
    end)
  end

  defp cast_attr(key, value) when key in ~w(name request) and (is_binary(value) or is_nil(value)), do: {:ok, value}

  defp cast_attr("media_items", items) when is_list(items) and length(items) <= @max_media_items do
    if Enum.all?(items, &(is_map(&1) and is_binary(&1["id"]) and &1["kind"] in @media_kinds)),
      do: {:ok, Enum.map(items, &Map.take(&1, @media_item_keys))},
      else: {:error, "Each media item needs an id and a kind (video, photo or audio)."}
  end

  defp cast_attr("reference", reference) when is_map(reference), do: {:ok, Map.take(reference, @reference_keys)}
  defp cast_attr("reference", nil), do: {:ok, nil}

  defp cast_attr("document", document) when is_map(document) do
    if byte_size(Jason.encode!(document)) <= @max_document_bytes, do: {:ok, document}, else: {:error, "The edit is too large."}
  end

  defp cast_attr("composition_files", files) when is_map(files) do
    valid? = Enum.all?(files, fn {path, content} -> is_binary(content) and Regex.match?(@composition_path, path) end)
    size = files |> Map.values() |> Enum.map(&byte_size(to_string(&1))) |> Enum.sum()

    cond do
      not valid? -> {:error, "Composition files must be compositions/<name>.html."}
      size > @max_composition_bytes -> {:error, "The composition files are too large."}
      true -> {:ok, files}
    end
  end

  defp cast_attr(key, _value), do: {:error, "Invalid #{key}."}

  defp default_finish_message("revise", true), do: "I couldn't make that change, so you weren't charged. Try describing it another way."
  defp default_finish_message(_kind, _refunded), do: "Here's your video. Tell me anything you'd like changed."

  defp serialize_session(session) do
    running = VideoRuns.running_agent_run(session.id)

    %{
      id: session.id,
      name: session.name,
      status: session.status,
      request: session.request,
      media_items: session.media_items,
      reference: session.reference,
      reference_blueprint: session.reference_blueprint,
      source_index: session.source_index,
      document: session.document,
      composition_files: session.composition_files,
      thumbnail_url: session.thumbnail_url,
      running_run: running && serialize_run(running),
      messages:
        if(Ecto.assoc_loaded?(session.messages),
          do: Enum.map(session.messages, &Map.take(&1, [:id, :role, :content, :metadata, :inserted_at])),
          else: []
        ),
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end

  defp serialize_run(run) do
    Map.take(run, [:id, :kind, :status, :credits_charged, :refunded, :turns, :label_calls, :error])
  end

  defp respond({:error, _} = error, conn), do: render_error(conn, error)
  defp respond({:error, _, _} = error, conn), do: render_error(conn, error)
  defp respond(%Plug.Conn{} = conn, _conn), do: conn

  defp render_error(conn, {:error, :not_found}), do: conn |> put_status(:not_found) |> json(%{error: "Not found"})

  defp render_error(conn, {:error, :insufficient_credits, balance}),
    do: conn |> put_status(:payment_required) |> json(%{error: "Not enough credits", remaining: balance})

  defp render_error(conn, {:error, :run_in_progress}),
    do: conn |> put_status(:conflict) |> json(%{error: "The AI is already working on this video."})

  defp render_error(conn, {:error, :label_limit}),
    do: conn |> put_status(:too_many_requests) |> json(%{error: "This run has used all of its analysis calls."})

  defp render_error(conn, {:error, :conflict, message}), do: conn |> put_status(:conflict) |> json(%{error: message})

  defp render_error(conn, {:error, :bad_gateway, message}) do
    Logger.warning("[AIVideo] agent turn failed: #{message}")
    conn |> put_status(:bad_gateway) |> json(%{error: "The AI service had a problem. Try again in a moment."})
  end

  defp render_error(conn, {:error, %Ecto.Changeset{} = changeset}) do
    errors = Ecto.Changeset.traverse_errors(changeset, fn {message, _} -> message end)
    conn |> put_status(:unprocessable_entity) |> json(%{error: "Invalid data", details: errors})
  end

  defp render_error(conn, {:error, message}) when is_binary(message),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: message})

  defp render_error(conn, error) do
    Logger.error("[AIVideo] unexpected error: #{inspect(error)}")
    conn |> put_status(:internal_server_error) |> json(%{error: "Something went wrong."})
  end
end
