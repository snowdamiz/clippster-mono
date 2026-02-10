import { api } from '@/lib/api'

// ============================================================================
// Types
// ============================================================================

export interface Participant {
  id: number
  userId: number
  user_id?: number
  role: 'admin' | 'member'
  joinedAt: string
  joined_at?: string
  muted: boolean
  user: {
    id: number
    displayName?: string
    display_name?: string
    avatarUrl?: string | null
    avatar_url?: string | null
  } | null
}

export interface Conversation {
  id: number
  type: 'direct' | 'group' | 'announcement'
  name: string | null
  organizationId?: number
  organization_id?: number
  createdByUserId?: number
  created_by_user_id?: number
  lastMessageAt?: string | null
  last_message_at?: string | null
  lastMessagePreview?: string | null
  last_message_preview?: string | null
  createdAt?: string
  created_at?: string
  participants: Participant[]
  unreadCount?: number
  unread_count?: number
  muted?: boolean
}

export interface Message {
  id: number
  conversationId?: number
  conversation_id?: number
  senderId?: number | null
  sender_id?: number | null
  content: string
  messageType?: 'text' | 'system'
  message_type?: 'text' | 'system'
  editedAt?: string | null
  edited_at?: string | null
  deletedAt?: string | null
  deleted_at?: string | null
  insertedAt?: string
  inserted_at?: string
  sender: {
    id: number
    displayName?: string
    display_name?: string
    avatarUrl?: string | null
    avatar_url?: string | null
  } | null
  readBy?: number[]
  read_by?: number[]
}

export interface UnreadCounts {
  [conversationId: string]: number
}

// ============================================================================
// Normalization helpers
// ============================================================================

export function normalizeParticipant(p: any): Participant {
  return {
    id: p.id,
    userId: p.userId ?? p.user_id,
    role: p.role,
    joinedAt: p.joinedAt ?? p.joined_at ?? '',
    muted: p.muted ?? false,
    user: p.user
      ? {
          id: p.user.id,
          displayName: p.user.displayName ?? p.user.display_name ?? '',
          avatarUrl: p.user.avatarUrl ?? p.user.avatar_url ?? null,
        }
      : null,
  }
}

export function normalizeConversation(c: any): Conversation {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    organizationId: c.organizationId ?? c.organization_id,
    createdByUserId: c.createdByUserId ?? c.created_by_user_id,
    lastMessageAt: c.lastMessageAt ?? c.last_message_at ?? null,
    lastMessagePreview: c.lastMessagePreview ?? c.last_message_preview ?? null,
    createdAt: c.createdAt ?? c.created_at ?? '',
    participants: (c.participants || []).map(normalizeParticipant),
    unreadCount: c.unreadCount ?? c.unread_count ?? 0,
    muted: c.muted ?? false,
  }
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
    sender: m.sender
      ? {
          id: m.sender.id,
          displayName: m.sender.displayName ?? m.sender.display_name ?? '',
          avatarUrl: m.sender.avatarUrl ?? m.sender.avatar_url ?? null,
        }
      : null,
    readBy: m.readBy ?? m.read_by ?? [],
  }
}

// ============================================================================
// Organization-scoped endpoints
// ============================================================================

export async function listConversations(orgId: number): Promise<Conversation[]> {
  // Load both org-scoped and global conversations, merge by ID
  const [orgResponse, globalResponse] = await Promise.all([
    api.get<{ data: any[] }>(`/organizations/${orgId}/messaging/conversations`).catch(() => ({ data: [] })),
    api.get<{ data: any[] }>('/me/conversations').catch(() => ({ data: [] })),
  ])
  const merged = new Map<number, any>()
  for (const conv of (orgResponse.data || [])) merged.set(conv.id, conv)
  for (const conv of (globalResponse.data || [])) merged.set(conv.id, conv)
  return Array.from(merged.values()).map(normalizeConversation)
}

export async function createDirectConversation(orgId: number, userId: number): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    `/organizations/${orgId}/messaging/conversations/direct`,
    { user_id: userId }
  )
  return normalizeConversation(response.data)
}

export async function createGlobalDirectConversation(userId: number): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    '/messaging/conversations/global-direct',
    { user_id: userId }
  )
  return normalizeConversation(response.data)
}

export async function createGroupConversation(
  orgId: number,
  name: string,
  memberIds: number[]
): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    `/organizations/${orgId}/messaging/conversations/group`,
    { name, member_ids: memberIds }
  )
  return normalizeConversation(response.data)
}

export async function createAnnouncement(orgId: number, content: string): Promise<Conversation> {
  const response = await api.post<{ data: any }>(
    `/organizations/${orgId}/messaging/conversations/announcement`,
    { content }
  )
  return normalizeConversation(response.data)
}

export async function getUnreadCounts(orgId: number): Promise<UnreadCounts> {
  const response = await api.get<{ data: UnreadCounts }>(
    `/organizations/${orgId}/messaging/unread`
  )
  return response.data || {}
}

// ============================================================================
// Conversation-specific endpoints
// ============================================================================

export async function getMessages(
  conversationId: number,
  opts?: { before?: number; limit?: number }
): Promise<Message[]> {
  let path = `/conversations/${conversationId}/messages`
  const params: string[] = []
  if (opts?.before) params.push(`before=${opts.before}`)
  if (opts?.limit) params.push(`limit=${opts.limit}`)
  if (params.length) path += `?${params.join('&')}`

  const response = await api.get<{ data: any[] }>(path)
  return (response.data || []).map(normalizeMessage)
}

export async function sendMessageRest(conversationId: number, content: string): Promise<Message> {
  const response = await api.post<{ data: any }>(
    `/conversations/${conversationId}/messages`,
    { content }
  )
  return normalizeMessage(response.data)
}

export async function editMessageRest(
  conversationId: number,
  messageId: number,
  content: string
): Promise<Message> {
  const response = await api.put<{ data: any }>(
    `/conversations/${conversationId}/messages/${messageId}`,
    { content }
  )
  return normalizeMessage(response.data)
}

export async function deleteMessageRest(conversationId: number, messageId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}/messages/${messageId}`)
}

export async function markAsRead(conversationId: number): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`)
}

export async function toggleMute(conversationId: number): Promise<{ muted: boolean }> {
  const response = await api.put<{ data: { muted: boolean } }>(
    `/conversations/${conversationId}/mute`
  )
  return response.data
}

export async function addParticipant(conversationId: number, userId: number): Promise<Participant> {
  const response = await api.post<{ data: any }>(
    `/conversations/${conversationId}/participants`,
    { user_id: userId }
  )
  return normalizeParticipant(response.data)
}

export async function removeParticipant(conversationId: number, userId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}/participants/${userId}`)
}

export async function leaveConversation(conversationId: number): Promise<void> {
  await api.post(`/conversations/${conversationId}/leave`)
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await api.delete(`/conversations/${conversationId}`)
}

export async function getTotalUnread(): Promise<number> {
  const response = await api.get<{ data: { unread_count: number } }>('/me/unread-count')
  return response.data?.unread_count ?? 0
}
