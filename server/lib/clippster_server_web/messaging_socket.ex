defmodule ClippsterServerWeb.MessagingSocket do
  use Phoenix.Socket

  alias ClippsterServer.Accounts

  ## Channels
  channel "messaging:user:*", ClippsterServerWeb.MessagingChannel
  channel "messaging:conversation:*", ClippsterServerWeb.MessagingChannel
  channel "announcements:lobby", ClippsterServerWeb.AnnouncementsChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Accounts.verify_token(token) do
      {:ok, user} ->
        {:ok, assign(socket, :user_id, user.id)}

      {:error, _reason} ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info) do
    :error
  end

  @impl true
  def id(socket), do: "messaging_socket:#{socket.assigns.user_id}"
end
