defmodule ClippsterServerWeb.AIController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AI.VideoComposer
  require Logger

  def generate_video(conn, params) do
    user = conn.assigns.current_user

    Logger.info("AI video generation request from user #{user.id}")

    with {:ok, composition} <- VideoComposer.generate(
      params["prompt"],
      params["media"],
      params["style"],
      params["duration"],
      params["aspectRatio"],
      user,
      params["existingComposition"]
    ) do
      json(conn, %{composition: composition})
    else
      {:error, reason} ->
        Logger.error("AI video generation failed: #{inspect(reason)}")
        conn
        |> put_status(:bad_request)
        |> json(%{error: reason})
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
