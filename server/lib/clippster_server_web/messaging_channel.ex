defmodule ClippsterServerWeb.MessagingChannel do
  use Phoenix.Channel

  alias ClippsterServer.Messaging
  alias ClippsterServerWeb.MessagingJSON

  @doc """
  Join a messaging channel.
  - `messaging:user:<user_id>` - Personal notification channel
  - `messaging:conversation:<conversation_id>` - Conversation channel
  """
  def join(topic, params, socket)

  def join("messaging:user:" <> user_id, _params, socket) do
    if socket.assigns.user_id == String.to_integer(user_id) do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def join("messaging:conversation:" <> conversation_id, _params, socket) do
    conversation_id = String.to_integer(conversation_id)

    if Messaging.is_participant?(conversation_id, socket.assigns.user_id) do
      socket = assign(socket, :conversation_id, conversation_id)
      {:ok, socket}
    else
      {:error, %{reason: "not_a_participant"}}
    end
  end

  @doc """
  Handle incoming messages from clients.
  Supported events: new_message, edit_message, delete_message, typing, mark_read
  """
  def handle_in(event, payload, socket)

  def handle_in("new_message", %{"content" => content}, socket) do
    conversation_id = socket.assigns.conversation_id
    user_id = socket.assigns.user_id

    case Messaging.send_message(conversation_id, user_id, content) do
      {:ok, message} ->
        broadcast!(socket, "new_message", MessagingJSON.message(message))
        
        # Also broadcast to user channels for participants (for notifications)
        broadcast_to_participants(conversation_id, "new_message_notification", %{
          conversation_id: conversation_id,
          message: MessagingJSON.message(message)
        })
        
        {:reply, {:ok, MessagingJSON.message(message)}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  def handle_in("edit_message", %{"message_id" => message_id, "content" => content}, socket) do
    user_id = socket.assigns.user_id

    case Messaging.edit_message(message_id, user_id, content) do
      {:ok, message} ->
        broadcast!(socket, "message_edited", MessagingJSON.message(message))
        {:reply, {:ok, MessagingJSON.message(message)}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  def handle_in("delete_message", %{"message_id" => message_id}, socket) do
    user_id = socket.assigns.user_id

    case Messaging.delete_message(message_id, user_id) do
      {:ok, _message} ->
        broadcast!(socket, "message_deleted", %{message_id: message_id})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  def handle_in("typing", _payload, socket) do
    broadcast_from!(socket, "user_typing", %{
      user_id: socket.assigns.user_id
    })

    {:noreply, socket}
  end

  def handle_in("mark_read", _payload, socket) do
    conversation_id = socket.assigns.conversation_id
    user_id = socket.assigns.user_id

    case Messaging.mark_as_read(conversation_id, user_id) do
      {:ok, _} ->
        broadcast!(socket, "message_read", %{
          user_id: user_id,
          conversation_id: conversation_id
        })
        {:noreply, socket}

      {:error, _reason} ->
        {:noreply, socket}
    end
  end

  # Broadcast to all participant user channels
  defp broadcast_to_participants(conversation_id, event, payload) do
    case Messaging.get_conversation(conversation_id) do
      nil ->
        :ok

      conversation ->
        Enum.each(conversation.participants, fn participant ->
          if is_nil(participant.left_at) do
            ClippsterServerWeb.Endpoint.broadcast(
              "messaging:user:#{participant.user_id}",
              event,
              payload
            )
          end
        end)
    end
  end
end
