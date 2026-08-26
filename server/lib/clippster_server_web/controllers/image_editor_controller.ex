defmodule ClippsterServerWeb.ImageEditorController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Design.ImageEditorProjects

  require Logger

  # ---------------------------------------------------------------------------
  # List projects
  # ---------------------------------------------------------------------------

  def list_projects(conn, _params) do
    user = conn.assigns.current_user
    projects = ImageEditorProjects.list_user_projects(user.id, limit: 100)

    json(conn, %{
      projects:
        Enum.map(projects, fn p ->
          %{
            id: p.id,
            name: p.name,
            thumbnail_url: p.thumbnail_url,
            canvas_width: p.canvas_width,
            canvas_height: p.canvas_height,
            updated_at: p.updated_at,
            inserted_at: p.inserted_at
          }
        end)
    })
  end

  # ---------------------------------------------------------------------------
  # Create project
  # ---------------------------------------------------------------------------

  def create_project(conn, params) do
    user = conn.assigns.current_user
    name = Map.get(params, "name", "Untitled Design")
    project_data = Map.get(params, "project_data", %{})
    thumbnail_url = Map.get(params, "thumbnail_url")
    canvas_width = Map.get(params, "canvas_width")
    canvas_height = Map.get(params, "canvas_height")

    case ImageEditorProjects.create_project(user.id, %{
           name: name,
           project_data: project_data,
           thumbnail_url: thumbnail_url,
           canvas_width: canvas_width,
           canvas_height: canvas_height
         }) do
      {:ok, project} ->
        json(conn, serialize_project(project))

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to create project", details: inspect(changeset.errors)})
    end
  end

  # ---------------------------------------------------------------------------
  # Get project
  # ---------------------------------------------------------------------------

  def get_project(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case ImageEditorProjects.get_user_project(id, user.id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Project not found"})

      project ->
        json(conn, serialize_project(project))
    end
  end

  # ---------------------------------------------------------------------------
  # Update project
  # ---------------------------------------------------------------------------

  def update_project(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with project when not is_nil(project) <-
           ImageEditorProjects.get_user_project(id, user.id),
         attrs <- build_update_attrs(params),
         {:ok, updated} <- ImageEditorProjects.update_project(project, attrs) do
      json(conn, serialize_project(updated))
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Project not found"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to update project", details: inspect(changeset.errors)})
    end
  end

  # ---------------------------------------------------------------------------
  # Delete project
  # ---------------------------------------------------------------------------

  def delete_project(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case ImageEditorProjects.get_user_project(id, user.id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Project not found"})

      project ->
        case ImageEditorProjects.delete_project(project) do
          {:ok, _} ->
            json(conn, %{ok: true})

          {:error, _} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to delete project"})
        end
    end
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp serialize_project(project) do
    %{
      id: project.id,
      name: project.name,
      project_data: project.project_data,
      thumbnail_url: project.thumbnail_url,
      canvas_width: project.canvas_width,
      canvas_height: project.canvas_height,
      updated_at: project.updated_at,
      inserted_at: project.inserted_at
    }
  end

  defp build_update_attrs(params) do
    attrs = %{}

    attrs =
      if Map.has_key?(params, "name"), do: Map.put(attrs, :name, params["name"]), else: attrs

    attrs =
      if Map.has_key?(params, "project_data"),
        do: Map.put(attrs, :project_data, params["project_data"]),
        else: attrs

    attrs =
      if Map.has_key?(params, "thumbnail_url"),
        do: Map.put(attrs, :thumbnail_url, params["thumbnail_url"]),
        else: attrs

    attrs =
      if Map.has_key?(params, "canvas_width"),
        do: Map.put(attrs, :canvas_width, params["canvas_width"]),
        else: attrs

    attrs =
      if Map.has_key?(params, "canvas_height"),
        do: Map.put(attrs, :canvas_height, params["canvas_height"]),
        else: attrs

    attrs
  end
end
