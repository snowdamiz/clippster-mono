defmodule ClippsterServer.Messaging do
  @moduledoc """
  Context for organization messaging system.
  Handles conversations, messages, and read status tracking.
  All messaging is organization-scoped - users can only message others in the same org.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Organizations
  alias ClippsterServer.Messaging.{Conversation, ConversationParticipant, Message, MessageReadStatus}

  # ============================================================================
  # Conversations
  # ============================================================================

  @doc """
  Creates a direct conversation between two users in an organization.
  Returns existing conversation if one already exists.
  """
  def create_direct_conversation(organization_id, user1_id, user2_id) do
    # Verify both users are members of the organization
    with :ok <- verify_org_membership(organization_id, user1_id),
         :ok <- verify_org_membership(organization_id, user2_id) do
      # Check if direct conversation already exists between these users
      case find_existing_direct_conversation(organization_id, user1_id, user2_id) do
        nil ->
          create_conversation_with_participants(
            %{
              type: "direct",
              organization_id: organization_id,
              created_by_user_id: user1_id
            },
            [user1_id, user2_id]
          )

        conversation ->
          {:ok, conversation}
      end
    end
  end

  @doc """
  Creates a group conversation with the specified members.
  """
  def create_group_conversation(organization_id, name, creator_id, member_ids) do
    # Ensure creator is in the member list
    all_member_ids = Enum.uniq([creator_id | member_ids])

    # Verify all users are members of the organization
    with :ok <- verify_all_org_memberships(organization_id, all_member_ids) do
      create_conversation_with_participants(
        %{
          type: "group",
          name: name,
          organization_id: organization_id,
          created_by_user_id: creator_id
        },
        all_member_ids,
        creator_id
      )
    end
  end

  @doc """
  Creates an announcement conversation that includes all organization members.
  Only admins/owners can create announcements.
  """
  def create_announcement(organization_id, creator_id, content) do
    with :ok <- verify_can_send_announcement(organization_id, creator_id) do
      # Get all organization members
      member_ids = get_org_member_ids(organization_id)

      Repo.transaction(fn ->
        # Create the announcement conversation
        {:ok, conversation} =
          create_conversation_with_participants(
            %{
              type: "announcement",
              organization_id: organization_id,
              created_by_user_id: creator_id
            },
            member_ids,
            creator_id
          )

        # Send the initial announcement message
        {:ok, _message} = send_message(conversation.id, creator_id, content)

        Repo.preload(conversation, [:participants, :messages])
      end)
    end
  end

  @doc """
  Gets a conversation by ID with preloaded associations.
  """
  def get_conversation(id) do
    Conversation
    |> Repo.get(id)
    |> Repo.preload([:participants, participants: :user])
  end

  @doc """
  Gets a conversation by ID, verifying the user is a participant.
  """
  def get_conversation_for_user(conversation_id, user_id) do
    case get_conversation(conversation_id) do
      nil ->
        {:error, :not_found}

      conversation ->
        if is_participant?(conversation_id, user_id) do
          {:ok, conversation}
        else
          {:error, :not_participant}
        end
    end
  end

  @doc """
  Lists all conversations for a user in an organization.
  """
  def list_user_conversations(organization_id, user_id) do
    Conversation
    |> join(:inner, [c], p in ConversationParticipant, on: p.conversation_id == c.id)
    |> where([c, p], c.organization_id == ^organization_id)
    |> where([c, p], p.user_id == ^user_id)
    |> where([c, p], is_nil(p.left_at))
    |> order_by([c, p], desc: c.last_message_at)
    |> preload([:participants, participants: :user])
    |> Repo.all()
  end

  @doc """
  Lists all conversations for a user across all organizations.
  """
  def list_conversations_for_user(user_id) do
    Conversation
    |> join(:inner, [c], p in ConversationParticipant, on: p.conversation_id == c.id)
    |> where([c, p], p.user_id == ^user_id)
    |> where([c, p], is_nil(p.left_at))
    |> order_by([c, p], desc: c.last_message_at)
    |> preload([:organization, participants: :user])
    |> Repo.all()
  end

  # ============================================================================
  # Messages
  # ============================================================================

  @doc """
  Sends a message to a conversation.
  """
  def send_message(conversation_id, sender_id, content) do
    with {:ok, _} <- get_conversation_for_user(conversation_id, sender_id) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      preview = String.slice(content, 0, 100)

      Repo.transaction(fn ->
        # Create the message
        {:ok, message} =
          %Message{}
          |> Message.changeset(%{
            content: content,
            message_type: "text",
            conversation_id: conversation_id,
            sender_id: sender_id
          })
          |> Repo.insert()

        # Update conversation's last message info
        Conversation
        |> where([c], c.id == ^conversation_id)
        |> Repo.update_all(set: [last_message_at: now, last_message_preview: preview])

        Repo.preload(message, [:sender])
      end)
    end
  end

  @doc """
  Edits a message. Only the sender can edit their own messages.
  """
  def edit_message(message_id, user_id, new_content) do
    with {:ok, message} <- get_message_for_sender(message_id, user_id) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      message
      |> Message.edit_changeset(%{content: new_content, edited_at: now})
      |> Repo.update()
    end
  end

  @doc """
  Soft deletes a message. Sender can delete their own, admins can delete any.
  """
  def delete_message(message_id, user_id) do
    message = Repo.get(Message, message_id)

    cond do
      is_nil(message) ->
        {:error, :not_found}

      message.sender_id == user_id ->
        soft_delete_message(message)

      can_delete_any_message?(message.conversation_id, user_id) ->
        soft_delete_message(message)

      true ->
        {:error, :unauthorized}
    end
  end

  defp soft_delete_message(message) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    message
    |> Message.delete_changeset(%{deleted_at: now})
    |> Repo.update()
  end

  @doc """
  Gets paginated messages for a conversation.
  """
  def get_messages(conversation_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    before_id = Keyword.get(opts, :before)

    query =
      Message
      |> where([m], m.conversation_id == ^conversation_id)
      |> order_by([m], desc: m.inserted_at)
      |> limit(^limit)
      |> preload([:sender, :read_statuses])

    query =
      if before_id do
        where(query, [m], m.id < ^before_id)
      else
        query
      end

    Repo.all(query)
  end

  # ============================================================================
  # Read Status
  # ============================================================================

  @doc """
  Marks all messages in a conversation as read for a user.
  Updates both the participant's last_read_at and creates read status records.
  """
  def mark_as_read(conversation_id, user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Repo.transaction(fn ->
      # Update participant's last_read_at
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^user_id)
      |> Repo.update_all(set: [last_read_at: now])

      # Get unread message IDs
      unread_message_ids =
        Message
        |> where([m], m.conversation_id == ^conversation_id)
        |> where([m], m.sender_id != ^user_id)
        |> join(:left, [m], rs in MessageReadStatus,
          on: rs.message_id == m.id and rs.user_id == ^user_id
        )
        |> where([m, rs], is_nil(rs.id))
        |> select([m], m.id)
        |> Repo.all()

      # Bulk insert read statuses
      read_statuses =
        Enum.map(unread_message_ids, fn message_id ->
          %{
            message_id: message_id,
            user_id: user_id,
            read_at: now,
            inserted_at: now,
            updated_at: now
          }
        end)

      if length(read_statuses) > 0 do
        Repo.insert_all(MessageReadStatus, read_statuses, on_conflict: :nothing)
      end

      :ok
    end)
  end

  @doc """
  Marks a specific message as read.
  """
  def mark_message_read(message_id, user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %MessageReadStatus{}
    |> MessageReadStatus.changeset(%{
      message_id: message_id,
      user_id: user_id,
      read_at: now
    })
    |> Repo.insert(on_conflict: :nothing)
  end

  @doc """
  Gets unread counts for all conversations in an organization for a user.
  """
  def get_unread_counts(organization_id, user_id) do
    Conversation
    |> join(:inner, [c], p in ConversationParticipant,
      on: p.conversation_id == c.id and p.user_id == ^user_id
    )
    |> join(:left, [c, p], m in Message,
      on: m.conversation_id == c.id and m.sender_id != ^user_id
    )
    |> join(:left, [c, p, m], rs in MessageReadStatus,
      on: rs.message_id == m.id and rs.user_id == ^user_id
    )
    |> where([c, p, m, rs], c.organization_id == ^organization_id)
    |> where([c, p, m, rs], is_nil(p.left_at))
    |> where([c, p, m, rs], is_nil(rs.id))
    |> where([c, p, m, rs], is_nil(m.deleted_at))
    |> group_by([c, p, m, rs], c.id)
    |> select([c, p, m, rs], {c.id, count(m.id)})
    |> Repo.all()
    |> Map.new()
  end

  @doc """
  Gets total unread count across all organizations for a user.
  """
  def get_total_unread_count(user_id) do
    Conversation
    |> join(:inner, [c], p in ConversationParticipant,
      on: p.conversation_id == c.id and p.user_id == ^user_id
    )
    |> join(:left, [c, p], m in Message,
      on: m.conversation_id == c.id and m.sender_id != ^user_id
    )
    |> join(:left, [c, p, m], rs in MessageReadStatus,
      on: rs.message_id == m.id and rs.user_id == ^user_id
    )
    |> where([c, p, m, rs], is_nil(p.left_at))
    |> where([c, p, m, rs], is_nil(rs.id))
    |> where([c, p, m, rs], is_nil(m.deleted_at))
    |> select([c, p, m, rs], count(m.id))
    |> Repo.one()
  end

  # ============================================================================
  # Participants
  # ============================================================================

  @doc """
  Adds a participant to a group conversation.
  Only admins can add participants.
  """
  def add_participant(conversation_id, user_id, adder_id) do
    with {:ok, conversation} <- get_conversation_for_user(conversation_id, adder_id),
         :ok <- verify_is_admin(conversation_id, adder_id),
         :ok <- verify_org_membership(conversation.organization_id, user_id) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      %ConversationParticipant{}
      |> ConversationParticipant.changeset(%{
        conversation_id: conversation_id,
        user_id: user_id,
        role: "member",
        joined_at: now
      })
      |> Repo.insert()
    end
  end

  @doc """
  Removes a participant from a group conversation.
  Conversation starters (admins) can kick anyone.
  If conversation starter is just a member (not org admin), they cannot kick org admins.
  """
  def remove_participant(conversation_id, target_user_id, remover_id) do
    with {:ok, conversation} <- get_conversation_for_user(conversation_id, remover_id),
         :ok <- verify_can_kick(conversation, target_user_id, remover_id) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^target_user_id)
      |> Repo.update_all(set: [left_at: now])

      :ok
    end
  end

  defp verify_can_kick(conversation, target_user_id, remover_id) do
    # Get remover's conversation role
    remover_participant =
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation.id and p.user_id == ^remover_id)
      |> where([p], is_nil(p.left_at))
      |> Repo.one()

    # Check if remover is conversation admin (starter)
    is_conversation_admin = remover_participant && remover_participant.role == "admin"

    # Check if remover is org admin/owner
    remover_org_member = Organizations.get_member(conversation.organization_id, remover_id)
    is_org_admin = remover_org_member && remover_org_member.role in ["owner", "admin"]

    # Check if target is org admin/owner
    target_org_member = Organizations.get_member(conversation.organization_id, target_user_id)
    target_is_org_admin = target_org_member && target_org_member.role in ["owner", "admin"]

    cond do
      # Can't kick if not conversation admin
      !is_conversation_admin ->
        {:error, :not_admin}

      # Org admins can kick anyone
      is_org_admin ->
        :ok

      # Non-org-admin conversation starters cannot kick org admins
      target_is_org_admin ->
        {:error, :cannot_kick_org_admin}

      # Otherwise allow
      true ->
        :ok
    end
  end

  @doc """
  Allows a user to leave a group conversation.
  """
  def leave_conversation(conversation_id, user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    result =
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^user_id)
      |> Repo.update_all(set: [left_at: now])

    case result do
      {1, _} -> :ok
      {0, _} -> {:error, :not_found}
    end
  end

  @doc """
  Deletes a conversation. Only the conversation creator can delete it.
  """
  def delete_conversation(conversation_id, user_id) do
    conversation = get_conversation(conversation_id)

    cond do
      is_nil(conversation) ->
        {:error, :not_found}

      conversation.created_by_user_id == user_id ->
        do_delete_conversation(conversation)

      true ->
        {:error, :unauthorized}
    end
  end

  defp do_delete_conversation(conversation) do
    Repo.transaction(fn ->
      # Delete all read statuses for messages in this conversation
      MessageReadStatus
      |> join(:inner, [rs], m in Message, on: rs.message_id == m.id)
      |> where([rs, m], m.conversation_id == ^conversation.id)
      |> Repo.delete_all()

      # Delete all messages
      Message
      |> where([m], m.conversation_id == ^conversation.id)
      |> Repo.delete_all()

      # Delete all participants
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation.id)
      |> Repo.delete_all()

      # Delete the conversation
      Repo.delete(conversation)
    end)
  end

  @doc """
  Toggles mute status for a conversation participant.
  """
  def toggle_mute(conversation_id, user_id) do
    participant =
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^user_id)
      |> Repo.one()

    case participant do
      nil ->
        {:error, :not_found}

      p ->
        p
        |> ConversationParticipant.toggle_mute_changeset(%{muted: !p.muted})
        |> Repo.update()
    end
  end

  # ============================================================================
  # Access Control
  # ============================================================================

  @doc """
  Checks if a user is a participant in a conversation.
  """
  def is_participant?(conversation_id, user_id) do
    ConversationParticipant
    |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^user_id)
    |> where([p], is_nil(p.left_at))
    |> Repo.exists?()
  end

  @doc """
  Checks if a user can send announcements in an organization.
  """
  def can_send_announcement?(organization_id, user_id) do
    case Organizations.get_member(organization_id, user_id) do
      nil -> false
      member -> member.role in ["owner", "admin"]
    end
  end

  @doc """
  Checks if two users can message each other (both must be in the same org).
  """
  def can_message_user?(organization_id, from_user_id, to_user_id) do
    from_member = Organizations.get_member(organization_id, from_user_id)
    to_member = Organizations.get_member(organization_id, to_user_id)

    from_member != nil and to_member != nil
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp verify_org_membership(organization_id, user_id) do
    case Organizations.get_member(organization_id, user_id) do
      nil -> {:error, :not_org_member}
      _member -> :ok
    end
  end

  defp verify_all_org_memberships(organization_id, user_ids) do
    results = Enum.map(user_ids, &verify_org_membership(organization_id, &1))

    if Enum.all?(results, &(&1 == :ok)) do
      :ok
    else
      {:error, :not_all_org_members}
    end
  end

  defp verify_can_send_announcement(organization_id, user_id) do
    if can_send_announcement?(organization_id, user_id) do
      :ok
    else
      {:error, :unauthorized}
    end
  end

  defp verify_is_admin(conversation_id, user_id) do
    participant =
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^user_id)
      |> where([p], is_nil(p.left_at))
      |> Repo.one()

    case participant do
      nil -> {:error, :not_participant}
      %{role: "admin"} -> :ok
      _ -> {:error, :not_admin}
    end
  end

  defp find_existing_direct_conversation(organization_id, user1_id, user2_id) do
    # Find a direct conversation where both users are participants
    Conversation
    |> where([c], c.organization_id == ^organization_id and c.type == "direct")
    |> join(:inner, [c], p1 in ConversationParticipant,
      on: p1.conversation_id == c.id and p1.user_id == ^user1_id and is_nil(p1.left_at)
    )
    |> join(:inner, [c, p1], p2 in ConversationParticipant,
      on: p2.conversation_id == c.id and p2.user_id == ^user2_id and is_nil(p2.left_at)
    )
    |> preload([:participants, participants: :user])
    |> Repo.one()
  end

  defp create_conversation_with_participants(conversation_attrs, member_ids, admin_id \\ nil) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Repo.transaction(fn ->
      {:ok, conversation} =
        %Conversation{}
        |> Conversation.changeset(conversation_attrs)
        |> Repo.insert()

      # Create participant records
      participants =
        Enum.map(member_ids, fn user_id ->
          role = if user_id == admin_id, do: "admin", else: "member"

          %{
            conversation_id: conversation.id,
            user_id: user_id,
            role: role,
            joined_at: now,
            inserted_at: now,
            updated_at: now
          }
        end)

      Repo.insert_all(ConversationParticipant, participants)

      Repo.preload(conversation, [:participants, participants: :user])
    end)
  end

  defp get_org_member_ids(organization_id) do
    Organizations.list_members(organization_id)
    |> Enum.map(& &1.user_id)
  end

  defp get_message_for_sender(message_id, user_id) do
    case Repo.get(Message, message_id) do
      nil -> {:error, :not_found}
      %{sender_id: ^user_id} = message -> {:ok, message}
      _ -> {:error, :unauthorized}
    end
  end

  defp can_delete_any_message?(conversation_id, user_id) do
    participant =
      ConversationParticipant
      |> where([p], p.conversation_id == ^conversation_id and p.user_id == ^user_id)
      |> where([p], is_nil(p.left_at))
      |> Repo.one()

    case participant do
      %{role: "admin"} -> true
      _ -> false
    end
  end
end
