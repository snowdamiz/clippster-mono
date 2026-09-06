defmodule ClippsterServerWeb.AIThumbnailController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.{ThumbnailSessions, ThumbnailComposer, ThumbnailSession, ThumbnailPostGen}
  alias ClippsterServer.Credits
  alias ClippsterServerWeb.AIChatController

  require Logger

  plug :require_ai_editor_access

  @generation_credit_cost 8
  @refinement_credit_cost 4
  @variant_credit_cost 2
  @critique_credit_cost 4
  @edit_credit_cost 4
  @optimize_credit_cost 8

  # ---------------------------------------------------------------------------
  # List / CRUD
  # ---------------------------------------------------------------------------

  def list_sessions(conn, _params) do
    user = conn.assigns.current_user
    sessions = ThumbnailSessions.list_user_sessions(user.id, limit: 50)

    json(conn, %{
      sessions:
        Enum.map(sessions, fn s ->
          %{
            id: s.id,
            name: s.name,
            status: s.status,
            generation_mode: s.generation_mode,
            thumbnail_url: s.thumbnail_url,
            updated_at: s.updated_at,
            inserted_at: s.inserted_at
          }
        end)
    })
  end

  def create_session(conn, params) do
    user = conn.assigns.current_user

    attrs = %{
      media_items: Map.get(params, "media_items", []),
      key_frames: Map.get(params, "key_frames", []),
      generation_mode: Map.get(params, "generation_mode", "editable"),
      canvas_width: Map.get(params, "canvas_width", 1280),
      canvas_height: Map.get(params, "canvas_height", 720),
      name: Map.get(params, "name")
    }

    case ThumbnailSessions.create_session(user.id, attrs) do
      {:ok, session} ->
        {:ok, _greeting} =
          ThumbnailSessions.create_message(
            session.id,
            "assistant",
            "Hey! I'll help you design a thumbnail. What video is this for, and what emotion or hook should jump off the feed?",
            %{"ready_to_generate" => false, "summary" => nil}
          )

        session = ThumbnailSessions.get_session_with_messages(session.id)
        json(conn, serialize_session(session))

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to create session", details: inspect(changeset.errors)})
    end
  end

  def get_session(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case ThumbnailSessions.get_user_session(id, user.id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      _session ->
        session = ThumbnailSessions.get_session_with_messages(id)
        json(conn, serialize_session(session))
    end
  end

  def delete_session(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case ThumbnailSessions.get_user_session(id, user.id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      session ->
        case ThumbnailSessions.delete_session_with_assets(session) do
          {:ok, _} -> json(conn, %{ok: true})
          {:error, _} -> conn |> put_status(:internal_server_error) |> json(%{error: "Failed to delete"})
        end
    end
  end

  def rename_session(conn, %{"id" => id, "name" => name}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         {:ok, updated} <- ThumbnailSessions.update_session(session, %{name: name}) do
      json(conn, %{ok: true, name: updated.name})
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
      {:error, _} -> conn |> put_status(:internal_server_error) |> json(%{error: "Failed to rename"})
    end
  end

  # ---------------------------------------------------------------------------
  # Mode / media / reference
  # ---------------------------------------------------------------------------

  def update_mode(conn, %{"id" => id, "generation_mode" => mode}) when mode in ["quick", "editable"] do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id) do
      # Switching after generate: reset generation artifacts but keep brief
      attrs =
        if session.status in ["generated", "refining", "completed"] do
          %{
            generation_mode: mode,
            status: "discovery",
            candidates: [],
            plate_url: nil,
            recipe: nil,
            composition: nil,
            result: nil,
            refinement_round: 0,
            refinement_messages_used: 0
          }
        else
          %{generation_mode: mode}
        end

      {:ok, updated} = ThumbnailSessions.update_session(session, attrs)
      session = ThumbnailSessions.get_session_with_messages(updated.id)
      json(conn, serialize_session(session))
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
    end
  end

  def update_mode(conn, _params) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "generation_mode must be quick or editable"})
  end

  def update_media(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id) do
      attrs =
        %{}
        |> maybe_put(:media_items, Map.get(params, "media_items"))
        |> maybe_put(:key_frames, Map.get(params, "key_frames"))
        |> maybe_put(:canvas_width, Map.get(params, "canvas_width"))
        |> maybe_put(:canvas_height, Map.get(params, "canvas_height"))
        |> maybe_put(:youtube_url, Map.get(params, "youtube_url"))
        |> maybe_put(:video_title, Map.get(params, "video_title"))
        |> maybe_put(:transcript, Map.get(params, "transcript"))
        |> maybe_put(:transcript_source, Map.get(params, "transcript_source"))
        |> maybe_put(:concepts, Map.get(params, "concepts"))
        |> maybe_put(:video_summary, Map.get(params, "video_summary"))
        |> maybe_put(:selected_concept_id, Map.get(params, "selected_concept_id"))

      {:ok, updated} = ThumbnailSessions.update_session(session, attrs)
      session = ThumbnailSessions.get_session_with_messages(updated.id)
      json(conn, serialize_session(session))
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
    end
  end

  def set_reference(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id) do
      url = Map.get(params, "reference_image_url") || Map.get(params, "url")
      meta = Map.get(params, "reference_image_meta") || Map.get(params, "meta") || %{}

      {:ok, updated} =
        ThumbnailSessions.update_session(session, %{
          reference_image_url: url,
          reference_image_meta: meta
        })

      session = ThumbnailSessions.get_session_with_messages(updated.id)
      json(conn, serialize_session(session))
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
    end
  end

  # ---------------------------------------------------------------------------
  # Chat / generate / refine / accept
  # ---------------------------------------------------------------------------

  def send_message(conn, %{"id" => id, "message" => message}) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- validate_discovery_status(session),
         {:ok, _user_msg} <- ThumbnailSessions.create_message(session.id, "user", message),
         {:ok, result} <- ThumbnailComposer.chat(session, message, api_key) do
      session = ThumbnailSessions.get_session_with_messages(session.id)

      json(conn, %{
        session: serialize_session(session),
        response: result.response
      })
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Session is not in discovery phase"})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  def trigger_generation(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- validate_can_generate(session),
         :ok <- check_credits(user.id, @generation_credit_cost) do
      if @generation_credit_cost > 0 do
        {:ok, _} = Credits.deduct_credits(user.id, @generation_credit_cost)
      end

      mode = Map.get(params, "generation_mode") || session.generation_mode || "editable"

      {:ok, session} =
        ThumbnailSessions.update_session(session, %{
          status: "generating",
          generation_mode: mode
        })

      case ThumbnailComposer.generate(session, api_key, %{"generation_mode" => mode}) do
        {:ok, result} ->
          {:ok, _saved} =
            ThumbnailSessions.save_generation(session, %{
              generation_mode: result.generation_mode,
              candidates: result.candidates,
              plate_url: result.plate_url,
              recipe: result.recipe,
              composition: result.composition,
              thumbnail_url: result.thumbnail_url,
              canvas_width: result.canvas_width,
              canvas_height: result.canvas_height,
              status: "generated"
            })

          session = ThumbnailSessions.get_session_with_messages(session.id)
          json(conn, serialize_session(session))

        {:error, reason} ->
          if @generation_credit_cost > 0 do
            Credits.add_credits(user.id, @generation_credit_cost)
          end

          ThumbnailSessions.update_session_status(session, "discovery")

          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: inspect(reason)})
      end
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Session is not ready for generation"})

      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          error: "Insufficient credits",
          required: @generation_credit_cost,
          remaining: remaining
        })

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  def send_refinement(conn, %{"id" => id, "message" => message}) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- validate_can_refine(session),
         true <- ThumbnailSession.can_refine?(session) || {:error, :max_rounds},
         :ok <- check_credits(user.id, @refinement_credit_cost) do
      if @refinement_credit_cost > 0 do
        {:ok, _} = Credits.deduct_credits(user.id, @refinement_credit_cost)
      end

      # Start new round if needed
      {:ok, session} =
        if session.status == "generated" or session.refinement_messages_used == 0 do
          ThumbnailSessions.start_refinement(session)
        else
          {:ok, session}
        end

      {:ok, _user_msg} = ThumbnailSessions.create_message(session.id, "user", message)
      {:ok, session} = ThumbnailSessions.increment_refinement_messages(session)

      case ThumbnailComposer.refine(session, message, api_key) do
        {:ok, %{response: response} = result} ->
          apply_changes = Map.get(response, "apply_changes", false)
          change = Map.get(response, "change_description") || message
          text_only = Map.get(response, "text_only", false)

          if apply_changes do
            case ThumbnailComposer.refine_generation(session, change, api_key, %{
                   "text_only" => text_only
                 }) do
              {:ok, gen} ->
                {:ok, _} =
                  ThumbnailSessions.save_generation(session, %{
                    generation_mode: gen.generation_mode,
                    candidates: gen.candidates,
                    plate_url: gen.plate_url,
                    recipe: gen.recipe,
                    composition: gen.composition,
                    thumbnail_url: gen.thumbnail_url,
                    canvas_width: Map.get(gen, :canvas_width),
                    canvas_height: Map.get(gen, :canvas_height),
                    status: "refining"
                  })

                session = ThumbnailSessions.get_session_with_messages(session.id)

                json(conn, %{
                  session: serialize_session(session),
                  response: %{
                    "message" => Map.get(response, "message") || "Updated.",
                    "apply_changes" => true,
                    "text_only" => text_only
                  }
                })

              {:error, reason} ->
                if @refinement_credit_cost > 0 do
                  Credits.add_credits(user.id, @refinement_credit_cost)
                end

                conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
            end
          else
            session = ThumbnailSessions.get_session_with_messages(session.id)

            json(conn, %{
              session: serialize_session(session),
              response: %{
                "message" => Map.get(response, "message") || Map.get(result, :message),
                "apply_changes" => false
              }
            })
          end

        {:error, reason} ->
          if @refinement_credit_cost > 0 do
            Credits.add_credits(user.id, @refinement_credit_cost)
          end

          conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
      end
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Session cannot accept refinements"})

      {:error, :max_rounds} ->
        conn |> put_status(:conflict) |> json(%{error: "Maximum refinement rounds reached"})

      false ->
        conn |> put_status(:conflict) |> json(%{error: "Maximum refinement rounds reached"})

      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          error: "Insufficient credits",
          required: @refinement_credit_cost,
          remaining: remaining
        })

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  def accept(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- validate_can_accept(session) do
      candidate_index = Map.get(params, "candidate_index", 0)

      payload =
        case session.generation_mode do
          "quick" ->
            candidates = session.candidates || []
            chosen = Enum.at(candidates, candidate_index) || List.first(candidates)

            %{
              mode: "quick",
              image_url: chosen && (chosen["url"] || chosen[:url]),
              canvas_width: session.canvas_width,
              canvas_height: session.canvas_height,
              summary: session.brief_summary
            }

          _ ->
            %{
              mode: "editable",
              plate_url: session.plate_url,
              recipe: session.recipe,
              canvas_width: session.canvas_width,
              canvas_height: session.canvas_height,
              summary: session.brief_summary
            }
        end

      {:ok, _} =
        ThumbnailSessions.update_session(session, %{
          status: "completed",
          result: payload
        })

      session = ThumbnailSessions.get_session_with_messages(session.id)

      json(conn, %{
        session: serialize_session(session),
        accept: payload
      })
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Nothing to accept yet"})
    end
  end

  # ---------------------------------------------------------------------------
  # Analyze / from-video / apply concept
  # ---------------------------------------------------------------------------

  def analyze(conn, %{"id" => id}) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         {:ok, result} <- ThumbnailComposer.analyze_video(session, api_key) do
      session = ThumbnailSessions.get_session_with_messages(result.session.id)

      json(conn, %{
        session: serialize_session(session),
        concepts: result.concepts,
        summary: result.summary
      })
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def apply_concept(conn, %{"id" => id, "concept_id" => concept_id}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         {:ok, updated} <- ThumbnailComposer.apply_concept(session, concept_id) do
      json(conn, serialize_session(updated))
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def generate_from_video(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    variant_count =
      case Map.get(params, "variant_count", 4) do
        n when is_integer(n) and n in [4, 8, 12] -> n
        n when is_binary(n) ->
          case Integer.parse(n) do
            {v, _} when v in [4, 8, 12] -> v
            _ -> 4
          end
        _ -> 4
      end

    cost = variant_count * @variant_credit_cost

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- validate_has_video_context(session),
         :ok <- check_credits(user.id, cost) do
      if cost > 0, do: {:ok, _} = Credits.deduct_credits(user.id, cost)

      {:ok, session} = ThumbnailSessions.update_session(session, %{status: "generating", generation_mode: "quick"})

      case ThumbnailComposer.generate_from_video(session, api_key, params) do
        {:ok, result} ->
          {:ok, _} =
            ThumbnailSessions.save_generation(session, %{
              generation_mode: "quick",
              candidates: result.candidates,
              plate_url: nil,
              recipe: nil,
              composition: result.composition,
              thumbnail_url: result.thumbnail_url,
              canvas_width: result.canvas_width,
              canvas_height: result.canvas_height,
              status: "generated"
            })

          session = ThumbnailSessions.get_session_with_messages(session.id)
          json(conn, serialize_session(session))

        {:error, reason} ->
          if cost > 0, do: Credits.add_credits(user.id, cost)
          ThumbnailSessions.update_session_status(session, "discovery")
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
      {:error, :missing_video_context} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "Attach video keyframes and a transcript first"})
      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{error: "Insufficient credits", required: cost, remaining: remaining})
    end
  end

  def continue_editable(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user
    api_key = get_api_key()
    idx = Map.get(params, "candidate_index", 0)

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- check_credits(user.id, @generation_credit_cost) do
      if @generation_credit_cost > 0, do: {:ok, _} = Credits.deduct_credits(user.id, @generation_credit_cost)

      case ThumbnailComposer.continue_as_editable(session, api_key, idx) do
        {:ok, result} ->
          {:ok, _} =
            ThumbnailSessions.save_generation(session, %{
              generation_mode: "editable",
              candidates: [],
              plate_url: result.plate_url,
              recipe: result.recipe,
              composition: result.composition,
              thumbnail_url: result.thumbnail_url,
              canvas_width: result.canvas_width,
              canvas_height: result.canvas_height,
              status: "generated"
            })

          session = ThumbnailSessions.get_session_with_messages(session.id)
          json(conn, serialize_session(session))

        {:error, reason} ->
          if @generation_credit_cost > 0, do: Credits.add_credits(user.id, @generation_credit_cost)
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          error: "Insufficient credits",
          required: @generation_credit_cost,
          remaining: remaining
        })
    end
  end

  # ---------------------------------------------------------------------------
  # Post-gen tools
  # ---------------------------------------------------------------------------

  def critique(conn, %{"id" => id} = params) do
    run_postgen(conn, id, @critique_credit_cost, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.critique(session, url, api_key, params)
    end)
  end

  def variations(conn, %{"id" => id} = params) do
    count =
      case Map.get(params, "count", 4) do
        n when is_integer(n) -> n
        n when is_binary(n) -> String.to_integer(n)
        _ -> 4
      end
      |> max(1)
      |> min(10)

    cost = count * @variant_credit_cost

    run_postgen(conn, id, cost, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.variations(session, url, count, api_key, params)
    end)
  end

  def optimize(conn, %{"id" => id, "idea" => idea} = params) do
    run_postgen(conn, id, @optimize_credit_cost, fn session, api_key ->
      ThumbnailPostGen.optimize(session, idea, api_key, params)
    end)
  end

  def text_overlay(conn, %{"id" => id} = params) do
    run_postgen(conn, id, 0, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.text_overlay(session, url, api_key, params)
    end)
  end

  def edit(conn, %{"id" => id, "prompt" => prompt} = params) do
    run_postgen(conn, id, @edit_credit_cost, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.edit(session, url, prompt, api_key, params)
    end)
  end

  def face_swap(conn, %{"id" => id} = params) do
    face_url = Map.get(params, "faceImageUrl") || Map.get(params, "face_image_url")

    if is_nil(face_url) or face_url == "" do
      conn |> put_status(:unprocessable_entity) |> json(%{error: "faceImageUrl is required"})
    else
      run_postgen(conn, id, @edit_credit_cost, fn session, api_key ->
        url = working_image_url(session, params)
        ThumbnailPostGen.face_swap(session, url, face_url, api_key)
      end)
    end
  end

  def background_remove(conn, %{"id" => id} = params) do
    run_postgen(conn, id, 0, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.background_remove(session, url, api_key)
    end)
  end

  def background_replace(conn, %{"id" => id} = params) do
    bg = Map.get(params, "backgroundPrompt") || Map.get(params, "background_prompt")

    if is_nil(bg) or bg == "" do
      conn |> put_status(:unprocessable_entity) |> json(%{error: "backgroundPrompt is required"})
    else
      run_postgen(conn, id, @edit_credit_cost, fn session, api_key ->
        url = working_image_url(session, params)
        ThumbnailPostGen.background_replace(session, url, bg, api_key, params)
      end)
    end
  end

  def color_enhance(conn, %{"id" => id} = params) do
    preset = Map.get(params, "preset", "cinematic")

    run_postgen(conn, id, 0, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.color_enhance(session, url, preset, api_key, params)
    end)
  end

  def upscale(conn, %{"id" => id} = params) do
    scale = Map.get(params, "scale", "2x")

    run_postgen(conn, id, 0, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.upscale(session, url, scale, api_key)
    end)
  end

  def filter(conn, %{"id" => id} = params) do
    filter_prompt = Map.get(params, "filterPrompt") || Map.get(params, "filter_prompt") || "cinematic"

    run_postgen(conn, id, 0, fn session, api_key ->
      url = working_image_url(session, params)
      ThumbnailPostGen.filter(session, url, filter_prompt, api_key)
    end)
  end

  def combine(conn, %{"id" => id} = params) do
    url1 = Map.get(params, "imageUrl1") || Map.get(params, "image_url1")
    url2 = Map.get(params, "imageUrl2") || Map.get(params, "image_url2")
    prompt = Map.get(params, "prompt")

    if is_nil(url1) or is_nil(url2) do
      conn |> put_status(:unprocessable_entity) |> json(%{error: "imageUrl1 and imageUrl2 are required"})
    else
      run_postgen(conn, id, @edit_credit_cost, fn session, api_key ->
        ThumbnailPostGen.combine(session, url1, url2, prompt, api_key, params)
      end)
    end
  end

  def transcribe_audio(conn, params) do
    _user = conn.assigns.current_user
    audio = Map.get(params, "audio")

    case audio do
      %Plug.Upload{path: path, filename: filename, content_type: content_type} ->
        do_transcribe_upload(conn, path, filename, content_type || "audio/mpeg")

      %{"path" => path} = upload when is_binary(path) ->
        do_transcribe_upload(
          conn,
          path,
          Map.get(upload, "filename") || "audio.mp3",
          Map.get(upload, "content_type") || "audio/mpeg"
        )

      %{path: path} = upload when is_binary(path) ->
        do_transcribe_upload(
          conn,
          path,
          Map.get(upload, :filename) || "audio.mp3",
          Map.get(upload, :content_type) || "audio/mpeg"
        )

      _ ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "audio file is required"})
    end
  end

  defp do_transcribe_upload(conn, path, filename, content_type) do
    with true <- File.exists?(path),
         {:ok, binary} <- File.read(path),
         {:ok, whisper} <-
           ClippsterServer.AI.WhisperAPI.transcribe_binary(binary, %{
             filename: filename,
             content_type: content_type
           }) do
      text = Map.get(whisper, "text") || Map.get(whisper, :text) || ""

      json(conn, %{
        success: true,
        text: text,
        transcript: whisper
      })
    else
      false ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "Invalid audio upload"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp run_postgen(conn, id, cost, fun) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         :ok <- check_credits(user.id, cost) do
      if cost > 0, do: {:ok, _} = Credits.deduct_credits(user.id, cost)

      case fun.(session, api_key) do
        {:ok, %{session: updated} = result} ->
          session = ThumbnailSessions.get_session_with_messages(updated.id)
          json(conn, Map.merge(%{session: serialize_session(session)}, Map.drop(result, [:session])))

        {:ok, result} when is_map(result) ->
          session = ThumbnailSessions.get_session_with_messages(session.id)
          json(conn, Map.merge(%{session: serialize_session(session)}, result))

        {:error, reason} ->
          if cost > 0, do: Credits.add_credits(user.id, cost)
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "Session not found"})
      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{error: "Insufficient credits", required: cost, remaining: remaining})
    end
  end

  defp working_image_url(session, params) do
    Map.get(params, "imageUrl") ||
      Map.get(params, "image_url") ||
      session.thumbnail_url ||
      session.plate_url ||
      (List.first(session.candidates || []) && (List.first(session.candidates)["url"] || List.first(session.candidates)[:url]))
  end

  defp validate_has_video_context(session) do
    frames_ok = is_list(session.key_frames) and session.key_frames != []
    transcript_ok = is_binary(session.transcript) and String.length(String.trim(session.transcript)) >= 50

    if frames_ok and transcript_ok, do: :ok, else: {:error, :missing_video_context}
  end

  defp require_ai_editor_access(conn, _opts) do
    user = conn.assigns.current_user

    if AIChatController.can_access_ai_editor?(user) do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "AI Thumbnail Generator requires access on a Creator or Pro plan."})
      |> halt()
    end
  end

  defp get_api_key do
    System.get_env("OPENROUTER_API_KEY") || raise "OPENROUTER_API_KEY not set"
  end

  defp validate_discovery_status(%{status: "discovery"}), do: :ok
  defp validate_discovery_status(_), do: {:error, :invalid_status}

  defp validate_can_generate(%{status: status}) when status in ["discovery", "generated"], do: :ok
  defp validate_can_generate(_), do: {:error, :invalid_status}

  defp validate_can_refine(%{status: status}) when status in ["generated", "refining"], do: :ok
  defp validate_can_refine(_), do: {:error, :invalid_status}

  defp validate_can_accept(%{status: status}) when status in ["generated", "refining"], do: :ok
  defp validate_can_accept(_), do: {:error, :invalid_status}

  defp check_credits(_user_id, 0), do: :ok

  defp check_credits(user_id, needed) do
    case Credits.get_user_balance(user_id) do
      {:ok, %{hours_remaining: remaining}} ->
        if Decimal.compare(remaining, Decimal.new(to_string(needed))) != :lt do
          :ok
        else
          {:error, :insufficient_credits, Decimal.to_float(remaining)}
        end

      _ ->
        {:error, :insufficient_credits, 0}
    end
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp serialize_session(session) do
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
      generation_mode: session.generation_mode,
      media_items: session.media_items,
      key_frames: session.key_frames,
      reference_image_url: session.reference_image_url,
      reference_image_meta: session.reference_image_meta,
      brief_summary: session.brief_summary,
      candidates: session.candidates,
      plate_url: session.plate_url,
      recipe: session.recipe,
      composition: session.composition,
      result: session.result,
      thumbnail_url: session.thumbnail_url,
      refinement_round: session.refinement_round,
      refinement_messages_used: session.refinement_messages_used,
      max_refinement_rounds: session.max_refinement_rounds,
      max_messages_per_round: session.max_messages_per_round,
      canvas_width: session.canvas_width,
      canvas_height: session.canvas_height,
      youtube_url: session.youtube_url,
      video_title: session.video_title,
      transcript: session.transcript,
      transcript_source: session.transcript_source,
      concepts: session.concepts || [],
      video_summary: session.video_summary,
      selected_concept_id: session.selected_concept_id,
      messages: messages,
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end
end
