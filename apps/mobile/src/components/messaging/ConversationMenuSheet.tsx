import type { MessagingConversation, MessagingUserSearchResult } from '@clippster/api-client';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/input';
import { useMessaging } from '@/context/MessagingContext';
import { messagingApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

interface ConversationMenuSheetProps {
  visible: boolean;
  conversation: MessagingConversation | null;
  currentUserId: number | null | undefined;
  onClose: () => void;
  onLeftOrDeleted: () => void;
}

export function ConversationMenuSheet({
  visible,
  conversation,
  currentUserId,
  onClose,
  onLeftOrDeleted,
}: ConversationMenuSheetProps) {
  const {
    toggleMute,
    leaveConversation,
    deleteConversation,
    addParticipant,
    removeParticipant,
  } = useMessaging();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<MessagingUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setUsers([]);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || conversation?.type !== 'group') return;
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      void messagingApi
        .searchUsers(q)
        .then(setUsers)
        .catch(() => setUsers([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, visible, conversation?.type]);

  if (!conversation) return null;

  const isCreator = conversation.createdByUserId === currentUserId;
  const myParticipant = conversation.participants.find((p) => p.userId === currentUserId);
  const isGroupAdmin = myParticipant?.role === 'admin' || isCreator;
  const isGroup = conversation.type === 'group';
  const canLeave = isGroup && !isCreator;
  const canDelete = isCreator && conversation.type !== 'support';

  const run = async (action: () => Promise<void>, closeAfter = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (closeAfter) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Conversation"
      variant="action"
      dismissOnBackdrop={!busy}
      maxHeightClassName="max-h-[85%]"
    >
      <View className="gap-1 pb-2">
        {conversation.type !== 'support' ? (
          <MenuButton
            label={conversation.muted ? 'Unmute' : 'Mute'}
            disabled={busy}
            onPress={() => void run(async () => { await toggleMute(conversation.id); })}
          />
        ) : null}

        {canLeave ? (
          <MenuButton
            label="Leave conversation"
            disabled={busy}
            destructive
            onPress={() =>
              void run(async () => {
                await leaveConversation(conversation.id);
                onLeftOrDeleted();
              })
            }
          />
        ) : null}

        {canDelete ? (
          <MenuButton
            label="Delete conversation"
            disabled={busy}
            destructive
            onPress={() =>
              void run(async () => {
                await deleteConversation(conversation.id);
                onLeftOrDeleted();
              })
            }
          />
        ) : null}

        {isGroup ? (
          <View className="mt-2 rounded-lg bg-surfaceMuted px-3 py-2">
            <Text className="mb-1 text-xs font-semibold uppercase text-muted">Participants</Text>
            {conversation.participants.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between py-1.5">
                <Text className="min-w-0 flex-1 text-sm text-foreground">
                  {p.user?.displayName || `User ${p.userId}`}
                  {p.role === 'admin' ? ' · admin' : ''}
                </Text>
                {isGroupAdmin && p.userId !== currentUserId ? (
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        await removeParticipant(conversation.id, p.userId);
                      }, false)
                    }
                  >
                    <Text className="text-xs text-destructive">Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {isGroupAdmin ? (
              <View className="mt-2 border-t border-border pt-2">
                <Text className="mb-1 text-xs text-muted">Add member</Text>
                <Input
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search users…"
                  autoCapitalize="none"
                  className="py-2"
                />
                {searching ? (
                  <View className="mt-2 items-center">
                    <ActivityIndicator color={tokens.colors.accent} />
                  </View>
                ) : (
                  <ScrollView className="max-h-28">
                    {users
                      .filter((u) => !conversation.participants.some((p) => p.userId === u.id))
                      .map((user) => (
                        <Pressable
                          key={user.id}
                          disabled={busy}
                          onPress={() =>
                            void run(async () => {
                              await addParticipant(conversation.id, user.id);
                              setQuery('');
                              setUsers([]);
                            }, false)
                          }
                          className="py-2"
                        >
                          <Text className="text-sm text-accent">
                            + {user.name || user.email}
                          </Text>
                        </Pressable>
                      ))}
                  </ScrollView>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {busy ? (
          <View className="mt-2 items-center">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : null}
        {error ? <Text className="mt-2 text-sm text-destructive">{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}

function MenuButton({
  label,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="rounded-lg bg-surfaceMuted px-4 py-3.5"
    >
      <Text
        className={`text-center text-[15px] font-medium ${
          destructive ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
