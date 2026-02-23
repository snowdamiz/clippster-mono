defmodule ClippsterServerWeb.AnnouncementsChannel do
  use Phoenix.Channel

  @doc """
  Join the announcements lobby channel.
  Any authenticated user can join.
  """
  def join("announcements:lobby", _params, socket) do
    {:ok, socket}
  end

  def join(_topic, _params, _socket) do
    {:error, %{reason: "unauthorized"}}
  end

  @doc """
  Called by the Announcements context via PubSub when a new announcement is published.
  Broadcasts to all connected clients.
  """
  def handle_info({:new_announcement, announcement}, socket) do
    broadcast!(socket, "new_announcement", %{
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      type: announcement.type,
      audience: announcement.audience,
      published_at: announcement.published_at
    })

    {:noreply, socket}
  end
end
