defmodule ClippsterServerWeb.AnnouncementsController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Announcements
  alias ClippsterServer.Announcements.Announcement

  @doc """
  GET /api/announcements/active
  Returns active announcements filtered by the caller's account type.
  """
  def active(conn, _params) do
    user = conn.assigns[:current_user]
    account_type = if user, do: user.account_type, else: "personal"

    announcements = Announcements.list_active_for_account_type(account_type)

    json(conn, %{
      announcements: Enum.map(announcements, &serialize/1)
    })
  end

  @doc """
  GET /api/admin/announcements
  Returns all announcements (admin only).
  """
  def index(conn, _params) do
    announcements = Announcements.list_all()

    json(conn, %{
      announcements: Enum.map(announcements, &serialize/1)
    })
  end

  @doc """
  POST /api/admin/announcements
  Creates a new announcement.
  """
  def create(conn, params) do
    user_id = conn.assigns.current_user.id

    case Announcements.create(params, user_id) do
      {:ok, announcement} ->
        conn
        |> put_status(201)
        |> json(%{success: true, announcement: serialize(announcement)})

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, errors: format_errors(changeset)})
    end
  end

  @doc """
  PUT /api/admin/announcements/:id
  Updates an announcement. Setting is_active: true triggers broadcast.
  """
  def update(conn, %{"id" => id} = params) do
    case Announcements.get(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Announcement not found"})

      %Announcement{} = announcement ->
        case Announcements.update(announcement, params) do
          {:ok, updated} ->
            json(conn, %{success: true, announcement: serialize(updated)})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, errors: format_errors(changeset)})
        end
    end
  end

  @doc """
  DELETE /api/admin/announcements/:id
  Deletes an announcement.
  """
  def delete(conn, %{"id" => id}) do
    case Announcements.get(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Announcement not found"})

      %Announcement{} = announcement ->
        case Announcements.delete(announcement) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, _} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to delete announcement"})
        end
    end
  end

  defp serialize(announcement) do
    %{
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      type: announcement.type,
      audience: announcement.audience,
      is_active: announcement.is_active,
      published_at: announcement.published_at,
      expires_at: announcement.expires_at,
      inserted_at: announcement.inserted_at,
      updated_at: announcement.updated_at
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
