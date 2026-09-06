import { Ionicons } from '@expo/vector-icons';
import type { MessagingConversation } from '@clippster/api-client';
import { Image, Pressable, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';
import {
  conversationDisplayName,
  conversationSubtitle,
  formatMessageTime,
} from './conversationUtils';

interface ConversationRowProps {
  conversation: MessagingConversation;
  currentUserId: number | null | undefined;
  unreadCount?: number;
  onPress: () => void;
  pinned?: boolean;
}

function typeIcon(type: MessagingConversation['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'support':
      return 'headset-outline';
    case 'group':
      return 'people-outline';
    case 'announcement':
      return 'megaphone-outline';
    default:
      return 'person-outline';
  }
}

export function ConversationRow({
  conversation,
  currentUserId,
  unreadCount = 0,
  onPress,
  pinned,
}: ConversationRowProps) {
  const title = conversationDisplayName(conversation, currentUserId);
  const other = conversation.participants.find((p) => p.userId !== currentUserId);
  const avatarUrl = other?.user?.avatarUrl;
  const preview = conversation.lastMessagePreview?.trim() || conversationSubtitle(conversation);
  const unread = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 border-b border-border px-4 py-3 ${
        pinned ? 'bg-accent/5' : 'bg-background'
      }`}
    >
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-surfaceMuted">
        {avatarUrl && conversation.type === 'direct' ? (
          <Image source={{ uri: avatarUrl }} className="h-12 w-12" />
        ) : (
          <Ionicons name={typeIcon(conversation.type)} size={22} color={tokens.colors.accent} />
        )}
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`min-w-0 flex-1 text-[15px] ${unread ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="text-xs text-muted">
            {formatMessageTime(conversation.lastMessageAt)}
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text
            className={`min-w-0 flex-1 text-sm ${unread ? 'font-medium text-foreground' : 'text-muted'}`}
            numberOfLines={1}
          >
            {conversation.muted ? 'Muted · ' : ''}
            {preview}
          </Text>
          {unread ? (
            <View className="min-w-[20px] items-center rounded-full bg-accent px-1.5 py-0.5">
              <Text className="text-[11px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
