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
  type: 'direct' | 'group' | 'announcement' | 'support';
  name: string | null;
  organizationId: number;
  createdByUserId: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  participants: Participant[];
  unreadCount?: number;
  muted?: boolean;
  status?: string;
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
// Normalization helpers (snake_case server response → camelCase)
// ============================================================================

function normalizeParticipant(p: any): Participant {
  return {
    id: p.id,
    userId: p.userId ?? p.user_id,
    role: p.role,
    joinedAt: p.joinedAt ?? p.joined_at ?? '',
    muted: p.muted ?? false,
    user: p.user ? {
      id: p.user.id,
      displayName: p.user.displayName ?? p.user.display_name ?? '',
      avatarUrl: p.user.avatarUrl ?? p.user.avatar_url ?? null,
    } : null,
  };
}

export function normalizeConversation(c: any): Conversation {
  return {
    id: c.id,
    type: c.type,
    name: c.name ?? null,
    organizationId: c.organizationId ?? c.organization_id,
    createdByUserId: c.createdByUserId ?? c.created_by_user_id,
    lastMessageAt: c.lastMessageAt ?? c.last_message_at ?? null,
    lastMessagePreview: c.lastMessagePreview ?? c.last_message_preview ?? null,
    createdAt: c.createdAt ?? c.created_at ?? '',
    participants: (c.participants || []).map(normalizeParticipant),
    unreadCount: c.unreadCount ?? c.unread_count,
    muted: c.muted ?? false,
  };
}

export function normalizeMessage(m: any): Message {
  return {
    id: m.id,
    conversationId: m.conversationId ?? m.conversation_id,
    senderId: m.senderId ?? m.sender_id ?? null,
    content: m.content ?? '',
    messageType: m.messageType ?? m.message_type ?? 'text',
    editedAt: m.editedAt ?? m.edited_at ?? null,
    deletedAt: m.deletedAt ?? m.deleted_at ?? null,
    insertedAt: m.insertedAt ?? m.inserted_at ?? '',
    sender: m.sender ? {
      id: m.sender.id,
      displayName: m.sender.displayName ?? m.sender.display_name ?? '',
      avatarUrl: m.sender.avatarUrl ?? m.sender.avatar_url ?? null,
    } : null,
    readBy: m.readBy ?? m.read_by ?? [],
  };
}

// ============================================================================
// Organization-scoped endpoints
// ============================================================================

/**
 * List all conversations for the current user (org-scoped + global).
 */
export async function listConversations(orgId: number): Promise<Conversation[]> {
  const [orgResponse, globalResponse] = await Promise.all([
    api.get<{ data: any[] }>(`/organizations/${orgId}/messaging/conversations`).catch(() => ({ data: { data: [] } })),
    api.get<{ data: any[] }>('/me/conversations').catch(() => ({ data: { data: [] } })),
  ]);
  const merged = new Map<number, Conversation>();
  for (const conv of (orgResponse.data.data || [])) merged.set(conv.id, normalizeConversation(conv));
  for (const conv of (globalResponse.data.data || [])) merged.set(conv.id, normalizeConversation(conv));
  return Array.from(merged.values());
}

/**
 * Create a direct conversation with another user.
 */
export async function createDirectConversation(
  orgId: number,
  userId: number
): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    `/organizations/${orgId}/messaging/conversations/direct`,
    { user_id: userId }
  );
  return normalizeConversation(response.data.data);
}

/**
 * Create a global direct conversation with another user (not scoped to an organization).
 */
export async function createGlobalDirectConversation(userId: number): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    '/messaging/conversations/global-direct',
    { user_id: userId }
  );
  return normalizeConversation(response.data.data);
}

/**
 * Create a group conversation.
 */
export async function createGroupConversation(
  orgId: number,
  name: string,
  memberIds: number[]
): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    `/organizations/${orgId}/messaging/conversations/group`,
    { name, member_ids: memberIds }
  );
  return normalizeConversation(response.data.data);
}

