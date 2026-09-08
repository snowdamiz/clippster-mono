import type { MessagingMessage } from '@clippster/api-client';
import { Image, Pressable, Text, View } from 'react-native';
import { formatMessageTime } from './conversationUtils';

interface MessageBubbleProps {
  message: MessagingMessage;
  isOwn: boolean;
  onLongPress?: () => void;
}

export function MessageBubble({ message, isOwn, onLongPress }: MessageBubbleProps) {
  if (message.messageType === 'system') {
    return (
      <View className="my-2 items-center px-6">
        <Text className="text-center text-xs text-muted">{message.content}</Text>
      </View>
    );
  }

  if (message.deletedAt) {
    return (
      <View className={`my-1 max-w-[80%] ${isOwn ? 'self-end' : 'self-start'}`}>
        <View className="rounded-2xl border border-border bg-surfaceMuted px-3 py-2">
          <Text className="italic text-muted">Message deleted</Text>
        </View>
      </View>
    );
  }

  const attachments = message.attachments ?? [];

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      className={`my-1 max-w-[80%] ${isOwn ? 'self-end' : 'self-start'}`}
    >
      {!isOwn && message.sender?.displayName ? (
        <Text className="mb-0.5 ml-1 text-[11px] text-muted">{message.sender.displayName}</Text>
      ) : null}
      <View
        className={`overflow-hidden rounded-2xl px-3 py-2 ${
          isOwn ? 'rounded-br-md bg-accent' : 'rounded-bl-md bg-surfaceMuted'
        }`}
      >
        {attachments.map((attachment) => (
          <Image
            key={attachment.id}
            source={{ uri: attachment.thumbnailUrl || attachment.url }}
            className="mb-2 h-40 w-56 rounded-lg"
            resizeMode="cover"
          />
        ))}
        {message.content ? (
          <Text className={`text-[15px] leading-5 ${isOwn ? 'text-white' : 'text-foreground'}`}>
            {message.content}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center justify-end gap-1">
          {message.editedAt ? (
            <Text className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-muted'}`}>edited</Text>
          ) : null}
          <Text className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-muted'}`}>
            {formatMessageTime(message.insertedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
