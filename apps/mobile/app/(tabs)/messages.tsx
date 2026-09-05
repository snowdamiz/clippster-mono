import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { ConversationRow } from '@/components/messaging/ConversationRow';
import { NewConversationSheet } from '@/components/messaging/NewConversationSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useMessaging } from '@/context/MessagingContext';
import { appAlert } from '@/lib/appAlert';
import { tokens } from '@/theme/tokens';

export default function MessagesScreen() {
  const { user } = useAuth();
  const {
    conversations,
    unreadCounts,
    isLoading,
    isInitialized,
    refreshConversations,
    startSupportConversation,
    fetchTotalUnread,
  } = useMessaging();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [openingSupport, setOpeningSupport] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshConversations();
      void fetchTotalUnread();
    }, [refreshConversations, fetchTotalUnread]),
  );

  const supportConversation = useMemo(
    () => conversations.find((c) => c.type === 'support') ?? null,
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withoutSupport = conversations.filter((c) => c.type !== 'support');
    if (!q) return withoutSupport;
    return withoutSupport.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const preview = (c.lastMessagePreview || '').toLowerCase();
      const participantNames = c.participants
        .map((p) => p.user?.displayName || '')
        .join(' ')
        .toLowerCase();
      return name.includes(q) || preview.includes(q) || participantNames.includes(q);
    });
  }, [conversations, search]);

  const openConversation = (id: number) => {
    router.push(`/messages/${id}` as never);
  };

  const openSupport = async () => {
    if (supportConversation) {
      openConversation(supportConversation.id);
      return;
    }
    setOpeningSupport(true);
    try {
      const conversation = await startSupportConversation();
      openConversation(conversation.id);
    } catch (error) {
      appAlert(
        'Support unavailable',
        error instanceof Error ? error.message : 'Could not open support chat',
      );
    } finally {
      setOpeningSupport(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
      await fetchTotalUnread();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Messages"
        rightAction={
          <Pressable
            onPress={() => setShowNew(true)}
            className="h-9 w-9 items-center justify-center rounded-full bg-surfaceMuted"
          >
            <Ionicons name="add" size={22} color={tokens.colors.accent} />
          </Pressable>
        }
      />

      <View className="border-b border-border px-4 py-2">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          autoCapitalize="none"
          autoCorrect={false}
          className="py-2.5"
        />
      </View>

      <Pressable
        onPress={() => void openSupport()}
        disabled={openingSupport}
        className="flex-row items-center gap-3 border-b border-border bg-accent/5 px-4 py-3"
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent/15">
          {openingSupport ? (
            <ActivityIndicator color={tokens.colors.accent} />
          ) : (
            <Ionicons name="headset-outline" size={22} color={tokens.colors.accent} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-foreground">Clippster Support</Text>
          <Text className="text-sm text-muted" numberOfLines={1}>
            {supportConversation?.lastMessagePreview || 'Message customer service'}
          </Text>
        </View>
        {supportConversation && (unreadCounts[supportConversation.id] || 0) > 0 ? (
          <View className="min-w-[20px] items-center rounded-full bg-accent px-1.5 py-0.5">
            <Text className="text-[11px] font-bold text-white">
              {unreadCounts[supportConversation.id]}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {!isInitialized && isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={tokens.colors.accent}
            />
          }
          ListEmptyComponent={
            <View className="px-4 pt-8">
              <EmptyState
                icon="chatbubbles-outline"
                title="No conversations yet"
                subtitle="Start a direct message or wait for someone to reach out."
              />
            </View>
          }
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              currentUserId={user?.id}
              unreadCount={unreadCounts[item.id] || 0}
              onPress={() => openConversation(item.id)}
            />
          )}
        />
      )}

      <NewConversationSheet
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={openConversation}
      />
    </View>
  );
}
