defmodule ClippsterServerWeb.AIImageController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.{
    ImageComposer,
    ImageGenerationPolicy,
    ImageGenerationReadiness,
    ThumbnailSessions
  }

  alias ClippsterServer.Credits
  alias ClippsterServer.Storage
  alias ClippsterServerWeb.AIChatController

  plug :require_ai_editor_access

  def list_sessions(conn, _params) do
    user = conn.assigns.current_user

    sessions = ThumbnailSessions.list_user_sessions(user.id, limit: 50)

    json(conn, %{
      sessions:
        Enum.map(sessions, fn session ->
          %{
            id: session.id,
            name: session.name,
            status: session.status,
            creator_mode: session.creator_mode || "thumbnail",
            generation_mode: session.generation_mode,
            thumbnail_url: Storage.browser_accessible_url(session.thumbnail_url),
            updated_at: session.updated_at,
            inserted_at: session.inserted_at
          }
        end)
    })
  end

  def create_session(conn, params) do
    user = conn.assigns.current_user

    attrs = %{
      creator_mode: "image",
      generation_mode: "quick",
      canvas_width: 1024,
      canvas_height: 1024,
      name: Map.get(params, "name")
    }

    with {:ok, session} <- ThumbnailSessions.create_session(user.id, attrs),
         {:ok, _message} <-
           ThumbnailSessions.create_message(
             session.id,
             "assistant",
             "Describe the image you want to create. I’ll ask only the questions that materially improve it, then build a production-ready prompt.",
             %{"ready_to_generate" => false, "expanded_prompt" => nil}
           ) do
      session = ThumbnailSessions.get_session_with_messages(session.id)
      json(conn, ThumbnailSessions.serialize_session(session))
    else
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to create image session", details: inspect(changeset.errors)})
    end
  end

  def get_session(conn, %{"id" => id}) do
    user = conn.assigns.current_user
    policy = ImageGenerationPolicy.resolve(:create, false)

    with {:ok, session} <- get_image_session(conn, id),
         {:ok, session} <- recover_stuck_generation(session, user.id, policy.credit_cost) do
      session = ThumbnailSessions.get_session_with_messages(session.id)
      json(conn, ThumbnailSessions.serialize_session(session))
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: format_error(reason)})
    end
  end

  def delete_session(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with session when not is_nil(session) <- ThumbnailSessions.get_user_session(id, user.id),
         {:ok, _deleted} <- ThumbnailSessions.delete_session_with_assets(session) do
      json(conn, %{ok: true})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Project not found"})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to delete project"})
    end
  end

  def rename_session(conn, %{"id" => id, "name" => name}) do
    with {:ok, session} <- get_image_session(conn, id),
         {:ok, updated} <- ThumbnailSessions.update_session(session, %{name: name}) do
      json(conn, %{ok: true, name: updated.name})
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, _reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to rename image session"})
    end
  end

  def send_message(conn, %{"id" => id, "message" => message}) do
    api_key = get_api_key()
    user = conn.assigns.current_user
    policy = ImageGenerationPolicy.resolve(:create, false)

    with {:ok, session} <- get_image_session(conn, id),
         {:ok, session} <- recover_stuck_generation(session, user.id, policy.credit_cost),
         :ok <- validate_chat_status(session),
         {:ok, session} <- clear_pending_action_prompt(session),
         {:ok, user_message} <- ThumbnailSessions.create_message(session.id, "user", message) do
      chat_result =
        case session.status do
          "discovery" -> ImageComposer.chat(session, message, api_key)
          _ -> ImageComposer.revise_chat(session, message, api_key)
        end

      case chat_result do
        {:ok, result} ->
          session = ThumbnailSessions.get_session_with_messages(session.id)

          json(conn, %{
            session: ThumbnailSessions.serialize_session(session),
            response: result.response
          })

        {:error, reason} ->
          ThumbnailSessions.delete_message(user_message)

          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: format_error(reason)})
      end
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Image session is not accepting prompts"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: format_error(reason)})
    end
  end

  def prepare_prompt(conn, %{"id" => id}) do
    api_key = get_api_key()
    user = conn.assigns.current_user
    policy = ImageGenerationPolicy.resolve(:create, false)

    with {:ok, session} <- get_image_session(conn, id),
         {:ok, session} <- recover_stuck_generation(session, user.id, policy.credit_cost),
         :ok <- validate_discovery_status(session),
         :ok <- validate_ready_to_generate(session),
         {:ok, prepared} <- ImageComposer.prepare_prompt(session, api_key),
         {:ok, updated} <-
           ThumbnailSessions.update_session(session, %{
             brief_summary:
               Map.merge(session.brief_summary || %{}, %{
                 "generation_prompt" => prepared.prompt,
                 "aspect_ratio" => prepared.aspect_ratio
               })
           }) do
      json(conn, %{
        prompt: prepared.prompt,
        aspect_ratio: prepared.aspect_ratio,
        session:
          ThumbnailSessions.serialize_session(
            ThumbnailSessions.get_session_with_messages(updated.id)
          )
      })
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Image session is not ready"})

      {:error, :prompt_not_ready} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Answer the assistant's follow-up question before generating"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: format_error(reason)})
    end
  end

  def prepare_revision(conn, %{"id" => id}) do
    api_key = get_api_key()

    with {:ok, session} <- get_image_session(conn, id),
         :ok <- validate_revision_status(session),
         :ok <- validate_ready_to_edit(session),
         {:ok, prepared} <- ImageComposer.prepare_revision(session, api_key),
         {:ok, updated} <-
           ThumbnailSessions.update_session(session, %{
             brief_summary:
               Map.merge(session.brief_summary || %{}, %{
                 "edit_prompt" => prepared.prompt,
                 "aspect_ratio" => prepared.aspect_ratio
               })
           }) do
      json(conn, %{
        prompt: prepared.prompt,
        aspect_ratio: prepared.aspect_ratio,
        session:
          ThumbnailSessions.serialize_session(
            ThumbnailSessions.get_session_with_messages(updated.id)
          )
      })
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Image session is not ready to revise"})

      {:error, :edit_prompt_not_ready} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Describe the changes you want before applying an edit"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: format_error(reason)})
    end
  end

  def trigger_generation(conn, %{"id" => id}) do
    user = conn.assigns.current_user
    policy = ImageGenerationPolicy.resolve(:create, false)

    with {:ok, session} <- get_image_session(conn, id),
         {:ok, session} <- recover_stuck_generation(session, user.id, policy.credit_cost),
         :ok <- validate_discovery_status(session),
         :ok <- validate_ready_to_generate(session),
         {:ok, prompt, aspect_ratio} <- prepared_prompt(session),
         {:ok, session} <- claim_and_charge(session, user.id, policy.credit_cost) do
      try do
        case ImageComposer.generate(session, prompt, aspect_ratio, get_api_key()) do
          {:ok, generated} ->
            case ThumbnailSessions.save_generation(session, %{
                   generation_mode: "quick",
                   candidates: generated.candidates,
                   plate_url: nil,
                   recipe: nil,
                   composition: generated.composition,
                   thumbnail_url: generated.thumbnail_url,
                   canvas_width: generated.canvas_width,
                   canvas_height: generated.canvas_height,
                   status: "generated"
                 }) do
              {:ok, saved} ->
                saved = ThumbnailSessions.get_session_with_messages(saved.id)
                json(conn, ThumbnailSessions.serialize_session(saved))

              {:error, reason} ->
                generation_failed(conn, session, user.id, policy.credit_cost, reason, "discovery")
            end

          {:error, reason} ->
            generation_failed(conn, session, user.id, policy.credit_cost, reason, "discovery")
        end
      rescue
        error ->
          generation_failed(
            conn,
            session,
            user.id,
            policy.credit_cost,
            Exception.message(error),
            "discovery"
          )
      end
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Image session is not ready"})

      {:error, :generation_already_claimed} ->
        conn |> put_status(:conflict) |> json(%{error: "Image generation is already in progress"})

      {:error, :prompt_not_prepared} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Generate the production prompt before creating the image"})

      {:error, :prompt_not_ready} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Answer the assistant's follow-up question before generating"})

      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          error: "Insufficient credits",
          required: policy.credit_cost,
          remaining: remaining
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def trigger_revision(conn, %{"id" => id}) do
    user = conn.assigns.current_user
    policy = ImageGenerationPolicy.resolve(:edit, true)

    with {:ok, session} <- get_image_session(conn, id),
         :ok <- validate_revision_status(session),
         :ok <- validate_ready_to_edit(session),
         {:ok, prompt, aspect_ratio} <- prepared_edit_prompt(session),
         {:ok, session} <- claim_revision_and_charge(session, user.id, policy.credit_cost) do
      try do
        case ImageComposer.edit(session, prompt, aspect_ratio, get_api_key()) do
          {:ok, edited} ->
            case ThumbnailSessions.save_generation(session, %{
                   generation_mode: session.generation_mode || "quick",
                   candidates: edited.candidates,
                   plate_url: session.plate_url,
                   recipe: session.recipe,
                   composition: edited.composition,
                   thumbnail_url: edited.thumbnail_url,
                   canvas_width: edited.canvas_width,
                   canvas_height: edited.canvas_height,
                   status: "generated"
                 }) do
              {:ok, saved} ->
                saved = ThumbnailSessions.get_session_with_messages(saved.id)
                json(conn, ThumbnailSessions.serialize_session(saved))

              {:error, reason} ->
                generation_failed(conn, session, user.id, policy.credit_cost, reason, "generated")
            end

          {:error, reason} ->
            generation_failed(conn, session, user.id, policy.credit_cost, reason, "generated")
        end
      rescue
        error ->
          generation_failed(
            conn,
            session,
            user.id,
            policy.credit_cost,
            Exception.message(error),
            "generated"
          )
      end
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Image session is not ready to revise"})

      {:error, :revision_already_claimed} ->
        conn |> put_status(:conflict) |> json(%{error: "Image revision is already in progress"})

      {:error, :edit_prompt_not_prepared} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Prepare the edit instruction before applying changes"})

      {:error, :edit_prompt_not_ready} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "Describe the changes you want before applying an edit"})

      {:error, :insufficient_credits, remaining} ->
        conn
        |> put_status(:payment_required)
        |> json(%{
          error: "Insufficient credits",
          required: policy.credit_cost,
          remaining: remaining
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def select_candidate(conn, %{"id" => id} = params) do
    with {:ok, session} <- get_image_session(conn, id),
         :ok <- validate_revision_status(session),
         {:ok, index} <- parse_candidate_index(params),
         {:ok, selected} <- ImageComposer.select_candidate(session, index),
         {:ok, updated} <-
           ThumbnailSessions.update_session(session, %{
             candidates: selected.candidates,
             thumbnail_url: selected.thumbnail_url,
             composition: selected.composition
           }) do
      json(
        conn,
        ThumbnailSessions.serialize_session(
          ThumbnailSessions.get_session_with_messages(updated.id)
        )
      )
    else
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Image session not found"})

      {:error, :invalid_status} ->
        conn |> put_status(:conflict) |> json(%{error: "Image session has no candidates yet"})

      {:error, :candidate_not_found} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "Candidate not found"})

      {:error, :invalid_candidate_index} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "Invalid candidate index"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: format_error(reason)})
    end
  end

  defp get_image_session(conn, id) do
    case ThumbnailSessions.get_user_session(id, conn.assigns.current_user.id, "image") do
      nil -> {:error, :not_found}
      session -> {:ok, session}
    end
  end

  # A crashed generate can leave status=generating with credits already deducted.
  # Recover empty failed attempts so the user can retry without being stuck.
  defp recover_stuck_generation(%{status: "generating"} = session, user_id, credit_cost) do
    if stuck_failed_generation?(session) do
      _ = Credits.add_credits(user_id, credit_cost)

      case ThumbnailSessions.update_session_status(session, "discovery") do
        {:ok, recovered} -> {:ok, recovered}
        {:error, reason} -> {:error, reason}
      end
    else
      {:ok, session}
    end
  end

  defp recover_stuck_generation(session, _user_id, _credit_cost), do: {:ok, session}

  defp stuck_failed_generation?(session) do
    blank_url?(session.thumbnail_url) and blank_candidates?(session.candidates)
  end

  defp blank_url?(url) when url in [nil, ""], do: true
  defp blank_url?(_), do: false

  defp blank_candidates?(candidates) when candidates in [nil, []], do: true
  defp blank_candidates?(candidates) when is_list(candidates) do
    Enum.all?(candidates, fn
      %{"url" => url} -> blank_url?(url)
      %{url: url} -> blank_url?(url)
      _ -> true
    end)
  end
  defp blank_candidates?(_), do: true

  defp prepared_prompt(session) do
    summary = session.brief_summary || %{}
    prompt = Map.get(summary, "generation_prompt")

    if is_binary(prompt) and String.trim(prompt) != "" do
      {:ok, prompt, Map.get(summary, "aspect_ratio") || "1:1"}
    else
      {:error, :prompt_not_prepared}
    end
  end

  defp prepared_edit_prompt(session) do
    summary = session.brief_summary || %{}
    prompt = Map.get(summary, "edit_prompt")

    if is_binary(prompt) and String.trim(prompt) != "" do
      {:ok, prompt, Map.get(summary, "aspect_ratio") || "1:1"}
    else
      {:error, :edit_prompt_not_prepared}
    end
  end

  defp validate_ready_to_generate(session) do
    session = ThumbnailSessions.get_session_with_messages(session.id)

    ready = ImageGenerationReadiness.latest_assistant_ready?(session.messages)

    if ready, do: :ok, else: {:error, :prompt_not_ready}
  end

  defp validate_ready_to_edit(session) do
    session = ThumbnailSessions.get_session_with_messages(session.id)

    ready = ImageGenerationReadiness.latest_assistant_ready_to_edit?(session.messages)

    if ready, do: :ok, else: {:error, :edit_prompt_not_ready}
  end

  defp validate_discovery_status(%{status: "discovery"}), do: :ok
  defp validate_discovery_status(_session), do: {:error, :invalid_status}

  defp validate_revision_status(%{status: status}) when status in ["generated", "refining"],
    do: :ok

  defp validate_revision_status(_session), do: {:error, :invalid_status}

  defp validate_chat_status(%{status: status})
       when status in ["discovery", "generated", "refining"],
       do: :ok

  defp validate_chat_status(_session), do: {:error, :invalid_status}

  defp clear_pending_action_prompt(%{status: "discovery"} = session) do
    summary = session.brief_summary || %{}
    visual_refs = Map.get(summary, "visual_reference_urls")

    ThumbnailSessions.update_session(session, %{
      brief_summary:
        if is_list(visual_refs) and visual_refs != [] do
          %{"visual_reference_urls" => visual_refs}
        else
          nil
        end
    })
  end

  defp clear_pending_action_prompt(session) do
    summary = session.brief_summary || %{}

    ThumbnailSessions.update_session(session, %{
      brief_summary: Map.drop(summary, ["edit_prompt"])
    })
  end

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

  defp claim_and_charge(session, user_id, credit_cost) do
    case ThumbnailSessions.claim_generation(session) do
      {:ok, claimed} ->
        case check_credits(user_id, credit_cost) do
          :ok ->
            case Credits.deduct_credits(user_id, credit_cost) do
              {:ok, _balance} ->
                {:ok, claimed}

              {:error, reason} ->
                ThumbnailSessions.update_session_status(claimed, "discovery")
                credit_deduction_error(user_id, credit_cost, reason)
            end

          error ->
            ThumbnailSessions.update_session_status(claimed, "discovery")
            error
        end

      error ->
        error
    end
  end

  defp claim_revision_and_charge(session, user_id, credit_cost) do
    case ThumbnailSessions.claim_revision(session) do
      {:ok, claimed} ->
        case check_credits(user_id, credit_cost) do
          :ok ->
            case Credits.deduct_credits(user_id, credit_cost) do
              {:ok, _balance} ->
                {:ok, claimed}

              {:error, reason} ->
                ThumbnailSessions.update_session_status(claimed, "generated")
                credit_deduction_error(user_id, credit_cost, reason)
            end

          error ->
            ThumbnailSessions.update_session_status(claimed, "generated")
            error
        end

      error ->
        error
    end
  end

  defp generation_failed(conn, session, user_id, credit_cost, reason, reset_status) do
    refund_result = Credits.add_credits(user_id, credit_cost)
    reset_result = ThumbnailSessions.update_session_status(session, reset_status)

    error =
      case {refund_result, reset_result} do
        {{:ok, _credit}, {:ok, _session}} -> inspect(reason)
        other -> "#{inspect(reason)}; compensation failed: #{inspect(other)}"
      end

    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: error})
  end

  defp credit_deduction_error(user_id, credit_cost, reason) do
    case check_credits(user_id, credit_cost) do
      {:error, :insufficient_credits, remaining} ->
        {:error, :insufficient_credits, remaining}

      _ ->
        {:error, {:credit_deduction_failed, reason}}
    end
  end

  defp require_ai_editor_access(conn, _opts) do
    if AIChatController.can_access_image_editor?(conn.assigns.current_user) do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "AI Image Creator requires access on a Creator or Pro plan."})
      |> halt()
    end
  end


  defp parse_candidate_index(params) do
    raw = Map.get(params, "candidate_index", Map.get(params, "index", 0))

    cond do
      is_integer(raw) and raw >= 0 -> {:ok, raw}
      is_binary(raw) ->
        case Integer.parse(raw) do
          {index, ""} when index >= 0 -> {:ok, index}
          _ -> {:error, :invalid_candidate_index}
        end
      true -> {:error, :invalid_candidate_index}
    end
  end

  defp get_api_key do
    System.get_env("OPENROUTER_API_KEY") || raise "OPENROUTER_API_KEY not set"
  end

  defp format_error(reason) when is_binary(reason), do: reason
  defp format_error(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp format_error(reason), do: inspect(reason)
end
