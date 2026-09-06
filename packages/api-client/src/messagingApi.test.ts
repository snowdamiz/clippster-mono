import { describe, expect, it } from 'vitest';
import { normalizeConversation, normalizeMessage } from './messagingApi';

describe('messagingApi normalize', () => {
  it('normalizes conversation snake_case fields', () => {
    const conversation = normalizeConversation({
      id: 42,
      type: 'direct',
      name: null,
      organization_id: null,
      created_by_user_id: 7,
      last_message_at: '2026-03-01T12:00:00Z',
      last_message_preview: 'hello',
      created_at: '2026-03-01T11:00:00Z',
      unread_count: 2,
      muted: false,
      participants: [
        {
          id: 1,
          user_id: 7,
          role: 'member',
          joined_at: '2026-03-01T11:00:00Z',
          muted: false,
          user: { id: 7, display_name: 'Alice', avatar_url: null },
        },
      ],
    });

    expect(conversation).toMatchObject({
      id: 42,
      organizationId: null,
      createdByUserId: 7,
      lastMessageAt: '2026-03-01T12:00:00Z',
      lastMessagePreview: 'hello',
      unreadCount: 2,
    });
    expect(conversation.participants[0].userId).toBe(7);
    expect(conversation.participants[0].user?.displayName).toBe('Alice');
  });

  it('normalizes message snake_case fields and attachments', () => {
    const message = normalizeMessage({
      id: 9,
      conversation_id: 42,
      sender_id: 7,
      content: 'hi',
      message_type: 'text',
      edited_at: null,
      deleted_at: null,
      inserted_at: '2026-03-01T12:00:00Z',
      sender: { id: 7, display_name: 'Alice', avatar_url: null },
      read_by: [7],
      attachments: [
        {
          id: 1,
          attachment_type: 'image',
          url: 'https://cdn.example/a.jpg',
          thumbnail_url: null,
          filename: 'a.jpg',
          mime_type: 'image/jpeg',
          file_size: 100,
          width: 10,
          height: 10,
        },
      ],
    });

    expect(message.conversationId).toBe(42);
    expect(message.senderId).toBe(7);
    expect(message.sender?.displayName).toBe('Alice');
    expect(message.attachments?.[0].mimeType).toBe('image/jpeg');
  });
});
