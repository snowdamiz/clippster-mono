import type { ApiClient } from './createApiClient';
import type { ReactNativeUploadFile } from './userPostsApi';

// ============================================================================
// Types
// ============================================================================

export interface MessagingParticipant {
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

export interface MessagingConversation {
  id: number;
  type: 'direct' | 'group' | 'announcement' | 'support';
  name: string | null;
  organizationId: number | null;
  createdByUserId: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  participants: MessagingParticipant[];
  unreadCount?: number;
  muted?: boolean;
  status?: string;
}

export interface MessageAttachment {
  id: number;
  attachmentType: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
}

export interface MessagingMessage {
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
  attachments?: MessageAttachment[];
}

export interface UnreadCounts {
  [conversationId: string]: number;
}

export interface MessagingUserSearchResult {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  accountType: string | null;
  hasClipperProfile: boolean;
}

// ============================================================================
// Normalization helpers (snake_case server response → camelCase)
// ============================================================================

function normalizeParticipant(p: any): MessagingParticipant {
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
  };
}

export function normalizeConversation(c: any): MessagingConversation {
  return {
    id: c.id,
    type: c.type,
    name: c.name ?? null,
    organizationId: c.organizationId ?? c.organization_id ?? null,
    createdByUserId: c.createdByUserId ?? c.created_by_user_id,
    lastMessageAt: c.lastMessageAt ?? c.last_message_at ?? null,
    lastMessagePreview: c.lastMessagePreview ?? c.last_message_preview ?? null,
    createdAt: c.createdAt ?? c.created_at ?? '',
    participants: (c.participants || []).map(normalizeParticipant),
    unreadCount: c.unreadCount ?? c.unread_count,
    muted: c.muted ?? false,
    status: c.status,
  };
}

function normalizeAttachment(a: any): MessageAttachment {
  return {
    id: a.id,
    attachmentType: a.attachmentType ?? a.attachment_type ?? 'image',
    url: a.url,
    thumbnailUrl: a.thumbnailUrl ?? a.thumbnail_url ?? null,
    filename: a.filename,
    mimeType: a.mimeType ?? a.mime_type,
    fileSize: a.fileSize ?? a.file_size,
    width: a.width ?? null,
    height: a.height ?? null,
  };
}

export function normalizeMessage(m: any): MessagingMessage {
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
    attachments: (m.attachments || []).map(normalizeAttachment),
  };
}

