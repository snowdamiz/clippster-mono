defmodule ClippsterServerWeb.AIChatController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.{ChatSessions, ChatComposer, VideoComposer, ReferenceAnalyzer}
  alias ClippsterServer.Credits

  require Logger

  @generation_credit_cost 10
  @refinement_credit_cost 5

  # ---------------------------------------------------------------------------
  # Analyze reference image
  # ---------------------------------------------------------------------------

  def analyze_reference(conn, %{"image_base64" => image_base64} = params) do
    mime_type = Map.get(params, "mime_type", "image/jpeg")

    case ReferenceAnalyzer.analyze_reference(image_base64, mime_type) do
      {:ok, style_profile} ->
        json(conn, %{style_profile: style_profile})
      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
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
        {:ok, _greeting} = ChatSessions.create_message(
          session.id, "assistant",
          greeting_message(media_items),
          %{
            "ready_to_generate" => false,
            "summary" => nil,
            "step" => "welcome",
            "quick_replies" => greeting_quick_replies(media_items),
            "transcript_highlights" => nil,
            "proposed_scenes" => nil
          }
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
      aspect_ratio = Map.get(style_context, "aspectRatio") || Map.get(params, "aspectRatio", "16:9")
      intensity = Map.get(style_context, "intensity")
      caption_style = Map.get(style_context, "captionStyle")

      # Get media from session
      media = session.media_items || []

      extra_options = %{}
      extra_options = if intensity, do: Map.put(extra_options, "intensity", intensity), else: extra_options
      extra_options = if caption_style, do: Map.put(extra_options, "captionStyle", caption_style), else: extra_options
      extra_options = if session.reference_analysis, do: Map.put(extra_options, "reference_analysis", session.reference_analysis), else: extra_options
      extra_options = if session.media_analysis, do: Map.put(extra_options, "media_analysis", session.media_analysis), else: extra_options

      # Use SSE streaming
      conn = conn
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
        prompt, media, style, duration, aspect_ratio, user, send_fn, nil, extra_options
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
        conn |> put_status(:payment_required) |> json(%{
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
                session = if session.refinement_messages_used == 0 do
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
                  refinement_prompt, media, style, nil, aspect_ratio,
                  user, session.composition, %{}
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
                conn |> put_status(:payment_required) |> json(%{
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
         {:ok, session} <- ChatSessions.save_reference_analysis(session, reference_analysis, reference_url) do

      # Add a system message about the reference
      summary = get_in(reference_analysis, ["summary"]) || "Reference analyzed"
      {:ok, _msg} = ChatSessions.create_message(
        session.id, "system",
        "Reference analyzed: #{summary}",
        %{"type" => "reference_analysis", "reference_url" => reference_url}
      )

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
  # Approve scene plan
  # ---------------------------------------------------------------------------

  def approve_scene_plan(conn, %{"id" => id, "scene_plan" => scene_plan}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ChatSessions.get_user_session(id, user.id),
         {:ok, session} <- ChatSessions.save_scene_plan(session, scene_plan) do

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
  # Private helpers
  # ---------------------------------------------------------------------------

  defp validate_discovery_status(%{status: "discovery"}), do: :ok
  defp validate_discovery_status(_), do: {:error, :invalid_status}

  defp validate_can_generate(%{status: status}) when status in ["discovery", "generated"], do: :ok
  defp validate_can_generate(_), do: {:error, :invalid_status}

  defp validate_can_refine(%{status: status} = session) when status in ["generated", "refining"] do
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

  defp greeting_message(media_items) when is_list(media_items) and length(media_items) > 0 do
    first = List.first(media_items)
    name = Map.get(first, "name", "your video")
    duration = Map.get(first, "duration")
    has_transcript = Map.get(first, "transcript") != nil and Map.get(first, "transcript") != ""
    dur_str = if duration, do: " (#{round(duration)}s)", else: ""

    base = "Hey! I see you've uploaded #{name}#{dur_str}."

    if has_transcript do
      base <> " I found a transcript for your video — would you like to use it as-is, or review it first to fix any errors?"
    else
      base <> " I don't see a transcript yet. For the best results, I'd recommend generating one so I can work with the spoken content. You can also skip this if you prefer."
    end
  end
  defp greeting_message(_) do
    "Hey! Welcome to the AI Video Creator. Upload a video or clip to get started, and I'll walk you through creating something awesome — step by step."
  end

  defp greeting_quick_replies(media_items) when is_list(media_items) and length(media_items) > 0 do
    first = List.first(media_items)
    has_transcript = Map.get(first, "transcript") != nil and Map.get(first, "transcript") != ""

    if has_transcript do
      [
        %{"label" => "Use Transcript", "value" => "use_transcript"},
        %{"label" => "Review & Edit", "value" => "review_transcript"},
        %{"label" => "Generate New", "value" => "generate_new_transcript"}
      ]
    else
      [
        %{"label" => "Generate Transcript", "value" => "generate_transcript"},
        %{"label" => "Skip — No Transcript", "value" => "skip_transcript"}
      ]
    end
  end
  defp greeting_quick_replies(_) do
    [%{"label" => "Upload Media", "value" => "upload_media"}]
  end

  defp serialize_session(session) do
    messages = if Ecto.assoc_loaded?(session.messages) do
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
      scene_plan: session.scene_plan,
      conversation_step: session.conversation_step,
      messages: messages,
      inserted_at: session.inserted_at,
      updated_at: session.updated_at
    }
  end
end
