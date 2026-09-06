import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConversationMenuSheet } from '@/components/messaging/ConversationMenuSheet';
import { conversationDisplayName } from '@/components/messaging/conversationUtils';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { MessageComposer } from '@/components/messaging/MessageComposer';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/context/MessagingContext';
import { appAlert } from '@/lib/appAlert';
import { tokens } from '@/theme/tokens';

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    conversations,
    activeConversation,
    activeMessages,
    activeTypingUserIds,
    isLoadingMessages,
    setActiveConversation,
    loadOlderMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    uploadAttachments,
  } = useMessaging();

  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<FlatList>(null);

  const conversation =
    activeConversation?.id === conversationId
      ? activeConversation
      : conversations.find((c) => c.id === conversationId) ?? null;

  useEffect(() => {
    if (!Number.isFinite(conversationId)) return;
    void setActiveConversation(conversationId);
    return () => {
      void setActiveConversation(null);
    };
  }, [conversationId, setActiveConversation]);

  const editingMessage = useMemo(
    () => (editingId != null ? activeMessages.find((m) => m.id === editingId) : null),
    [activeMessages, editingId],
  );

  const typingNames = useMemo(() => {
    if (!conversation) return [];
    return activeTypingUserIds
      .map((uid) => conversation.participants.find((p) => p.userId === uid)?.user?.displayName)
      .filter((name): name is string => Boolean(name));
  }, [activeTypingUserIds, conversation]);

  const title = conversation
    ? conversationDisplayName(conversation, user?.id)
    : 'Conversation';

  const handleSend = async (content: string, attachmentData?: unknown[]) => {
    setSending(true);
    try {
      if (editingId != null) {
        await editMessage(editingId, content);
        setEditingId(null);
      } else {
        await sendMessage(content, attachmentData);
      }
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      appAlert('Send failed', error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (messageId: number, isOwn: boolean) => {
    if (!isOwn) return;
    Alert.alert('Message', undefined, [
      {
        text: 'Edit',
        onPress: () => setEditingId(messageId),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteMessage(messageId),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!Number.isFinite(conversationId)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted">Invalid conversation</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: insets.top }} className="border-b border-border bg-background">
        <View className="flex-row items-center gap-2 px-3 pb-3 pt-2">
          <Pressable onPress={() => router.back()} className="p-2">
            <Ionicons name="chevron-back" size={24} color={tokens.colors.foreground} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
              {title}
            </Text>
            {conversation?.type === 'group' ? (
              <Text className="text-xs text-muted">
                {conversation.participants.length} members
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => setMenuOpen(true)} className="p-2">
            <Ionicons name="ellipsis-horizontal" size={22} color={tokens.colors.foreground} />
          </Pressable>
        </View>
      </View>

      {isLoadingMessages && activeMessages.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={activeMessages}
          keyExtractor={(item) => String(item.id)}
          className="flex-1 px-3"
          contentContainerStyle={{ paddingVertical: 12, flexGrow: 1, justifyContent: 'flex-end' }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onEndReachedThreshold={0.2}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListHeaderComponent={
            <Pressable
              onPress={() => void loadOlderMessages(conversationId)}
              className="mb-3 items-center py-2"
            >
              <Text className="text-xs text-accent">Load earlier messages</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const isOwn = item.senderId === user?.id;
            return (
              <MessageBubble
                message={item}
                isOwn={isOwn}
                onLongPress={() => handleLongPress(item.id, isOwn)}
              />
            );
          }}
        />
      )}

      <TypingIndicator names={typingNames} />

      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <MessageComposer
          sending={sending}
          onSend={handleSend}
          onTyping={sendTyping}
          onPickImages={(files) => uploadAttachments(conversationId, files)}
          editingContent={editingMessage?.content ?? null}
          onCancelEdit={() => setEditingId(null)}
        />
      </View>

      <ConversationMenuSheet
        visible={menuOpen}
        conversation={conversation}
        currentUserId={user?.id}
        onClose={() => setMenuOpen(false)}
        onLeftOrDeleted={() => router.back()}
      />
    </KeyboardAvoidingView>
  );
}
