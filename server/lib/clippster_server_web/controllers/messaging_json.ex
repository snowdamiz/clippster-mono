defmodule ClippsterServerWeb.MessagingJSON do
  @moduledoc """
  JSON rendering for messaging resources.
  """

  alias ClippsterServer.Messaging.{
    Conversation,
    ConversationParticipant,
    Message,
    MessageAttachment
  }

  alias ClippsterServer.Storage

  def conversation(%Conversation{} = conversation) do
    %{
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      organization_id: conversation.organization_id,
      created_by_user_id: conversation.created_by_user_id,
      last_message_at: conversation.last_message_at,
      last_message_preview: conversation.last_message_preview,
      status: conversation.status,
      archived_at: conversation.archived_at,
      archived_by_user_id: conversation.archived_by_user_id,
      scheduled_deletion_at: conversation.scheduled_deletion_at,
      created_at: conversation.inserted_at,
      participants: render_participants(conversation.participants)
    }
  end

  def conversation_with_unread(%Conversation{} = conversation, unread_count, muted) do
    conversation
    |> conversation()
    |> Map.put(:unread_count, unread_count)
    |> Map.put(:muted, muted)
  end

  def conversations(conversations) do
    Enum.map(conversations, &conversation/1)
  end

  def conversations_with_unread(conversations, unread_counts) do
    Enum.map(conversations, fn conv ->
      participant =
        Enum.find(conv.participants, &(&1.user_id == conv.created_by_user_id)) ||
          List.first(conv.participants)

      muted = if participant, do: participant.muted, else: false
      unread = Map.get(unread_counts, conv.id, 0)
      conversation_with_unread(conv, unread, muted)
    end)
  end

  def participant(%ConversationParticipant{} = participant) do
    %{
      id: participant.id,
      user_id: participant.user_id,
      role: participant.role,
      joined_at: participant.joined_at,
      muted: participant.muted,
      user: render_user(participant.user)
    }
  end

  defp render_participants(nil), do: []

  defp render_participants(participants) when is_list(participants) do
    participants
    |> Enum.filter(&is_nil(&1.left_at))
    |> Enum.map(&participant/1)
  end

  def message(%Message{} = message) do
    %{
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      content: message.content,
      message_type: message.message_type,
      edited_at: message.edited_at,
      deleted_at: message.deleted_at,
      inserted_at: message.inserted_at,
      sender: render_user(message.sender),
      read_by: render_read_by(message.read_statuses),
      attachments: render_attachments(message.attachments)
    }
  end

  def attachment(%MessageAttachment{} = attachment) do
    %{
      id: attachment.id,
      attachment_type: attachment.attachment_type,
      url: Storage.presigned_url!(attachment.url),
      thumbnail_url: attachment.thumbnail_url && Storage.presigned_url!(attachment.thumbnail_url),
      filename: attachment.filename,
      mime_type: attachment.mime_type,
      file_size: attachment.file_size,
      width: attachment.width,
      height: attachment.height
    }
  end

  def attachment(attachment_map) when is_map(attachment_map) do
    %{
      attachment_type: attachment_map.attachment_type || attachment_map[:attachment_type],
      url: attachment_map.url || attachment_map[:url],
      thumbnail_url: attachment_map.thumbnail_url || attachment_map[:thumbnail_url],
      filename: attachment_map.filename || attachment_map[:filename],
      mime_type: attachment_map.mime_type || attachment_map[:mime_type],
      file_size: attachment_map.file_size || attachment_map[:file_size],
      width: attachment_map.width || attachment_map[:width],
      height: attachment_map.height || attachment_map[:height]
    }
  end

  def messages(messages) do
    Enum.map(messages, &message/1)
  end

  defp render_user(nil), do: nil
  defp render_user(%Ecto.Association.NotLoaded{}), do: nil

  defp render_user(user) do
    %{
      id: user.id,
      display_name: user.name,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin || false,
      is_moderator: user.is_moderator || false
    }
  end

  defp render_read_by(nil), do: []
  defp render_read_by(%Ecto.Association.NotLoaded{}), do: []

  defp render_read_by(read_statuses) do
    Enum.map(read_statuses, & &1.user_id)
  end

  defp render_attachments(nil), do: []
  defp render_attachments(%Ecto.Association.NotLoaded{}), do: []

  defp render_attachments(attachments) when is_list(attachments) do
    Enum.map(attachments, &attachment/1)
  end

  def unread_counts(counts) do
    counts
  end
end
