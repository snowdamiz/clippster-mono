defmodule ClippsterServerWeb.MessagingController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Messaging
  alias ClippsterServer.{Storage, ImageProcessor}
  alias ClippsterServerWeb.MessagingJSON

  action_fallback ClippsterServerWeb.FallbackController

  # ============================================================================
  # Organization-scoped endpoints
  # ============================================================================

  @doc """
  List all conversations for the current user in an organization.
  """
  def list_conversations(conn, %{"organization_id" => org_id}) do
    user_id = conn.assigns.current_user.id
    conversations = Messaging.list_user_conversations(org_id, user_id)
    unread_counts = Messaging.get_unread_counts(org_id, user_id)

    json(conn, %{
      data: MessagingJSON.conversations_with_unread(conversations, unread_counts)
    })
  end

  @doc """
  Create a direct conversation with another user.
  """
  def create_direct(conn, %{"organization_id" => org_id, "user_id" => other_user_id}) do
    user_id = conn.assigns.current_user.id
    # Ensure IDs are integers (may come as strings from JSON/URL params)
    org_id = if is_binary(org_id), do: String.to_integer(org_id), else: org_id

    other_user_id =
      if is_binary(other_user_id), do: String.to_integer(other_user_id), else: other_user_id

    case Messaging.create_direct_conversation(org_id, user_id, other_user_id) do
      {:ok, conversation} ->
        conn
        |> put_status(:created)
        |> json(%{data: MessagingJSON.conversation(conversation)})

      {:error, :cannot_message_self} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "You cannot start a conversation with yourself"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Create a group conversation.
  """
  def create_group(conn, %{
        "organization_id" => org_id,
        "name" => name,
        "member_ids" => member_ids
      }) do
    user_id = conn.assigns.current_user.id

    case Messaging.create_group_conversation(org_id, name, user_id, member_ids) do
      {:ok, conversation} ->
        # Broadcast to all participants
        broadcast_conversation_created(conversation)

        conn
        |> put_status(:created)
        |> json(%{data: MessagingJSON.conversation(conversation)})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Create an announcement (admin/owner only).
  """
  def create_announcement(conn, %{"organization_id" => org_id, "content" => content}) do
    user_id = conn.assigns.current_user.id

    case Messaging.create_announcement(org_id, user_id, content) do
      {:ok, conversation} ->
        # Broadcast to all participants
        broadcast_conversation_created(conversation)

        conn
        |> put_status(:created)
        |> json(%{data: MessagingJSON.conversation(conversation)})

      {:error, :unauthorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Only admins can send announcements"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Get unread counts for all conversations in an organization.
  """
  def get_unread_counts(conn, %{"organization_id" => org_id}) do
    user_id = conn.assigns.current_user.id
    counts = Messaging.get_unread_counts(org_id, user_id)

    json(conn, %{data: MessagingJSON.unread_counts(counts)})
  end

  # ============================================================================
  # Conversation-specific endpoints
  # ============================================================================

  @doc """
  Get a specific conversation.
  """
  def get_conversation(conn, %{"id" => conversation_id}) do
    user_id = conn.assigns.current_user.id

    case Messaging.get_conversation_for_user(conversation_id, user_id) do
      {:ok, conversation} ->
        json(conn, %{data: MessagingJSON.conversation(conversation)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Conversation not found"})

      {:error, :not_participant} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Not a participant in this conversation"})
    end
  end

  @doc """
  Get messages for a conversation (paginated).
  """
  def get_messages(conn, %{"id" => conversation_id} = params) do
    user_id = conn.assigns.current_user.id

    case Messaging.get_conversation_for_user(conversation_id, user_id) do
      {:ok, _conversation} ->
        opts = [
          limit: Map.get(params, "limit", "50") |> String.to_integer(),
          before: Map.get(params, "before")
        ]

        messages = Messaging.get_messages(conversation_id, opts)
        json(conn, %{data: MessagingJSON.messages(messages)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Conversation not found"})

      {:error, :not_participant} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Not a participant in this conversation"})
    end
  end

  @doc """
  Send a message to a conversation.
  """
  def send_message(conn, %{"id" => conversation_id, "content" => content}) do
    user_id = conn.assigns.current_user.id

    case Messaging.send_message(conversation_id, user_id, content) do
      {:ok, message} ->
        # Broadcast via channel
        broadcast_new_message(conversation_id, message)

        conn
        |> put_status(:created)
        |> json(%{data: MessagingJSON.message(message)})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Edit a message.
  """
  def edit_message(conn, %{
        "id" => _conversation_id,
        "message_id" => message_id,
        "content" => content
      }) do
    user_id = conn.assigns.current_user.id

    case Messaging.edit_message(message_id, user_id, content) do
      {:ok, message} ->
        conn
        |> json(%{data: MessagingJSON.message(message)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Message not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Can only edit your own messages"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Delete a message.
  """
  def delete_message(conn, %{"id" => _conversation_id, "message_id" => message_id}) do
    user_id = conn.assigns.current_user.id

    case Messaging.delete_message(message_id, user_id) do
      {:ok, _message} ->
        conn
        |> put_status(:no_content)
        |> send_resp(:no_content, "")

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Message not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Cannot delete this message"})
    end
  end

  @doc """
  Mark conversation as read.
  """
  def mark_read(conn, %{"id" => conversation_id}) do
    user_id = conn.assigns.current_user.id

    case Messaging.mark_as_read(conversation_id, user_id) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Toggle mute for a conversation.
  """
  def toggle_mute(conn, %{"id" => conversation_id}) do
    user_id = conn.assigns.current_user.id

    case Messaging.toggle_mute(conversation_id, user_id) do
      {:ok, participant} ->
        json(conn, %{data: %{muted: participant.muted}})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Not a participant in this conversation"})
    end
  end

  @doc """
  Add a participant to a group conversation.
  """
  def add_participant(conn, %{"id" => conversation_id, "user_id" => new_user_id}) do
    user_id = conn.assigns.current_user.id
    # Ensure IDs are integers (may come as strings from JSON/URL params)
    conversation_id =
      if is_binary(conversation_id), do: String.to_integer(conversation_id), else: conversation_id

    new_user_id = if is_binary(new_user_id), do: String.to_integer(new_user_id), else: new_user_id

    case Messaging.add_participant(conversation_id, new_user_id, user_id) do
      {:ok, participant} ->
        conn
        |> put_status(:created)
        |> json(%{data: MessagingJSON.participant(participant)})

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Only admins can add participants"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Remove a participant from a group conversation.
  """
  def remove_participant(conn, %{"id" => conversation_id, "user_id" => target_user_id}) do
    user_id = conn.assigns.current_user.id
    # Ensure IDs are integers (may come as strings from URL params)
    conversation_id =
      if is_binary(conversation_id), do: String.to_integer(conversation_id), else: conversation_id

    target_user_id =
      if is_binary(target_user_id), do: String.to_integer(target_user_id), else: target_user_id

    case Messaging.remove_participant(conversation_id, target_user_id, user_id) do
      :ok ->
        conn
        |> put_status(:no_content)
        |> send_resp(:no_content, "")

      {:error, :not_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Only admins can remove participants"})

      {:error, :cannot_kick_org_admin} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Cannot remove organization admins from this conversation"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Leave a group conversation.
  """
  def leave_conversation(conn, %{"id" => conversation_id}) do
    user_id = conn.assigns.current_user.id

    case Messaging.leave_conversation(conversation_id, user_id) do
      :ok ->
        conn
        |> put_status(:no_content)
        |> send_resp(:no_content, "")

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Not a participant in this conversation"})
    end
  end

  @doc """
  Delete a conversation (only conversation creator can delete).
  """
  def delete_conversation(conn, %{"id" => conversation_id}) do
    user_id = conn.assigns.current_user.id

    case Messaging.delete_conversation(conversation_id, user_id) do
      {:ok, _} ->
        # Broadcast conversation deleted to all participants
        broadcast_conversation_deleted(conversation_id)

        conn
        |> put_status(:no_content)
        |> send_resp(:no_content, "")

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Conversation not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Only the conversation creator can delete this conversation"})
    end
  end

  defp broadcast_conversation_deleted(conversation_id) do
    ClippsterServerWeb.Endpoint.broadcast(
      "messaging:conversation:#{conversation_id}",
      "conversation_deleted",
      %{conversation_id: conversation_id}
    )
  end

  # ============================================================================
  # User-level endpoints
  # ============================================================================

  @doc """
  List all conversations for the current user across all organizations.
  """
  def list_all_conversations(conn, _params) do
    user_id = conn.assigns.current_user.id
    conversations = Messaging.list_conversations_for_user(user_id)
    unread_counts = Messaging.get_unread_counts_for_user(user_id)

    json(conn, %{data: MessagingJSON.conversations_with_unread(conversations, unread_counts)})
  end

  @doc """
  Get total unread count across all organizations.
  """
  def get_total_unread(conn, _params) do
    user_id = conn.assigns.current_user.id
    count = Messaging.get_total_unread_count(user_id)

    json(conn, %{data: %{unread_count: count}})
  end

  @doc """
  Search for users that the current user can message.
  Role-based filtering:
  - Admins/moderators can search all users
  - Organization owners can search all users
  - Regular users can only search users in their organizations
  """
  def search_users(conn, params) do
    user_id = conn.assigns.current_user.id
    query = Map.get(params, "query", "")
    limit = Map.get(params, "limit", "20") |> String.to_integer()

    users = Messaging.search_messageable_users(user_id, query, limit: limit)

    json(conn, %{data: users})
  end

  @doc """
  Create a global direct conversation with another user (not scoped to an organization).
  """
  def create_global_direct(conn, %{"user_id" => other_user_id}) do
    user_id = conn.assigns.current_user.id
    # Ensure other_user_id is an integer (may come as string from JSON)
    other_user_id =
      if is_binary(other_user_id), do: String.to_integer(other_user_id), else: other_user_id

    case Messaging.create_global_direct_conversation(user_id, other_user_id) do
      {:ok, conversation} ->
        conn
        |> put_status(:created)
        |> json(%{data: MessagingJSON.conversation(conversation)})

      {:error, :cannot_message_self} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "You cannot start a conversation with yourself"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  @doc """
  Upload attachments for a conversation.
  Accepts multiple image files, processes them (compress + thumbnail), uploads to R2.
  """
  def upload_attachments(conn, %{"conversation_id" => conversation_id} = params) do
    user_id = conn.assigns.current_user.id

    conversation_id =
      if is_binary(conversation_id), do: String.to_integer(conversation_id), else: conversation_id

    # Verify user is a participant in the conversation
    case Messaging.get_conversation_for_user(conversation_id, user_id) do
      {:error, _} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You are not a participant in this conversation"})

      {:ok, conversation} ->
        # Debug: Log received params
        IO.inspect(params, label: "Upload params")

        # Get uploaded files (can be single or multiple)
        files =
          case params do
            %{"files" => files} when is_list(files) -> files
            %{"files" => file} -> [file]
            %{"file" => file} -> [file]
            _ -> []
          end

        IO.inspect(files, label: "Parsed files")

        if Enum.empty?(files) do
          conn
          |> put_status(:bad_request)
          |> json(%{error: "No files provided"})
        else
          # Process each file - handle pattern match errors
          results =
            Enum.map(files, fn file ->
              case file do
                %Plug.Upload{path: temp_path, filename: filename, content_type: content_type} ->
                  IO.inspect({temp_path, filename, content_type}, label: "Processing file")

                  result =
                    process_and_upload_attachment(conversation, filename, temp_path, content_type)

                  IO.inspect(result, label: "Processing result")
                  result

                other ->
                  IO.inspect(other, label: "Invalid file format")
                  {:error, "Invalid file format: expected Plug.Upload, got #{inspect(other)}"}
              end
            end)

          # Check for errors
          errors = Enum.filter(results, fn {status, _} -> status == :error end)
          IO.inspect(errors, label: "Errors found")

          if Enum.empty?(errors) do
            attachments = Enum.map(results, fn {:ok, attachment} -> attachment end)

            json(conn, %{
              success: true,
              attachments: Enum.map(attachments, &MessagingJSON.attachment/1)
            })
          else
            error_messages = Enum.map(errors, fn {:error, msg} -> msg end)

            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "Failed to process some files", details: error_messages})
          end
        end
    end
  end

  @doc """
  Download a message attachment.
  Returns a presigned URL redirect.
  """
  def download_attachment(conn, %{"id" => attachment_id}) do
    attachment_id =
      if is_binary(attachment_id), do: String.to_integer(attachment_id), else: attachment_id

    case Messaging.get_message_attachment(attachment_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Attachment not found"})

      attachment ->
        # Generate presigned URL for download
        case Storage.presigned_url(attachment.url, expires_in: 3600) do
          {:ok, presigned_url} ->
            redirect(conn, external: presigned_url)

          {:error, _} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to generate download URL"})
        end
    end
  end

  # ============================================================================
  # Private helpers
  # ============================================================================

  defp process_and_upload_attachment(conversation, filename, temp_path, content_type) do
    # Validate image type first
    unless ImageProcessor.valid_image_type?(content_type) do
      {:error, "Invalid image type: #{content_type}"}
    else
      # Read file binary with better error handling
      case File.read(temp_path) do
        {:ok, file_binary} ->
          # Process the image
          case ImageProcessor.process_image(file_binary, content_type) do
            {:ok, processed} ->
              org_id = conversation.organization_id || 0

              full_key =
                Storage.generate_message_attachment_key(org_id, conversation.id, filename, "full")

              thumb_key =
                Storage.generate_message_attachment_key(
                  org_id,
                  conversation.id,
                  filename,
                  "thumbnail"
                )

              # Upload to R2
              with {:ok, full_url} <-
                     Storage.upload_file(processed.compressed, full_key,
                       content_type: "image/jpeg"
                     ),
                   {:ok, thumb_url} <-
                     Storage.upload_file(processed.thumbnail, thumb_key,
                       content_type: "image/jpeg"
                     ) do
                # Return attachment metadata
                {:ok,
                 %{
                   url: full_url,
                   thumbnail_url: thumb_url,
                   filename: filename,
                   mime_type: "image/jpeg",
                   file_size: byte_size(processed.compressed),
                   width: processed.width,
                   height: processed.height,
                   attachment_type: "image"
                 }}
              else
                {:error, reason} -> {:error, "Failed to upload to storage: #{inspect(reason)}"}
              end

            {:error, reason} ->
              {:error, "Failed to process image: #{inspect(reason)}"}
          end

        {:error, reason} ->
          {:error, "Failed to read uploaded file at #{temp_path}: #{inspect(reason)}"}
      end
    end
  end

  defp broadcast_conversation_created(conversation) do
    Enum.each(conversation.participants, fn participant ->
      if is_nil(participant.left_at) do
        ClippsterServerWeb.Endpoint.broadcast(
          "messaging:user:#{participant.user_id}",
          "conversation_created",
          MessagingJSON.conversation(conversation)
        )
      end
    end)
  end

  defp broadcast_new_message(conversation_id, message) do
    ClippsterServerWeb.Endpoint.broadcast(
      "messaging:conversation:#{conversation_id}",
      "new_message",
      MessagingJSON.message(message)
    )

    # Also notify user channels for participants not in the conversation channel
    case Messaging.get_conversation(conversation_id) do
      nil ->
        :ok

      conversation ->
        Enum.each(conversation.participants, fn participant ->
          if is_nil(participant.left_at) do
            ClippsterServerWeb.Endpoint.broadcast(
              "messaging:user:#{participant.user_id}",
              "new_message_notification",
              %{
                conversation_id: conversation_id,
                message: MessagingJSON.message(message)
              }
            )
          end
        end)
    end
  end
end
