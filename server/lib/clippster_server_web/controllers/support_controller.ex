defmodule ClippsterServerWeb.SupportController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Messaging
  alias ClippsterServer.ModLogs
  alias ClippsterServerWeb.MessagingJSON

  @doc """
  Checks if a support conversation exists for the current user (read-only, no creation).
  """
  def check(conn, _params) do
    user_id = conn.assigns[:current_user_id]

    case Messaging.check_support_conversation(user_id) do
      {:ok, nil} ->
        json(conn, %{conversation: nil})

      {:ok, conversation} ->
        json(conn, %{conversation: MessagingJSON.conversation(conversation)})
    end
  end

  @doc """
  Gets or creates a support conversation for the current user.
  """
  def get_or_create(conn, _params) do
    user_id = conn.assigns[:current_user_id]

    case Messaging.get_or_create_support_conversation(user_id) do
      {:ok, conversation} ->
        json(conn, %{conversation: MessagingJSON.conversation(conversation)})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to create support conversation: #{inspect(reason)}"})
    end
  end

  @doc """
  Sends a message to the user's support conversation.
  """
  def send_message(conn, %{"content" => content}) do
    user_id = conn.assigns[:current_user_id]

    case Messaging.send_support_message(user_id, content) do
      {:ok, message} ->
        json(conn, %{message: message})

      {:error, :conversation_not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Support conversation not found"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to send message: #{inspect(reason)}"})
    end
  end

  @doc """
  Gets messages for the user's support conversation.
  """
  def get_messages(conn, params) do
    user_id = conn.assigns[:current_user_id]
    limit = Map.get(params, "limit", "50") |> String.to_integer()
    offset = Map.get(params, "offset", "0") |> String.to_integer()

    case Messaging.get_user_support_conversation(user_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Support conversation not found"})

      conversation ->
        messages = Messaging.get_conversation_messages(conversation.id, limit, offset)
        json(conn, %{messages: messages})
    end
  end

  @doc """
  Returns the total count of unread support messages for the current admin/mod user.
  """
  def unread_count(conn, _params) do
    user_id = conn.assigns[:current_user_id]
    count = Messaging.count_unread_support_messages(user_id)
    json(conn, %{unread_count: count})
  end

  @doc """
  Lists all support conversations (admin/mod only).
  """
  def list_all(conn, params) do
    status = Map.get(params, "status", "open")
    page = Map.get(params, "page", "1") |> String.to_integer()
    per_page = Map.get(params, "per_page", "50") |> String.to_integer()

    conversations = Messaging.list_support_conversations(status, page, per_page)
    total = Messaging.count_support_conversations(status)

    json(conn, %{
      conversations: Enum.map(conversations, &MessagingJSON.conversation/1),
      total: total,
      page: page,
      per_page: per_page
    })
  end

  @doc """
  Gets messages for a specific support conversation (admin/mod only).
  """
  def get_conversation_messages(conn, %{"id" => conversation_id_string} = params) do
    case parse_integer(conversation_id_string) do
      {:ok, conversation_id} ->
        limit = Map.get(params, "limit", "50") |> String.to_integer()
        offset = Map.get(params, "offset", "0") |> String.to_integer()

        messages = Messaging.get_conversation_messages(conversation_id, limit, offset)
        json(conn, %{messages: MessagingJSON.messages(messages)})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid conversation ID"})
    end
  end

  @doc """
  Responds to a support conversation (admin/mod only).
  """
  def respond(conn, %{"id" => conversation_id_string, "content" => content}) do
    moderator_id = conn.assigns[:current_user_id]

    case parse_integer(conversation_id_string) do
      {:ok, conversation_id} ->
        case Messaging.send_support_response(conversation_id, moderator_id, content) do
          {:ok, message} ->
            # Log moderator action
            ModLogs.log_action(
              moderator_id,
              "respond_to_support",
              "support_conversation",
              conversation_id,
              %{content_preview: String.slice(content, 0, 100)}
            )

            json(conn, %{message: MessagingJSON.message(message)})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to send response: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid conversation ID"})
    end
  end

  @doc """
  Archives a support conversation (admin/mod only).
  """
  def archive(conn, %{"id" => conversation_id_string}) do
    moderator_id = conn.assigns[:current_user_id]

    case parse_integer(conversation_id_string) do
      {:ok, conversation_id} ->
        case Messaging.archive_support_conversation(conversation_id, moderator_id) do
          {:ok, conversation} ->
            # Log moderator action
            ModLogs.log_action(
              moderator_id,
              "archive_support_conversation",
              "support_conversation",
              conversation_id,
              %{}
            )

            json(conn, %{conversation: conversation})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to archive conversation: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid conversation ID"})
    end
  end

  @doc """
  Marks a support conversation as read (admin/mod only).
  """
  def mark_read(conn, %{"id" => conversation_id_string}) do
    user_id = conn.assigns[:current_user_id]

    case parse_integer(conversation_id_string) do
      {:ok, conversation_id} ->
        case Messaging.mark_conversation_read(conversation_id, user_id) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to mark as read: #{inspect(reason)}"})
        end

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid conversation ID"})
    end
  end

  defp parse_integer(string) do
    case Integer.parse(string) do
      {int, ""} -> {:ok, int}
      _ -> {:error, :invalid_integer}
    end
  end
end
