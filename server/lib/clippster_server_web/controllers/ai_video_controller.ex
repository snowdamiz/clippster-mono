defmodule ClippsterServerWeb.AIVideoController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AI.VideoComposer
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User

  require Logger

  @doc """
  Generate a video composition from AI prompt and media.
  POST /api/ai-video/generate
  """
  def generate(conn, %{"prompt" => prompt, "media" => media} = params) do
    user = conn.assigns[:current_user]

    if is_nil(user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      style = params["style"]
      duration = params["duration"] || 30
      aspect_ratio = params["aspectRatio"] || "16:9"

      case VideoComposer.generate_composition(prompt, media,
             style: style,
             duration: duration,
             aspect_ratio: aspect_ratio
           ) do
        {:ok, composition} ->
          Logger.info("Generated composition for user #{user.id}")

          conn
          |> put_status(:ok)
          |> json(composition)

        {:error, reason} ->
          Logger.error("Failed to generate composition: #{inspect(reason)}")

          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "Failed to generate composition: #{reason}"})
      end
    end
  end

  @doc """
  Save a composition to the database.
  POST /api/ai-video/compositions
  """
  def create_composition(conn, %{"composition" => composition_data}) do
    user = conn.assigns[:current_user]

    if is_nil(user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      # TODO: Implement database storage for compositions
      # For now, just return success with the composition ID
      composition_id = composition_data["id"] || Ecto.UUID.generate()

      conn
      |> put_status(:created)
      |> json(%{id: composition_id})
    end
  end

  @doc """
  Get a saved composition by ID.
  GET /api/ai-video/compositions/:id
  """
  def get_composition(conn, %{"id" => _id}) do
    user = conn.assigns[:current_user]

    if is_nil(user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      # TODO: Implement database retrieval
      conn
      |> put_status(:not_found)
      |> json(%{error: "Composition not found"})
    end
  end

  @doc """
  List all compositions for the current user.
  GET /api/ai-video/compositions
  """
  def list_compositions(conn, _params) do
    user = conn.assigns[:current_user]

    if is_nil(user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      # TODO: Implement database listing
      conn
      |> put_status(:ok)
      |> json([])
    end
  end

  @doc """
  Delete a composition.
  DELETE /api/ai-video/compositions/:id
  """
  def delete_composition(conn, %{"id" => _id}) do
    user = conn.assigns[:current_user]

    if is_nil(user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      # TODO: Implement database deletion
      conn
      |> put_status(:ok)
      |> json(%{success: true})
    end
  end
end
