defmodule ClippsterServerWeb.AIThumbnailController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.{ThumbnailSessions, ThumbnailComposer, ThumbnailSession}
  alias ClippsterServer.Credits
  alias ClippsterServerWeb.AIChatController

  require Logger

  plug :require_ai_editor_access

  @generation_credit_cost 8
  @refinement_credit_cost 4

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
        case ThumbnailSessions.delete_session(session) do
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
  # Helpers
  # ---------------------------------------------------------------------------

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
      messages: messages,
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end
end