function normalizeSearchUser(u: any): MessagingUserSearchResult {
  return {
    id: u.id,
    name: u.name ?? null,
    email: u.email ?? '',
    avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
    accountType: u.accountType ?? u.account_type ?? null,
    hasClipperProfile: Boolean(u.hasClipperProfile ?? u.has_clipper_profile),
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  return `?${qs}`;
}

export function createMessagingApi(client: ApiClient, options?: { baseUrl?: string }) {
  const attachmentBaseUrl = options?.baseUrl?.replace(/\/$/, '') ?? '';

  return {
    async listConversations(orgId: number): Promise<MessagingConversation[]> {
      const [orgResponse, globalResponse] = await Promise.all([
        client
          .get<{ data: any[] }>(`/organizations/${orgId}/messaging/conversations`)
          .catch(() => ({ data: [] as any[] })),
        client.get<{ data: any[] }>('/me/conversations').catch(() => ({ data: [] as any[] })),
      ]);
      const merged = new Map<number, MessagingConversation>();
      for (const conv of orgResponse.data || []) merged.set(conv.id, normalizeConversation(conv));
      for (const conv of globalResponse.data || []) merged.set(conv.id, normalizeConversation(conv));
      return Array.from(merged.values());
    },

    async listAllConversations(): Promise<MessagingConversation[]> {
      const response = await client.get<{ data: any[] }>('/me/conversations');
      return (response.data || []).map(normalizeConversation);
    },

    async createDirectConversation(orgId: number, userId: number): Promise<MessagingConversation> {
      const response = await client.post<{ data: any }>(
        `/organizations/${orgId}/messaging/conversations/direct`,
        { user_id: userId },
      );
      return normalizeConversation(response.data);
    },

    async createGlobalDirectConversation(userId: number): Promise<MessagingConversation> {
      const response = await client.post<{ data: any }>('/messaging/conversations/global-direct', {
        user_id: userId,
      });
      return normalizeConversation(response.data);
    },

    async createGroupConversation(
      orgId: number,
      name: string,
      memberIds: number[],
    ): Promise<MessagingConversation> {
      const response = await client.post<{ data: any }>(
        `/organizations/${orgId}/messaging/conversations/group`,
        { name, member_ids: memberIds },
      );
      return normalizeConversation(response.data);
    },

    async createAnnouncement(orgId: number, content: string): Promise<MessagingConversation> {
      const response = await client.post<{ data: any }>(
        `/organizations/${orgId}/messaging/conversations/announcement`,
        { content },
      );
      return normalizeConversation(response.data);
    },

    async getUnreadCounts(orgId: number): Promise<UnreadCounts> {
      const response = await client.get<{ data: UnreadCounts }>(
        `/organizations/${orgId}/messaging/unread`,
      );
      return response.data;
    },

    async getConversation(conversationId: number): Promise<MessagingConversation> {
      const response = await client.get<{ data: any }>(`/conversations/${conversationId}`);
      return normalizeConversation(response.data);
    },

    async getMessages(
      conversationId: number,
      opts?: { before?: number; limit?: number },
    ): Promise<MessagingMessage[]> {
      const query = buildQuery({ before: opts?.before, limit: opts?.limit });
      const response = await client.get<{ data: any[] }>(
        `/conversations/${conversationId}/messages${query}`,
      );
      return (response.data || []).map(normalizeMessage);
    },

    async sendMessage(conversationId: number, content: string): Promise<MessagingMessage> {
      const response = await client.post<{ data: any }>(`/conversations/${conversationId}/messages`, {
        content,
      });
      return normalizeMessage(response.data);
    },

    async editMessage(
      conversationId: number,
      messageId: number,
      content: string,
    ): Promise<MessagingMessage> {
      const response = await client.put<{ data: any }>(
        `/conversations/${conversationId}/messages/${messageId}`,
        { content },
      );
      return normalizeMessage(response.data);
    },

    async deleteMessage(conversationId: number, messageId: number): Promise<void> {
      await client.delete(`/conversations/${conversationId}/messages/${messageId}`);
    },

    async markAsRead(conversationId: number): Promise<void> {
      await client.post(`/conversations/${conversationId}/read`);
    },

    async toggleMute(conversationId: number): Promise<{ muted: boolean }> {
      const response = await client.put<{ data: { muted: boolean } }>(
        `/conversations/${conversationId}/mute`,
      );
      return response.data;
    },

    async addParticipant(conversationId: number, userId: number): Promise<MessagingParticipant> {
      const response = await client.post<{ data: any }>(
        `/conversations/${conversationId}/participants`,
        { user_id: userId },
      );
      return normalizeParticipant(response.data);
    },

    async removeParticipant(conversationId: number, userId: number): Promise<void> {
      await client.delete(`/conversations/${conversationId}/participants/${userId}`);
    },

    async leaveConversation(conversationId: number): Promise<void> {
      await client.post(`/conversations/${conversationId}/leave`);
    },

    async deleteConversation(conversationId: number): Promise<void> {
      await client.delete(`/conversations/${conversationId}`);
    },

    async getTotalUnread(): Promise<number> {
      const response = await client.get<{ data: { unread_count: number } }>('/me/unread-count');
      return response.data.unread_count;
    },

    async searchUsers(query: string, limit = 20): Promise<MessagingUserSearchResult[]> {
      const qs = buildQuery({ query, limit });
      const response = await client.get<{ data: any[] }>(`/messaging/search-users${qs}`);
      return (response.data || []).map(normalizeSearchUser);
    },

    async checkSupportConversation(): Promise<MessagingConversation | null> {
      const response = await client.get<{ conversation: any }>('/support/conversation/check');
      if (!response.conversation) return null;
      return normalizeConversation(response.conversation);
    },

    async getOrCreateSupportConversation(): Promise<MessagingConversation> {
      const response = await client.get<{ conversation: any }>('/support/conversation');
      return normalizeConversation(response.conversation);
    },

    async sendSupportMessage(content: string): Promise<MessagingMessage> {
      const response = await client.post<{ message: any }>('/support/conversation/messages', {
        content,
      });
      return normalizeMessage(response.message);
    },

    async getSupportMessages(limit = 50, offset = 0): Promise<MessagingMessage[]> {
      const query = buildQuery({ limit, offset });
      const response = await client.get<{ messages: any[] }>(
        `/support/conversation/messages${query}`,
      );
      return (response.messages || []).map(normalizeMessage);
    },

    async uploadMessageAttachments(
      conversationId: number,
      files: ReactNativeUploadFile[] | Blob[],
    ): Promise<any[]> {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file as unknown as Blob);
      }
      const response = await client.post<{ success: boolean; attachments: any[] }>(
        `/conversations/${conversationId}/attachments`,
        formData,
      );
      return response.attachments || [];
    },

    getAttachmentDownloadUrl(attachmentId: number): string {
      const base = attachmentBaseUrl.endsWith('/api')
        ? attachmentBaseUrl
        : `${attachmentBaseUrl}/api`;
      return `${base}/attachments/${attachmentId}/download`;
    },
  };
}

export type MessagingApi = ReturnType<typeof createMessagingApi>;
