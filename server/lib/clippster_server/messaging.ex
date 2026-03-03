defmodule ClippsterServer.Messaging do
  @moduledoc """
  Context for organization messaging system.
  Handles conversations, messages, and read status tracking.
  All messaging is organization-scoped - users can only message others in the same org.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Organizations

  alias ClippsterServer.Messaging.{
    Conversation,
    ConversationParticipant,
    Message,
    MessageReadStatus,
    MessageAttachment
  }

  # ============================================================================
  # Conversations
  # ============================================================================

  @doc """
  Creates a direct conversation between two users in an organization.
  Returns existing conversation if one already exists.
  """
  def create_direct_conversation(organization_id, user1_id, user2_id) do
    # Prevent creating a conversation with yourself
    if user1_id == user2_id do
      {:error, :cannot_message_self}
    else
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
  end

  @doc """
  Creates a global direct conversation between two users (not scoped to an organization).
  Returns existing conversation if one already exists.
  """
  def create_global_direct_conversation(user1_id, user2_id) do
    # Prevent creating a conversation with yourself
    if user1_id == user2_id do
      {:error, :cannot_message_self}
    else
      # Check if global direct conversation already exists between these users
      case find_existing_global_direct_conversation(user1_id, user2_id) do
        nil ->
          create_conversation_with_participants(
            %{
              type: "direct",
              organization_id: nil,
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
    |> Repo.preload([:participants, participants: [user: :clipper_profile]])
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
    |> preload([:participants, participants: [user: :clipper_profile]])
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
    |> preload([:organization, participants: [user: :clipper_profile]])
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

        Repo.preload(message, [sender: :clipper_profile])
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
      |> preload([:read_statuses, :attachments, sender: :clipper_profile])

    query =
      if before_id do
        where(query, [m], m.id < ^before_id)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Gets paginated messages for a conversation with limit and offset.
  Used by support and staff controllers.
  """
  def get_conversation_messages(conversation_id, limit, offset) do
    Message
    |> where([m], m.conversation_id == ^conversation_id)
    |> order_by([m], desc: m.inserted_at)
    |> limit(^limit)
    |> offset(^offset)
    |> preload([:read_statuses, :attachments, sender: :clipper_profile])
    |> Repo.all()
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
  Alias for mark_as_read/2 - marks all messages in a conversation as read for a user.
  """
  def mark_conversation_read(conversation_id, user_id) do
    mark_as_read(conversation_id, user_id)
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
  Gets unread counts for all conversations for a user (not org-scoped).
  """
  def get_unread_counts_for_user(user_id) do
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
  Alias for is_participant?/2 - checks if a user is a participant in a conversation.
  """
  def is_conversation_participant?(conversation_id, user_id) do
    is_participant?(conversation_id, user_id)
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

  defp find_existing_global_direct_conversation(user1_id, user2_id) do
    # Find a global direct conversation (organization_id is nil) where both users are participants
    Conversation
    |> where([c], is_nil(c.organization_id) and c.type == "direct")
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

      Repo.preload(conversation, [:participants, participants: [user: :clipper_profile]])
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

  @doc """
  Gets response times for a user (time between receiving a message and responding).
  Used for calculating average response time for clipper profiles.
  Returns list of response times in minutes.
  """
  def get_user_response_times(user_id, limit \\ 20) do
    # Find conversations where user is a participant
    conversation_ids =
      ConversationParticipant
      |> where([p], p.user_id == ^user_id)
      |> where([p], is_nil(p.left_at))
      |> select([p], p.conversation_id)
      |> Repo.all()

    if Enum.empty?(conversation_ids) do
      []
    else
      # Get messages in those conversations, ordered by time
      messages =
        Message
        |> where([m], m.conversation_id in ^conversation_ids)
        |> order_by([m], asc: m.inserted_at)
        |> Repo.all()

      # Calculate response times
      messages
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.filter(fn [prev, curr] ->
        # Previous message was from someone else, current is from user
        prev.sender_id != user_id and curr.sender_id == user_id
      end)
      |> Enum.map(fn [prev, curr] ->
        # Calculate time difference in minutes
        DateTime.diff(curr.inserted_at, prev.inserted_at, :minute)
      end)
      # Filter out > 1 week
      |> Enum.filter(fn minutes -> minutes > 0 and minutes < 60 * 24 * 7 end)
      # Take most recent
      |> Enum.take(-limit)
    end
  end

  # ============================================================================
  # User Search for Messaging
  # ============================================================================

  @doc """
  Searches for users that the current user can message.
  - Admins/moderators can search all users
  - Organization owners can search all users
  - Regular users can only search users in their organizations
  Returns clipper profile display_name if available, otherwise user name/email.
  """
  def search_messageable_users(current_user_id, query, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    current_user = Repo.get(ClippsterServer.Accounts.User, current_user_id)

    if is_nil(current_user) do
      []
    else
      base_query =
        ClippsterServer.Accounts.User
        |> where([u], u.id != ^current_user_id)
        |> where([u], is_nil(u.deactivated_at))
        |> limit(^limit)
        # Left join with clipper_profiles to get display_name
        |> join(:left, [u], cp in ClippsterServer.ClipperProfiles.ClipperProfile,
          on: cp.user_id == u.id
        )

      # Apply search filter if query provided
      filtered_query =
        if query && String.trim(query) != "" do
          search_term = "%#{String.downcase(query)}%"

          base_query
          |> where(
            [u, cp],
            fragment("LOWER(COALESCE(?, ?)) LIKE ?", cp.display_name, u.name, ^search_term) or
              fragment("LOWER(?) LIKE ?", u.email, ^search_term)
          )
        else
          base_query
        end

      # Apply role-based filtering
      final_query =
        cond do
          # Admins and moderators can see all users
          current_user.is_admin or current_user.is_moderator ->
            filtered_query

          # Organization owners can see all users
          current_user.account_type == "organization" and
              not is_nil(current_user.owned_organization_id) ->
            filtered_query

          # Regular users can only see users in their organizations
          true ->
            # Get all organization IDs where current user is a member
            org_ids =
              ClippsterServer.Organizations.OrganizationMember
              |> where([m], m.user_id == ^current_user_id)
              |> select([m], m.organization_id)
              |> Repo.all()

            if Enum.empty?(org_ids) do
              # No organizations, return empty
              filtered_query |> where([u, cp], false)
            else
              # Return users who are members of the same organizations
              filtered_query
              |> join(:inner, [u, cp], m in ClippsterServer.Organizations.OrganizationMember,
                on: m.user_id == u.id
              )
              |> where([u, cp, m], m.organization_id in ^org_ids)
              |> distinct([u, cp], u.id)
            end
        end

      final_query
      |> select([u, cp], %{
        id: u.id,
        name: fragment("COALESCE(?, ?, ?)", cp.display_name, u.name, u.email),
        email: u.email,
        avatar_url: fragment("COALESCE(?, ?)", cp.avatar_url, u.avatar_url),
        account_type: u.account_type,
        has_clipper_profile: not is_nil(cp.id)
      })
      |> Repo.all()
    end
  end

  # ============================================================================
  # Support Conversations (Customer Service)
  # ============================================================================

  @doc """
  Gets a user's existing support conversation without creating one.
  Returns {:ok, conversation} or {:ok, nil}.
  """
  def check_support_conversation(user_id) do
    case get_user_support_conversation(user_id) do
      nil ->
        {:ok, nil}

      conversation ->
        if conversation.status == "archived" do
          {:ok, nil}
        else
          {:ok, conversation}
        end
    end
  end

  @doc """
  Gets or creates a support conversation for a user.
  Each user has at most one active support conversation.
  """
  def get_or_create_support_conversation(user_id) do
    case get_user_support_conversation(user_id) do
      nil ->
        create_support_conversation(user_id)

      conversation ->
        # If archived, reopen it
        if conversation.status == "archived" do
          case reopen_support_conversation(conversation.id) do
            {:ok, reopened_conversation} ->
              {:ok, Repo.preload(reopened_conversation, participants: [user: :clipper_profile])}

            error ->
              error
          end
        else
          {:ok, conversation}
        end
    end
  end

  @doc """
  Gets a user's support conversation (if it exists).
  """
  def get_user_support_conversation(user_id) do
    Conversation
    |> where([c], c.type == "support")
    |> where([c], c.created_by_user_id == ^user_id)
    |> where([c], is_nil(c.organization_id))
    |> order_by([c], desc: c.inserted_at)
    |> limit(1)
    |> Repo.one()
    |> case do
      nil -> nil
      conversation -> Repo.preload(conversation, participants: [user: :clipper_profile])
    end
  end

  @doc """
  Creates a new support conversation for a user.
  Adds user + all current admins/mods as participants.
  Sends automated welcome message.
  """
  def create_support_conversation(user_id) do
    # Get all admins and moderators
    staff_users = ClippsterServer.Accounts.list_admins_and_moderators()
    staff_ids = Enum.map(staff_users, & &1.id)
    all_participant_ids = Enum.uniq([user_id | staff_ids])

    Repo.transaction(fn ->
      # Create conversation
      conversation =
        %Conversation{}
        |> Conversation.changeset(%{
          type: "support",
          organization_id: nil,
          created_by_user_id: user_id,
          status: "open"
        })
        |> Repo.insert!()

      # Add participants
      participants =
        Enum.map(all_participant_ids, fn participant_id ->
          %{
            conversation_id: conversation.id,
            user_id: participant_id,
            joined_at: DateTime.utc_now() |> DateTime.truncate(:second),
            inserted_at: DateTime.utc_now() |> DateTime.truncate(:second),
            updated_at: DateTime.utc_now() |> DateTime.truncate(:second)
          }
        end)

      Repo.insert_all(ConversationParticipant, participants)

      Repo.preload(conversation, [:participants, participants: [user: :clipper_profile]])
    end)
  end

  @doc """
  Returns the automated welcome message for support conversations.
  """
  def get_support_auto_message do
    "Thanks for reaching out! This is an automated message. A member of our team will get back to you within 24 hours."
  end

  @doc """
  Checks if a support conversation should receive an auto-reply after a message.
  Returns true if the conversation is type "support" and the user has sent exactly
  one message (the one just sent). Called after send_message succeeds.
  """
  def should_send_support_auto_reply?(conversation_id, user_id) do
    conversation = Repo.get(Conversation, conversation_id)

    if conversation && conversation.type == "support" do
      user_message_count =
        Message
        |> where([m], m.conversation_id == ^conversation_id)
        |> where([m], m.sender_id == ^user_id)
        |> Repo.aggregate(:count, :id)

      user_message_count == 1
    else
      false
    end
  end

  @doc """
  Inserts the support auto-reply system message and returns it.
  """
  def insert_support_auto_reply(conversation_id) do
    auto_message_content = get_support_auto_message()

    %Message{}
    |> Message.changeset(%{
      conversation_id: conversation_id,
      sender_id: nil,
      content: auto_message_content,
      message_type: "system"
    })
    |> Repo.insert()
  end

  @doc """
  Sends a message to a user's support conversation.
  Auto-reopens if conversation was archived.
  Sends automated welcome message on first user message.
  """
  def send_support_message(user_id, content) do
    case get_user_support_conversation(user_id) do
      nil ->
        {:error, :conversation_not_found}

      conversation ->
        # Reopen if archived
        if conversation.status == "archived" do
          reopen_support_conversation(conversation.id)
        end

        # Check if this is the first user message (no messages from this user yet)
        user_message_count =
          Message
          |> where([m], m.conversation_id == ^conversation.id)
          |> where([m], m.sender_id == ^user_id)
          |> Repo.aggregate(:count, :id)

        # Send user's message first
        result = send_message(conversation.id, user_id, content)

        # If this was the first message, send automated welcome response
        if user_message_count == 0 do
          auto_message_content = get_support_auto_message()

          %Message{}
          |> Message.changeset(%{
            conversation_id: conversation.id,
            sender_id: nil,
            content: auto_message_content,
            message_type: "system"
          })
          |> Repo.insert!()
        end

        result
    end
  end

  @doc """
  Sends a response from admin/mod to a support conversation.
  """
  def send_support_response(conversation_id, moderator_id, content) do
    send_message(conversation_id, moderator_id, content)
  end

  @doc """
  Archives a support conversation.
  Sets scheduled deletion for 24 hours from now to auto-clear from user's view.
  """
  def archive_support_conversation(conversation_id, moderator_id) do
    conversation = Repo.get(Conversation, conversation_id)

    if is_nil(conversation) do
      {:error, :not_found}
    else
      # Schedule deletion for 24 hours from now
      scheduled_deletion =
        DateTime.utc_now()
        |> DateTime.add(24 * 60 * 60, :second)
        |> DateTime.truncate(:second)

      conversation
      |> Conversation.changeset(%{
        status: "archived",
        archived_at: DateTime.utc_now() |> DateTime.truncate(:second),
        archived_by_user_id: moderator_id,
        scheduled_deletion_at: scheduled_deletion
      })
      |> Repo.update()
    end
  end

  @doc """
  Reopens an archived support conversation.
  """
  def reopen_support_conversation(conversation_id) do
    conversation = Repo.get(Conversation, conversation_id)

    if is_nil(conversation) do
      {:error, :not_found}
    else
      conversation
      |> Conversation.changeset(%{
        status: "open",
        archived_at: nil,
        archived_by_user_id: nil
      })
      |> Repo.update()
    end
  end

  @doc """
  Lists all support conversations with optional status filter.
  """
  def list_support_conversations(status \\ "open", page \\ 1, per_page \\ 50) do
    offset = (page - 1) * per_page

    Conversation
    |> where([c], c.type == "support")
    |> where([c], c.status == ^status)
    |> order_by([c], desc: c.last_message_at)
    |> limit(^per_page)
    |> offset(^offset)
    |> preload([:participants, participants: :user])
    |> Repo.all()
  end

  @doc """
  Counts support conversations by status.
  """
  def count_support_conversations(status \\ "open") do
    Conversation
    |> where([c], c.type == "support")
    |> where([c], c.status == ^status)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts total unread messages across all open support conversations for a given admin/mod user.
  A message is unread if it was sent after the user's last_read_at in that conversation.
  """
  def count_unread_support_messages(user_id) do
    now = DateTime.utc_now()

    Conversation
    |> where([c], c.type == "support" and c.status == "open")
    |> join(:inner, [c], p in ConversationParticipant,
      on: p.conversation_id == c.id and p.user_id == ^user_id and is_nil(p.left_at)
    )
    |> join(:inner, [c, p], m in Message, on: m.conversation_id == c.id)
    |> where([c, p, m], m.sender_id != ^user_id)
    |> where([c, p, m], is_nil(p.last_read_at) or m.inserted_at > p.last_read_at)
    |> where([c, p, m], m.inserted_at <= ^now)
    |> select([c, p, m], count(m.id))
    |> Repo.one()
    |> Kernel.||(0)
  end

  # ============================================================================
  # Staff Internal Messaging
  # ============================================================================

  @doc """
  Creates a direct staff conversation between two staff members.
  """
  def create_staff_direct_conversation(user1_id, user2_id) do
    # Check if conversation already exists
    case find_existing_staff_direct_conversation(user1_id, user2_id) do
      nil ->
        create_conversation_with_participants(
          %{
            type: "staff",
            organization_id: nil,
            created_by_user_id: user1_id
          },
          [user1_id, user2_id]
        )

      conversation ->
        {:ok, conversation}
    end
  end

  @doc """
  Creates a group staff conversation.
  """
  def create_staff_group_conversation(creator_id, name, participant_ids) do
    all_participant_ids = Enum.uniq([creator_id | participant_ids])

    create_conversation_with_participants(
      %{
        type: "staff",
        name: name,
        organization_id: nil,
        created_by_user_id: creator_id
      },
      all_participant_ids
    )
  end

  @doc """
  Lists all staff conversations for a user.
  """
  def list_staff_conversations(user_id) do
    Conversation
    |> where([c], c.type == "staff")
    |> join(:inner, [c], p in ConversationParticipant, on: p.conversation_id == c.id)
    |> where([c, p], p.user_id == ^user_id and is_nil(p.left_at))
    |> order_by([c], desc: c.last_message_at)
    |> preload([:participants, participants: :user])
    |> Repo.all()
  end

  defp find_existing_staff_direct_conversation(user1_id, user2_id) do
    # Find staff direct conversations where both users are participants
    Conversation
    |> where([c], c.type == "staff" and is_nil(c.organization_id))
    |> join(:inner, [c], p1 in ConversationParticipant, on: p1.conversation_id == c.id)
    |> join(:inner, [c], p2 in ConversationParticipant, on: p2.conversation_id == c.id)
    |> where([c, p1, p2], p1.user_id == ^user1_id and p2.user_id == ^user2_id)
    |> where([c, p1, p2], is_nil(p1.left_at) and is_nil(p2.left_at))
    |> limit(1)
    |> Repo.one()
  end

  # ============================================================================
  # Message Attachments
  # ============================================================================

  @doc """
  Creates a message attachment record.
  """
  def create_message_attachment(message_id, attrs) do
    %MessageAttachment{message_id: message_id}
    |> MessageAttachment.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Lists all attachments for a message.
  """
  def list_message_attachments(message_id) do
    MessageAttachment
    |> where([a], a.message_id == ^message_id)
    |> order_by([a], asc: a.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets a single message attachment by ID.
  """
  def get_message_attachment(attachment_id) do
    Repo.get(MessageAttachment, attachment_id)
  end

  @doc """
  Preloads attachments for a list of messages.
  """
  def preload_attachments(messages) when is_list(messages) do
    Repo.preload(messages, :attachments)
  end

  def preload_attachments(message) do
    Repo.preload(message, :attachments)
  end
end