/**
 * Create an announcement (admin/owner only).
 */
export async function createAnnouncement(orgId: number, content: string): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    `/organizations/${orgId}/messaging/conversations/announcement`,
    { content }
  );
  return normalizeConversation(response.data.data);
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
  const response = await api.get<{ data: any }>(`/conversations/${conversationId}`);
  return normalizeConversation(response.data.data);
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

  const response = await api.get<{ data: any[] }>(`/conversations/${conversationId}/messages`, {
    params,
  });
  return (response.data.data || []).map(normalizeMessage);
}

/**
 * Send a message to a conversation.
 */
export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const response = await api.post<{ data: any }>(`/conversations/${conversationId}/messages`, {
    content,
  });
  return normalizeMessage(response.data.data);
}

/**
 * Edit a message.
 */
export async function editMessage(
  conversationId: number,
  messageId: number,
  content: string
): Promise<Message> {
  const response = await api.put<{ data: any }>(
    `/conversations/${conversationId}/messages/${messageId}`,
    { content }
  );
  return normalizeMessage(response.data.data);
}

/**
 * Delete a message.
 */
export async function deleteMessage(conversationId: number, messageId: number): Promise<void> {
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
export async function toggleMute(conversationId: number): Promise<{ muted: boolean }> {
  const response = await api.put<{ data: { muted: boolean } }>(
    `/conversations/${conversationId}/mute`
  );
  return response.data.data;
}

/**
 * Add a participant to a group conversation.
 */
export async function addParticipant(conversationId: number, userId: number): Promise<Participant> {
  const response = await api.post<{ data: any }>(
    `/conversations/${conversationId}/participants`,
    { user_id: userId }
  );
  return normalizeParticipant(response.data.data);
}

/**
 * Remove a participant from a group conversation.
 */
export async function removeParticipant(conversationId: number, userId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}/participants/${userId}`);
}

/**
 * Leave a group conversation.
 */
export async function leaveConversation(conversationId: number): Promise<void> {
  await api.post(`/conversations/${conversationId}/leave`);
}

/**
 * Delete a conversation (only conversation creator can delete).
 */
export async function deleteConversation(conversationId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}`);
}

// ============================================================================
// User-level endpoints
// ============================================================================

/**
 * List all conversations for the current user across all organizations.
 */
export async function listAllConversations(): Promise<Conversation[]> {
  const response = await api.get<{ data: any[] }>('/me/conversations');
  return (response.data.data || []).map(normalizeConversation);
}

/**
 * Get total unread count across all organizations.
 */
export async function getTotalUnread(): Promise<number> {
  const response = await api.get<{ data: { unread_count: number } }>('/me/unread-count');
  return response.data.data.unread_count;
}

// ============================================================================
// Support conversation endpoints
// ============================================================================

/**
 * Check if the user has an existing support conversation (read-only, no creation).
 * Returns the conversation or null.
 */
export async function checkSupportConversation(): Promise<Conversation | null> {
  const response = await api.get<{ conversation: any }>('/support/conversation/check');
  if (!response.data.conversation) return null;
  return normalizeConversation(response.data.conversation);
}

/**
 * Get or create the user's support conversation.
 */
export async function getOrCreateSupportConversation(): Promise<Conversation> {
  const response = await api.get<{ conversation: any }>('/support/conversation');
  return normalizeConversation(response.data.conversation);
}

/**
 * Send a message to the support conversation.
 */
export async function sendSupportMessage(content: string): Promise<Message> {
  const response = await api.post<{ message: any }>('/support/conversation/messages', { content });
  return normalizeMessage(response.data.message);
}

/**
 * Get messages from the support conversation.
 */
export async function getSupportMessages(limit = 50, offset = 0): Promise<Message[]> {
  const response = await api.get<{ messages: any[] }>('/support/conversation/messages', {
    params: { limit, offset }
  });
  return (response.data.messages || []).map(normalizeMessage);
}
