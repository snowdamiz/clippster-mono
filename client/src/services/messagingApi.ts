import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface Participant {
  id: number;
  userId: number;
  role: 'admin' | 'member';
  joinedAt: string;
  muted: boolean;
  user: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group' | 'announcement';
  name: string | null;
  organizationId: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  participants: Participant[];
  unreadCount?: number;
  muted?: boolean;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number | null;
  content: string;
  messageType: 'text' | 'system';
  editedAt: string | null;
  deletedAt: string | null;
  insertedAt: string;
  sender: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  readBy: number[];
}

export interface UnreadCounts {
  [conversationId: string]: number;
}

// ============================================================================
// Organization-scoped endpoints
// ============================================================================

/**
 * List all conversations for the current user in an organization.
 */
export async function listConversations(orgId: number): Promise<Conversation[]> {
  const response = await api.get<{ data: Conversation[] }>(
    `/organizations/${orgId}/messaging/conversations`
  );
  return response.data.data;
}

/**
 * Create a direct conversation with another user.
 */
export async function createDirectConversation(
  orgId: number,
  userId: number
): Promise<Conversation> {
  const response = await api.post<{ data: Conversation }>(
    `/organizations/${orgId}/messaging/conversations/direct`,
    { user_id: userId }
  );
  return response.data.data;
}

/**
 * Create a group conversation.
 */
export async function createGroupConversation(
  orgId: number,
  name: string,
  memberIds: number[]
): Promise<Conversation> {
  const response = await api.post<{ data: Conversation }>(
    `/organizations/${orgId}/messaging/conversations/group`,
    { name, member_ids: memberIds }
  );
  return response.data.data;
}

/**
 * Create an announcement (admin/owner only).
 */
export async function createAnnouncement(
  orgId: number,
  content: string
): Promise<Conversation> {
  const response = await api.post<{ data: Conversation }>(
    `/organizations/${orgId}/messaging/conversations/announcement`,
    { content }
  );
  return response.data.data;
}

/**
 * Get unread counts for all conversations in an organization.
 */
export async function getUnreadCounts(orgId: number): Promise<UnreadCounts> {
  const response = await api.get<{ data: UnreadCounts }>(
    `/organizations/${orgId}/messaging/unread`
  );
  return response.data.data;
}

// ============================================================================
// Conversation-specific endpoints
// ============================================================================

/**
 * Get a specific conversation.
 */
export async function getConversation(conversationId: number): Promise<Conversation> {
  const response = await api.get<{ data: Conversation }>(
    `/conversations/${conversationId}`
  );
  return response.data.data;
}

/**
 * Get messages for a conversation (paginated).
 */
export async function getMessages(
  conversationId: number,
  opts?: { before?: number; limit?: number }
): Promise<Message[]> {
  const params: Record<string, string> = {};
  if (opts?.before) params.before = opts.before.toString();
  if (opts?.limit) params.limit = opts.limit.toString();

  const response = await api.get<{ data: Message[] }>(
    `/conversations/${conversationId}/messages`,
    { params }
  );
  return response.data.data;
}

/**
 * Send a message to a conversation.
 */
export async function sendMessage(
  conversationId: number,
  content: string
): Promise<Message> {
  const response = await api.post<{ data: Message }>(
    `/conversations/${conversationId}/messages`,
    { content }
  );
  return response.data.data;
}

/**
 * Edit a message.
 */
export async function editMessage(
  conversationId: number,
  messageId: number,
  content: string
): Promise<Message> {
  const response = await api.put<{ data: Message }>(
    `/conversations/${conversationId}/messages/${messageId}`,
    { content }
  );
  return response.data.data;
}

/**
 * Delete a message.
 */
export async function deleteMessage(
  conversationId: number,
  messageId: number
): Promise<void> {
  await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
}

/**
 * Mark conversation as read.
 */
export async function markAsRead(conversationId: number): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`);
}

/**
 * Toggle mute for a conversation.
 */
export async function toggleMute(
  conversationId: number
): Promise<{ muted: boolean }> {
  const response = await api.put<{ data: { muted: boolean } }>(
    `/conversations/${conversationId}/mute`
  );
  return response.data.data;
}

/**
 * Add a participant to a group conversation.
 */
export async function addParticipant(
  conversationId: number,
  userId: number
): Promise<Participant> {
  const response = await api.post<{ data: Participant }>(
    `/conversations/${conversationId}/participants`,
    { user_id: userId }
  );
  return response.data.data;
}

/**
 * Remove a participant from a group conversation.
 */
export async function removeParticipant(
  conversationId: number,
  userId: number
): Promise<void> {
  await api.delete(`/conversations/${conversationId}/participants/${userId}`);
}

/**
 * Leave a group conversation.
 */
export async function leaveConversation(conversationId: number): Promise<void> {
  await api.post(`/conversations/${conversationId}/leave`);
}

// ============================================================================
// User-level endpoints
// ============================================================================

/**
 * List all conversations for the current user across all organizations.
 */
export async function listAllConversations(): Promise<Conversation[]> {
  const response = await api.get<{ data: Conversation[] }>('/me/conversations');
  return response.data.data;
}

/**
 * Get total unread count across all organizations.
 */
export async function getTotalUnread(): Promise<number> {
  const response = await api.get<{ data: { unread_count: number } }>(
    '/me/unread-count'
  );
  return response.data.data.unread_count;
}
