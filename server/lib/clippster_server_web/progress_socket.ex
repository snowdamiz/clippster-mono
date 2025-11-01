defmodule ClippsterServerWeb.ProgressSocket do
  use Phoenix.Socket

  ## Channels
  channel "progress:*", ClippsterServerWeb.ProgressChannel

  # Socket params are passed from the client and can
  # be used to verify and authenticate a user.
  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  # Socket id's are topics that allow you to identify all sockets for a given user:
  #
  #     def id(socket), do: "user_socket:#{socket.assigns.user_id}"
  #
  # Would allow you to broadcast a "disconnect" event and terminate
  # all active sockets and channels for a given user:
  #
  #     ClippsterServerWeb.Endpoint.broadcast("user_socket:#{user_id}", "disconnect", %{})
  #
  # Returning `nil` makes this socket anonymous.
  @impl true
  def id(_socket), do: nil
end