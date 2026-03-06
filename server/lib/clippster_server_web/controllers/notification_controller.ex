defmodule ClippsterServerWeb.NotificationController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Notifications

  @doc """
  List notifications for the current user.
  """
  def index(conn, params) do
    user = conn.assigns.current_user
    limit = Map.get(params, "limit", "50") |> String.to_integer()
    unread_only = Map.get(params, "unread_only", "false") == "true"

    notifications =
      Notifications.list_user_notifications(user.id, limit: limit, unread_only: unread_only)

    json(conn, %{
      success: true,
      notifications: Enum.map(notifications, &serialize_notification/1)
    })
  end

  @doc """
  Get unread notification count.
  """
  def unread_count(conn, _params) do
    user = conn.assigns.current_user
    count = Notifications.get_unread_count(user.id)

    json(conn, %{success: true, count: count})
  end

  @doc """
  Mark notification as read.
  """
  def mark_read(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Notifications.mark_as_read(String.to_integer(id), user.id) do
      {:ok, notification} ->
        json(conn, %{success: true, notification: serialize_notification(notification)})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Notification not found"})
    end
  end

  @doc """
  Mark all notifications as read.
  """
  def mark_all_read(conn, _params) do
    user = conn.assigns.current_user
    {count, _} = Notifications.mark_all_as_read(user.id)

    json(conn, %{success: true, marked_read: count})
  end

  defp serialize_notification(notification) do
    %{
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      action_url: notification.action_url,
      read_at: notification.read_at,
      inserted_at: notification.inserted_at
    }
  end
end
