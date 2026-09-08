import type { MessagingUserSearchResult, Organization } from '@clippster/api-client';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/input';
import { messagingApi, organizationsApi } from '@/services/api';
import { tokens } from '@/theme/tokens';
import { useMessaging } from '@/context/MessagingContext';

type ComposeMode = 'direct' | 'group' | 'announcement';

interface NewConversationSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (conversationId: number) => void;
}

export function NewConversationSheet({ visible, onClose, onCreated }: NewConversationSheetProps) {
  const {
    startGlobalDirectConversation,
    startDirectConversation,
    startGroupConversation,
    sendAnnouncement,
  } = useMessaging();

  const [mode, setMode] = useState<ComposeMode>('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<MessagingUserSearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminOrgs = orgs.filter((o) => o.role === 'owner' || o.role === 'admin');

  useEffect(() => {
    if (!visible) return;
    setMode('direct');
    setQuery('');
    setUsers([]);
    setSelectedIds([]);
    setGroupName('');
    setAnnouncement('');
    setError(null);
    void organizationsApi.listMyOrganizations().then((res) => {
      if (res.success) {
        setOrgs(res.organizations);
        setOrgId(res.organizations[0]?.id ?? null);
      }
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
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
  }, [query, visible]);

  const toggleUser = useCallback((userId: number) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'direct') {
        if (selectedIds.length !== 1) {
          setError('Select one person to message');
          return;
        }
        const targetId = selectedIds[0];
        const conversation = orgId
          ? await startDirectConversation(orgId, targetId).catch(() =>
              startGlobalDirectConversation(targetId),
            )
          : await startGlobalDirectConversation(targetId);
        onCreated(conversation.id);
        onClose();
        return;
      }

      if (mode === 'group') {
        if (!orgId) {
          setError('Join an organization to create a group');
          return;
        }
        if (!groupName.trim() || selectedIds.length === 0) {
          setError('Group name and at least one member required');
          return;
        }
        const conversation = await startGroupConversation(orgId, groupName.trim(), selectedIds);
        onCreated(conversation.id);
        onClose();
        return;
      }

      if (mode === 'announcement') {
        if (!orgId || !adminOrgs.some((o) => o.id === orgId)) {
          setError('Only org admins can send announcements');
          return;
        }
        if (!announcement.trim()) {
          setError('Announcement content required');
          return;
        }
        const conversation = await sendAnnouncement(orgId, announcement.trim());
        onCreated(conversation.id);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="New conversation"
      primaryAction={{
        title: submitting ? 'Creating…' : mode === 'announcement' ? 'Send' : 'Start',
        onPress: () => void handleSubmit(),
        disabled: submitting,
      }}
      secondaryAction={{ title: 'Cancel', onPress: onClose }}
      keyboardAvoiding
      maxHeightClassName="max-h-[90%]"
    >
      <View className="gap-3">
        <View className="flex-row gap-2">
          {(['direct', 'group', 'announcement'] as ComposeMode[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setMode(item)}
              className={`rounded-full px-3 py-1.5 ${
                mode === item ? 'bg-accent' : 'bg-surfaceMuted'
              }`}
            >
              <Text
                className={`text-xs font-semibold capitalize ${
                  mode === item ? 'text-white' : 'text-muted'
                }`}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        {(mode === 'group' || mode === 'announcement' || (mode === 'direct' && orgs.length > 0)) &&
        orgs.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {orgs
              .filter((o) => (mode === 'announcement' ? adminOrgs.some((a) => a.id === o.id) : true))
              .map((org) => (
                <Pressable
                  key={org.id}
                  onPress={() => setOrgId(org.id)}
                  className={`mr-2 rounded-full px-3 py-1.5 ${
                    orgId === org.id ? 'bg-accent/20 border border-accent' : 'bg-surfaceMuted'
                  }`}
                >
                  <Text className="text-xs text-foreground">{org.name}</Text>
                </Pressable>
              ))}
          </ScrollView>
        ) : null}

        {mode === 'group' ? (
          <Input
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            autoCapitalize="words"
          />
        ) : null}

        {mode === 'announcement' ? (
          <Input
            value={announcement}
            onChangeText={setAnnouncement}
            placeholder="Announcement message"
            multiline
            className="min-h-[80px]"
          />
        ) : (
          <>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search people…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching ? (
              <ActivityIndicator color={tokens.colors.accent} />
            ) : (
              <View className="max-h-56">
                <ScrollView>
                  {users.map((user) => {
                    const selected = selectedIds.includes(user.id);
                    return (
                      <Pressable
                        key={user.id}
                        onPress={() => {
                          if (mode === 'direct') {
                            setSelectedIds([user.id]);
                          } else {
                            toggleUser(user.id);
                          }
                        }}
                        className={`mb-1 flex-row items-center justify-between rounded-lg px-3 py-2.5 ${
                          selected ? 'bg-accent/15' : 'bg-surfaceMuted'
                        }`}
                      >
                        <View className="min-w-0 flex-1">
                          <Text className="font-medium text-foreground" numberOfLines={1}>
                            {user.name || user.email}
                          </Text>
                          <Text className="text-xs text-muted" numberOfLines={1}>
                            {user.email}
                          </Text>
                        </View>
                        {selected ? (
                          <Text className="text-xs font-semibold text-accent">Selected</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {query.trim().length >= 2 && users.length === 0 && !searching ? (
                    <Text className="py-4 text-center text-sm text-muted">No users found</Text>
                  ) : null}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}
