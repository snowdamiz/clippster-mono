defmodule ClippsterServerWeb.StaffController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Messaging
  alias ClippsterServer.Accounts

  @doc """
  Lists all staff conversations for the current staff member.
  """
  def list_conversations(conn, _params) do
    user_id = conn.assigns[:current_user_id]

    conversations = Messaging.list_staff_conversations(user_id)
    json(conn, %{conversations: conversations})
  end

  @doc """
  Creates a direct staff conversation between two staff members.
  """
  def create_direct(conn, %{"target_user_id" => target_user_id_string}) do
    user_id = conn.assigns[:current_user_id]

    case parse_integer(target_user_id_string) do
      {:ok, target_user_id} ->
        # Verify target is staff
        target_user = Accounts.get_user(target_user_id)

        if is_nil(target_user) do
          conn
          |> put_status(:not_found)
          |> json(%{error: "Target user not found"})
        else
          if target_user.is_admin or target_user.is_moderator do
            case Messaging.create_staff_direct_conversation(user_id, target_user_id) do
              {:ok, conversation} ->
                json(conn, %{conversation: conversation})

              {:error, reason} ->
                conn
                |> put_status(:internal_server_error)
                |> json(%{error: "Failed to create conversation: #{inspect(reason)}"})
            end
          else
            conn
            |> put_status(:forbidden)
            |> json(%{error: "Target user is not a staff member"})
          end
        end

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid user ID"})
    end
  end

  @doc """
  Creates a group staff conversation.
  """
  def create_group(conn, %{"name" => name, "participant_ids" => participant_ids}) do
    user_id = conn.assigns[:current_user_id]

    # Verify all participants are staff
    participants = Enum.map(participant_ids, &Accounts.get_user/1)

    if Enum.any?(participants, &is_nil/1) do
      conn
      |> put_status(:not_found)
      |> json(%{error: "One or more participants not found"})
    else
      if Enum.all?(participants, fn u -> u.is_admin or u.is_moderator end) do
        case Messaging.create_staff_group_conversation(user_id, name, participant_ids) do
          {:ok, conversation} ->
            json(conn, %{conversation: conversation})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to create group: #{inspect(reason)}"})
        end
      else
        conn
        |> put_status(:forbidden)
        |> json(%{error: "All participants must be staff members"})
      end
    end
  end

  @doc """
  Gets messages for a staff conversation.
  """
  def get_messages(conn, %{"id" => conversation_id_string} = params) do
    user_id = conn.assigns[:current_user_id]

    case parse_integer(conversation_id_string) do
      {:ok, conversation_id} ->
        # Verify user is participant
        if Messaging.is_conversation_participant?(conversation_id, user_id) do
          limit = Map.get(params, "limit", "50") |> String.to_integer()
          offset = Map.get(params, "offset", "0") |> String.to_integer()

          messages = Messaging.get_conversation_messages(conversation_id, limit, offset)
          json(conn, %{messages: messages})
        else
          conn
          |> put_status(:forbidden)
          |> json(%{error: "Not a participant in this conversation"})
        end

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid conversation ID"})
    end
  end

  @doc """
  Sends a message to a staff conversation.
  """
  def send_message(conn, %{"id" => conversation_id_string, "content" => content}) do
    user_id = conn.assigns[:current_user_id]

    case parse_integer(conversation_id_string) do
      {:ok, conversation_id} ->
        # Verify user is participant
        if Messaging.is_conversation_participant?(conversation_id, user_id) do
          case Messaging.send_message(conversation_id, user_id, content) do
            {:ok, message} ->
              json(conn, %{message: message})

            {:error, reason} ->
              conn
              |> put_status(:internal_server_error)
              |> json(%{error: "Failed to send message: #{inspect(reason)}"})
          end
        else
          conn
          |> put_status(:forbidden)
          |> json(%{error: "Not a participant in this conversation"})
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
