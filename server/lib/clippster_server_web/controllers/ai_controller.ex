defmodule ClippsterServerWeb.AIController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI.VideoComposer
  require Logger

  # Tier hierarchy for access checks
  @tier_hierarchy %{"starter" => 1, "creator" => 2, "pro" => 3}

  defp meets_minimum_tier?(user, min_tier) do
    # Admins and org-created users always have access
    if user.is_admin or not is_nil(user.created_by_organization_id) do
      true
    else
      user_tier = user.subscription_tier
      min_level = Map.get(@tier_hierarchy, min_tier, 0)
      user_level = Map.get(@tier_hierarchy, user_tier, 0)
      user_level >= min_level
    end
  end

  # Non-streaming endpoint (backwards-compatible fallback)
  def generate_video(conn, params) do
    user = conn.assigns.current_user

    if meets_minimum_tier?(user, "creator") do
      Logger.info("AI video generation request from user #{user.id}")

      with {:ok, composition} <- VideoComposer.generate(
        params["prompt"],
        params["media"],
        params["style"] || params["stylePreset"],
        params["duration"],
        params["aspectRatio"],
        user,
        params["existingComposition"],
        %{
          "intensity" => params["intensity"],
          "captionStyle" => params["captionStyle"]
        }
      ) do
        json(conn, %{composition: composition})
      else
        {:error, reason} ->
          Logger.error("AI video generation failed: #{inspect(reason)}")
          conn
          |> put_status(:bad_request)
          |> json(%{error: reason})
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "AI Video Creator requires Creator plan or higher"})
    end
  end

  # SSE streaming endpoint — sends scene-by-scene progress events
  def generate_video_streamed(conn, params) do
    user = conn.assigns.current_user

    if meets_minimum_tier?(user, "creator") do
      Logger.info("AI video generation (streamed) request from user #{user.id}")

      # Set up SSE connection
      conn =
        conn
        |> put_resp_header("content-type", "text/event-stream")
        |> put_resp_header("cache-control", "no-cache")
        |> put_resp_header("connection", "keep-alive")
        |> put_resp_header("x-accel-buffering", "no")
        |> send_chunked(200)

      # Build send function that writes SSE events to the connection
      send_fn = fn %{event: event, data: data} ->
        sse_data = Jason.encode!(data)
        chunk_data = "event: #{event}\ndata: #{sse_data}\n\n"
        case Plug.Conn.chunk(conn, chunk_data) do
          {:ok, _conn} -> :ok
          {:error, reason} ->
            Logger.warning("SSE chunk send failed: #{inspect(reason)}")
            :error
        end
      end

      # Run generation in the current process (chunked response keeps connection open)
      VideoComposer.generate_streamed(
        params["prompt"],
        params["media"],
        params["style"] || params["stylePreset"],
        params["duration"],
        params["aspectRatio"],
        user,
        send_fn,
        params["existingComposition"],
        %{
          "intensity" => params["intensity"],
          "captionStyle" => params["captionStyle"]
        }
      )

      # Send final done event and close
      Plug.Conn.chunk(conn, "event: done\ndata: {}\n\n")
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "AI Video Creator requires Creator plan or higher"})
    end
  end

  def save_composition(conn, %{"composition" => _composition_params}) do
    _user = conn.assigns.current_user

    # TODO: Save composition to database
    # For now, just return success with generated ID
    composition_id = Ecto.UUID.generate()

    json(conn, %{id: composition_id})
  end

  def get_composition(conn, %{"id" => _id}) do
    # TODO: Fetch composition from database
    conn
    |> put_status(:not_found)
    |> json(%{error: "Not implemented"})
  end

  def list_compositions(conn, _params) do
    # TODO: List user's compositions
    json(conn, %{compositions: []})
  end

  def delete_composition(conn, %{"id" => _id}) do
    # TODO: Delete composition from database
    send_resp(conn, :no_content, "")
  end
end
