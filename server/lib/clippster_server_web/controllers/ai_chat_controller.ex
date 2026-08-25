defmodule ClippsterServerWeb.AIChatController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.{ChatSessions, ChatComposer, VideoComposer, ReferenceAnalyzer}
  alias ClippsterServer.Credits

  require Logger

  plug :require_ai_editor_access

  @generation_credit_cost 10
  @refinement_credit_cost 5
  @reference_credit_cost 2
  @style_pack_ids ~w(sports-highlights wedding-film cinematic gaming-stream news-breakdown viral-social)

  # ---------------------------------------------------------------------------
  # Analyze reference video
  # ---------------------------------------------------------------------------

  def analyze_reference(conn, params) do
    user = conn.assigns.current_user

    with {:ok, payload} <- ReferenceAnalyzer.validate_payload(params),
         :ok <- check_credits(user.id, @reference_credit_cost),
         {:ok, _} <- Credits.deduct_credits(user.id, @reference_credit_cost) do
      case ReferenceAnalyzer.analyze_reference(payload) do
        {:ok, edit_recipe} ->
          json(conn, %{edit_recipe: edit_recipe})

        {:error, reason} ->
          Credits.add_credits(user.id, @reference_credit_cost)
          conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
      end
    else
      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          error: "Insufficient credits",
          required: @reference_credit_cost,
          remaining: remaining
        })

      {:error, reason} when is_binary(reason) ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: reason})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # List sessions
  # ---------------------------------------------------------------------------

  def list_sessions(conn, _params) do
    user = conn.assigns.current_user
    sessions = ChatSessions.list_user_sessions(user.id, limit: 10)

    json(conn, %{
      sessions:
        Enum.map(sessions, fn s ->
          %{
            id: s.id,
            name: s.name,
            status: s.status,
            thumbnail_url: s.thumbnail_url,
            updated_at: s.updated_at,
            inserted_at: s.inserted_at
          }
        end)
    })
  end

  # ---------------------------------------------------------------------------
  # Delete session
  # ---------------------------------------------------------------------------

  def delete_session(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case ChatSessions.get_user_session(id, user.id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      session ->
        case ChatSessions.delete_session(session) do
          {:ok, _} ->
            json(conn, %{ok: true})

          {:error, _} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to delete session"})
        end
    end
  end

  # ---------------------------------------------------------------------------
  # Rename session
  # ---------------------------------------------------------------------------

  def rename_session(conn, %{"id" => id, "name" => name}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         {:ok, updated} <- ChatSessions.update_session(session, %{name: name}) do
      json(conn, %{ok: true, name: updated.name})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, _} ->
        conn |> put_status(:internal_server_error) |> json(%{error: "Failed to rename session"})
    end
  end

  # ---------------------------------------------------------------------------
  # Create session
  # ---------------------------------------------------------------------------

  def create_session(conn, params) do
    user = conn.assigns.current_user
    media_items = Map.get(params, "media_items", [])

    case ChatSessions.create_session(user.id, %{media_items: media_items}) do
      {:ok, session} ->
        # Add initial system greeting as first message
        {:ok, _greeting} =
          ChatSessions.create_message(
            session.id,
            "assistant",
            "Hey! I'm your AI video editor. What video do you want to create, and what media should we start with?",
            %{"ready_to_generate" => false, "summary" => nil, "media_request" => nil}
          )

        session = ChatSessions.get_session_with_messages(session.id)
        json(conn, serialize_session(session))

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to create session", details: inspect(changeset.errors)})
    end
  end

  # ---------------------------------------------------------------------------
  # Get session
  # ---------------------------------------------------------------------------

  def get_session(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case ChatSessions.get_user_session(id, user.id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      session ->
        session = ChatSessions.get_session_with_messages(session.id)
        json(conn, serialize_session(session))
    end
  end

  # ---------------------------------------------------------------------------
  # Send message (discovery phase)
  # ---------------------------------------------------------------------------

  def send_message(conn, %{"id" => id, "message" => message}) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         :ok <- validate_discovery_status(session),
         {:ok, _user_msg} <- ChatSessions.create_message(session.id, "user", message),
         {:ok, result} <- ChatComposer.chat(session, message, api_key) do
      # Reload session to get updated state
      session = ChatSessions.get_session_with_messages(session.id)

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
        conn |> put_status(:internal_server_error) |> json(%{error: reason})
    end
  end

  # ---------------------------------------------------------------------------
  # Trigger generation
  # ---------------------------------------------------------------------------

  def trigger_generation(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         :ok <- validate_can_generate(session),
         :ok <- check_credits(user.id, @generation_credit_cost) do
      # Deduct credits (skip if free/beta)
      if @generation_credit_cost > 0 do
        {:ok, _} = Credits.deduct_credits(user.id, @generation_credit_cost)
      end

      # Update status
      {:ok, session} = ChatSessions.update_session_status(session, "generating")

      # Build the rich prompt from chat context
      prompt = ChatComposer.build_generation_prompt(session)

      # Extract generation params from style_context or params
      style_context = session.style_context || %{}
      style = Map.get(style_context, "style") || Map.get(params, "style")
      duration = Map.get(style_context, "duration") || Map.get(params, "duration")

      aspect_ratio =
        Map.get(style_context, "aspectRatio") || Map.get(params, "aspectRatio", "16:9")

      intensity = Map.get(style_context, "intensity")
      caption_style = Map.get(style_context, "captionStyle")

      # Get media from session
      media = session.media_items || []

      extra_options = generation_options(session, intensity, caption_style)

      # Use SSE streaming
      conn =
        conn
        |> put_resp_header("content-type", "text/event-stream")
        |> put_resp_header("cache-control", "no-cache")
        |> put_resp_header("connection", "keep-alive")
        |> send_chunked(200)

      send_fn = fn event_data ->
        event_type = Map.get(event_data, :event, "message")
        payload = Map.get(event_data, :data, %{})
        encoded = Jason.encode!(payload)
        chunk_data = "event: #{event_type}\ndata: #{encoded}\n\n"

        case Plug.Conn.chunk(conn, chunk_data) do
          {:ok, _conn} -> :ok
          {:error, _reason} -> :error
        end
      end

      case VideoComposer.generate_streamed(
             prompt,
             media,
             style,
             duration,
             aspect_ratio,
             user,
             send_fn,
             nil,
             extra_options
           ) do
        {:ok, composition} ->
          # Save composition to session
          {:ok, _session} = ChatSessions.save_composition(session, composition)

          # Send done event
          send_fn.(%{event: "done", data: %{}})
          conn

        {:error, reason} ->
          # Refund credits on failure (skip if free/beta)
          if @generation_credit_cost > 0 do
            Credits.add_credits(user.id, @generation_credit_cost)
          end

          {:ok, _session} = ChatSessions.update_session_status(session, "discovery")

          send_fn.(%{event: "error", data: %{message: reason}})
          send_fn.(%{event: "done", data: %{}})
          conn
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
        conn |> put_status(:internal_server_error) |> json(%{error: reason})
    end
  end

  # ---------------------------------------------------------------------------
  # Send refinement
  # ---------------------------------------------------------------------------

  def send_refinement(conn, %{"id" => id, "message" => message}) do
    user = conn.assigns.current_user
    api_key = get_api_key()

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         :ok <- validate_can_refine(session) do
      # Save user message
      {:ok, _user_msg} = ChatSessions.create_message(session.id, "user", message)

      # Get AI interpretation of the refinement
      case ChatComposer.refine(session, message, api_key) do
        {:ok, %{response: response}} ->
          if Map.get(response, "apply_changes", false) do
            # Check credits before applying
            case check_credits(user.id, @refinement_credit_cost) do
              :ok ->
                # Deduct credits
                {:ok, _} = Credits.deduct_credits(user.id, @refinement_credit_cost)

                # Increment refinement tracking
                {:ok, session} = ChatSessions.increment_refinement_messages(session)

                # Start new refinement round if needed
                session =
                  if session.refinement_messages_used == 0 do
                    {:ok, s} = ChatSessions.start_refinement(session)
                    s
                  else
                    session
                  end

                # Build refinement prompt and re-generate
                change_desc = Map.get(response, "change_description", message)
                refinement_prompt = ChatComposer.build_refinement_prompt(session, change_desc)

                media = session.media_items || []
                style_context = session.style_context || %{}
                style = Map.get(style_context, "style")
                aspect_ratio = Map.get(style_context, "aspectRatio", "16:9")

                case VideoComposer.generate(
                       refinement_prompt,
                       media,
                       style,
                       nil,
                       aspect_ratio,
                       user,
                       session.composition,
                       generation_options(session)
                     ) do
                  {:ok, new_composition} ->
                    {:ok, session} = ChatSessions.save_composition(session, new_composition)
                    session = ChatSessions.get_session_with_messages(session.id)

                    json(conn, %{
                      session: serialize_session(session),
                      response: response,
                      composition: new_composition
                    })

                  {:error, reason} ->
                    # Refund on failure
                    Credits.add_credits(user.id, @refinement_credit_cost)
                    conn |> put_status(:internal_server_error) |> json(%{error: reason})
                end

              {:error, :insufficient_credits, remaining} ->
                conn
                |> put_status(:payment_required)
                |> json(%{
                  error: "Insufficient credits for refinement",
                  required: @refinement_credit_cost,
                  remaining: remaining
                })
            end
          else
            # AI needs clarification, no credits charged
            session = ChatSessions.get_session_with_messages(session.id)

            json(conn, %{
              session: serialize_session(session),
              response: response,
              composition: nil
            })
          end

        {:error, reason} ->
          conn |> put_status(:internal_server_error) |> json(%{error: reason})
      end
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Session is not in a refinable state"})

      {:error, :max_rounds_reached} ->
        conn |> put_status(:conflict) |> json(%{error: "Maximum refinement rounds reached"})

      {:error, :max_messages_reached} ->
        conn |> put_status(:conflict) |> json(%{error: "Maximum messages per round reached"})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: reason})
    end
  end

  # ---------------------------------------------------------------------------
  # Upload reference (stores analysis results from client-side vision analysis)
  # ---------------------------------------------------------------------------

  def upload_reference(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user
    reference_analysis = Map.get(params, "reference_analysis")
    reference_url = Map.get(params, "reference_url")

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         {:ok, session} <-
           ChatSessions.save_reference_analysis(session, reference_analysis, reference_url) do
      if reference_analysis do
        summary = get_in(reference_analysis, ["summary"]) || "Reference analyzed"

        {:ok, _msg} =
          ChatSessions.create_message(
            session.id,
            "system",
            "Reference analyzed: #{summary}",
            %{"type" => "reference_analysis", "reference_url" => reference_url}
          )
      end

      session = ChatSessions.get_session_with_messages(session.id)
      json(conn, serialize_session(session))
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # Update style pack
  # ---------------------------------------------------------------------------

  def update_style_pack(conn, %{"id" => id, "style_pack" => style_pack}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         :ok <- validate_style_pack(style_pack),
         style_context <-
           (session.style_context || %{})
           |> Map.put("style", style_pack["id"])
           |> Map.put("stylePack", style_pack),
         {:ok, session} <- ChatSessions.update_session(session, %{style_context: style_context}) do
      session = ChatSessions.get_session_with_messages(session.id)
      json(conn, serialize_session(session))
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, :invalid_style_pack} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "Invalid style pack"})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # Upload media analysis (stores per-image analysis from client-side vision)
  # ---------------------------------------------------------------------------

  def upload_media_analysis(conn, %{"id" => id, "media_analysis" => analysis}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         {:ok, session} <- ChatSessions.save_media_analysis(session, analysis) do
      session = ChatSessions.get_session_with_messages(session.id)
      json(conn, serialize_session(session))
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # Update media items
  # ---------------------------------------------------------------------------

  def update_media(conn, %{"id" => id, "media_items" => media_items}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         {:ok, _updated} <- ChatSessions.update_session(session, %{media_items: media_items}) do
      json(conn, %{ok: true, media_count: length(media_items)})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Session not found"})

      {:error, reason} ->
        conn |> put_status(:internal_server_error) |> json(%{error: inspect(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp require_ai_editor_access(conn, _opts) do
    user = conn.assigns.current_user

    if can_access_ai_editor?(user) do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "AI Video Creator requires access on a Creator or Pro plan."})
      |> halt()
    end
  end

  @doc false
  def can_access_ai_editor?(nil), do: false

  def can_access_ai_editor?(user) do
    user.is_admin || (user.ai_editor_enabled && user.subscription_tier in ["creator", "pro"])
  end

  defp validate_style_pack(%{"schemaVersion" => 1, "id" => id}) when id in @style_pack_ids,
    do: :ok

  defp validate_style_pack(_), do: {:error, :invalid_style_pack}

  defp generation_options(session, intensity \\ nil, caption_style \\ nil) do
    style_context = session.style_context || %{}

    %{
      "intensity" => intensity,
      "captionStyle" => caption_style,
      "style_recipe" => style_context["stylePack"],
      "reference_analysis" => session.reference_analysis,
      "media_analysis" => session.media_analysis
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp validate_discovery_status(%{status: "discovery"}), do: :ok
  defp validate_discovery_status(_), do: {:error, :invalid_status}

  defp validate_can_generate(%{status: status}) when status in ["discovery", "generated"], do: :ok
  defp validate_can_generate(_), do: {:error, :invalid_status}

  defp validate_can_refine(%{status: status} = session)
       when status in ["generated", "refining"] do
    cond do
      not ClippsterServer.AI.ChatSession.can_refine?(session) ->
        {:error, :max_rounds_reached}

      not ClippsterServer.AI.ChatSession.can_send_refinement_message?(session) ->
        {:error, :max_messages_reached}

      true ->
        :ok
    end
  end

  defp validate_can_refine(_), do: {:error, :invalid_status}

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

  defp get_api_key do
    System.get_env("OPENROUTER_API_KEY") || raise "OPENROUTER_API_KEY not set"
  end

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
      media_items: session.media_items,
      composition: session.composition,
      refinement_round: session.refinement_round,
      refinement_messages_used: session.refinement_messages_used,
      max_refinement_rounds: session.max_refinement_rounds,
      max_messages_per_round: session.max_messages_per_round,
      style_context: session.style_context,
      reference_analysis: session.reference_analysis,
      media_analysis: session.media_analysis,
      reference_url: session.reference_url,
      messages: messages,
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end
end
