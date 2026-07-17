import type { Organization, SocialPlatform, UserSocialAccount } from '@clippster/api-client';
import {
  getSocialPlatformLabel,
  isTokenExpired,
  isTokenExpiringSoon,
} from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms';
import { organizationsApi, userSocialApi } from '@/services/api';
import { startPostForMeOAuth } from '@/services/postForMeOAuth';
import { startPostForMeOrgOAuth } from '@/services/postForMeOrgOAuth';
import { tokens } from '@/theme/tokens';

function AccountCard({
  account,
  onDisconnect,
}: {
  account: UserSocialAccount;
  onDisconnect: (id: number) => void;
}) {
  const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === account.platform);
  const expired = isTokenExpired(account.token_expires_at);
  const expiringSoon = isTokenExpiringSoon(account);

  return (
    <Card className="flex-row items-center gap-3">
      {account.profile_image_url ? (
        <Image source={{ uri: account.profile_image_url }} className="h-12 w-12 rounded-full" />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-full bg-surfaceMuted">
          {platformConfig ? (
            <Ionicons name={platformConfig.icon} size={24} color={tokens.colors.foreground} />
          ) : null}
        </View>
      )}
      <View className="flex-1">
        <Text className="font-semibold text-foreground">@{account.username}</Text>
        <Text className="text-sm text-muted">{getSocialPlatformLabel(account.platform)}</Text>
        {expired ? (
          <Text className="mt-1 text-xs text-red-400">Token expired — reconnect required</Text>
        ) : expiringSoon ? (
          <Text className="mt-1 text-xs text-warning">Token expiring soon</Text>
        ) : account.is_active ? (
          <Text className="mt-1 text-xs text-green-400">Active</Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onDisconnect(account.id)}
        className="rounded-lg border border-border px-3 py-2"
      >
        <Text className="text-sm text-red-400">Disconnect</Text>
      </Pressable>
    </Card>
  );
}

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [orgAccounts, setOrgAccounts] = useState<UserSocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [connectingOrgPlatform, setConnectingOrgPlatform] = useState<SocialPlatform | null>(null);

  const loadAccounts = useCallback(async () => {
    const response = await userSocialApi.listAccounts();
    const list = response.social_accounts ?? response.accounts ?? [];
    setAccounts(list);

    const orgResponse = await organizationsApi.listMyOrganizations();
    if (orgResponse.success) {
      setOrganizations(orgResponse.organizations);
      if (!selectedOrgId && orgResponse.organizations[0]) {
        setSelectedOrgId(orgResponse.organizations[0].id);
      }
    }
  }, [selectedOrgId]);

  const loadOrgAccounts = useCallback(async (orgId: number) => {
    const response = await userSocialApi.listOrgAccounts(orgId);
    setOrgAccounts(response.social_accounts ?? response.accounts ?? []);
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      void loadOrgAccounts(selectedOrgId);
    }
  }, [selectedOrgId, loadOrgAccounts]);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadAccounts();
      if (selectedOrgId) await loadOrgAccounts(selectedOrgId);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadAccounts();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAccounts]);

  async function handleConnect(platform: SocialPlatform) {
    setConnectingPlatform(platform);
    try {
      const result = await startPostForMeOAuth(platform);
      if (result.success) {
        await loadAccounts();
        Alert.alert('Connected', `${getSocialPlatformLabel(platform)} account linked successfully.`);
      } else {
        Alert.alert('Connection failed', result.error ?? 'Could not connect account.');
      }
    } catch (error) {
      Alert.alert(
        'Connection failed',
        error instanceof Error ? error.message : 'Could not connect account.',
      );
    } finally {
      setConnectingPlatform(null);
    }
  }

  function handleDisconnect(accountId: number) {
    Alert.alert('Disconnect account', 'Remove this social account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const response = await userSocialApi.disconnectAccount(accountId);
            if (response.success) {
              await loadAccounts();
            } else {
              Alert.alert('Error', response.error ?? 'Failed to disconnect');
            }
          })();
        },
      },
    ]);
  }

  async function handleOrgConnect(platform: SocialPlatform) {
    if (!selectedOrgId) return;
    setConnectingOrgPlatform(platform);
    try {
      const result = await startPostForMeOrgOAuth(selectedOrgId, platform);
      if (result.success) {
        await loadOrgAccounts(selectedOrgId);
        Alert.alert('Connected', `Organization ${getSocialPlatformLabel(platform)} account linked.`);
      } else {
        Alert.alert('Connection failed', result.error ?? 'Could not connect org account.');
      }
    } finally {
      setConnectingOrgPlatform(null);
    }
  }

  function handleOrgDisconnect(accountId: number) {
    if (!selectedOrgId) return;
    Alert.alert('Disconnect account', 'Remove this organization social account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const response = await userSocialApi.disconnectOrgAccount(selectedOrgId, accountId);
            if (response.success) {
              await loadOrgAccounts(selectedOrgId);
            } else {
              Alert.alert('Error', response.error ?? 'Failed to disconnect');
            }
          })();
        },
      },
    ]);
  }

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Connected Accounts" />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="gap-4 px-4 py-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          {accounts.length === 0 ? (
            <Card className="items-center py-8">
              <Ionicons name="link-outline" size={40} color={tokens.colors.muted} />
              <Text className="mt-3 text-center text-base text-muted">
                No social accounts connected yet. Connect an account to schedule posts.
              </Text>
            </Card>
          ) : (
            accounts.map((account) => (
              <AccountCard key={account.id} account={account} onDisconnect={handleDisconnect} />
            ))
          )}

          <Text className="mt-2 text-sm font-semibold text-foreground">Connect account</Text>
          {DISTRIBUTION_PLATFORMS.map((platform) => {
            const connecting = connectingPlatform === platform.id;
            return (
              <Button
                key={platform.id}
                title={
                  connecting
                    ? `Connecting ${platform.name}...`
                    : connectedPlatforms.has(platform.id)
                      ? `Reconnect ${platform.name}`
                      : `Connect ${platform.name}`
                }
                variant="outline"
                disabled={!!connectingPlatform || !!connectingOrgPlatform}
                onPress={() => void handleConnect(platform.id)}
              />
            );
          })}

          {organizations.length > 0 ? (
            <>
              <Text className="mt-4 text-sm font-semibold text-foreground">Organization accounts</Text>
              <View className="flex-row flex-wrap gap-2">
                {organizations.map((org) => (
                  <Pressable
                    key={org.id}
                    onPress={() => setSelectedOrgId(org.id)}
                    className={`rounded-lg border px-3 py-2 ${
                      selectedOrgId === org.id ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <Text className={selectedOrgId === org.id ? 'text-primary' : 'text-foreground'}>
                      {org.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {orgAccounts.map((account) => (
                <AccountCard key={`org-${account.id}`} account={account} onDisconnect={handleOrgDisconnect} />
              ))}
              {DISTRIBUTION_PLATFORMS.map((platform) => {
                const connecting = connectingOrgPlatform === platform.id;
                return (
                  <Button
                    key={`org-${platform.id}`}
                    title={connecting ? `Connecting org ${platform.name}...` : `Connect org ${platform.name}`}
                    variant="outline"
                    disabled={!!connectingPlatform || !!connectingOrgPlatform || !selectedOrgId}
                    onPress={() => void handleOrgConnect(platform.id)}
                  />
                );
              })}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
