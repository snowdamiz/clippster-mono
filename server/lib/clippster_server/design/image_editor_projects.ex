defmodule ClippsterServer.Design.ImageEditorProjects do
  @moduledoc """
  Context for managing image editor projects.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Design.ImageEditorProject

  def create_project(user_id, attrs \\ %{}) do
    %ImageEditorProject{}
    |> ImageEditorProject.changeset(Map.put(attrs, :user_id, user_id))
    |> Repo.insert()
  end

  def get_project(id) do
    Repo.get(ImageEditorProject, id)
  end

  def get_user_project(project_id, user_id) do
    ImageEditorProject
    |> where([p], p.id == ^project_id and p.user_id == ^user_id)
    |> Repo.one()
  end

  def list_user_projects(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    ImageEditorProject
    |> where([p], p.user_id == ^user_id)
    |> order_by([p], desc: p.updated_at)
    |> limit(^limit)
    |> Repo.all()
  end

  def update_project(project, attrs) do
    project
    |> ImageEditorProject.changeset(attrs)
    |> Repo.update()
  end

  def delete_project(project) do
    Repo.delete(project)
  end
end
