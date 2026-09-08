import type { MessagingConversation } from '@clippster/api-client';

export function conversationDisplayName(
  conversation: MessagingConversation,
  currentUserId: number | null | undefined,
): string {
  if (conversation.type === 'support') return 'Clippster Support';
  if (conversation.name?.trim()) return conversation.name.trim();

  if (conversation.type === 'direct' || conversation.type === 'group') {
    const others = conversation.participants.filter((p) => p.userId !== currentUserId);
    const names = others
      .map((p) => p.user?.displayName)
      .filter((name): name is string => Boolean(name?.trim()));
    if (names.length > 0) return names.join(', ');
  }

  if (conversation.type === 'announcement') return 'Announcement';
  return 'Conversation';
}

export function conversationSubtitle(conversation: MessagingConversation): string {
  if (conversation.type === 'support') return 'Customer service';
  if (conversation.type === 'announcement') return 'Announcement';
  if (conversation.type === 'group') {
    return `${conversation.participants.length} members`;
  }
  return 'Direct message';
}

export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
