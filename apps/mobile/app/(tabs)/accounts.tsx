import type { Organization, SocialPlatform, UserSocialAccount } from '@clippster/api-client';
import { getSocialPlatformLabel } from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ConnectPlatformSheet } from '@/components/social/ConnectPlatformSheet';
import { SocialAccountCard } from '@/components/social/SocialAccountCard';
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms';
import { organizationsApi, userSocialApi } from '@/services/api';
import { startPostForMeOAuth } from '@/services/postForMeOAuth';
import { startPostForMeOrgOAuth } from '@/services/postForMeOrgOAuth';
import { startTokendConnect, startTokendOrgConnect } from '@/services/tokendOAuth';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [orgAccounts, setOrgAccounts] = useState<UserSocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [connectingOrgPlatform, setConnectingOrgPlatform] = useState<SocialPlatform | null>(null);

  const loadAccounts = useCallback(async () => {
    const response = await userSocialApi.listAccounts();
    const list = response.social_accounts ?? response.accounts ?? [];
    setAccounts(list);

    const orgResponse = await organizationsApi.listMyOrganizations();
    if (orgResponse.success) {
      setOrganizations(orgResponse.organizations);
    }
  }, []);

  const loadOrgAccounts = useCallback(async (orgId: number) => {
    const response = await userSocialApi.listOrgAccounts(orgId);
    setOrgAccounts(response.social_accounts ?? response.accounts ?? []);
  }, []);

  useEffect(() => {
    if (selectedOrgId) void loadOrgAccounts(selectedOrgId);
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
      const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === platform);
      const result =
        platformConfig?.provider === 'tokend'
          ? await startTokendConnect()
          : await startPostForMeOAuth(platform);
      if (result.success) {
        setShowConnect(false);
        await loadAccounts();
        appAlert('Connected', `${getSocialPlatformLabel(platform)} account linked successfully.`);
      } else {
        appAlert('Connection failed', result.error ?? 'Could not connect account.');
      }
    } catch (error) {
      appAlert(
        'Connection failed',
        error instanceof Error ? error.message : 'Could not connect account.',
      );
    } finally {
      setConnectingPlatform(null);
    }
  }

  function handleDisconnect(accountId: number) {
    appAlert('Disconnect account', 'Remove this social account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const response = await userSocialApi.disconnectAccount(accountId);
            if (response.success) await loadAccounts();
            else appAlert('Error', response.error ?? 'Failed to disconnect');
          })();
        },
      },
    ]);
  }

  async function handleOrgConnect(platform: SocialPlatform) {
    if (!selectedOrgId) return;
    setConnectingOrgPlatform(platform);
    try {
      const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === platform);
      const result =
        platformConfig?.provider === 'tokend'
          ? await startTokendOrgConnect(selectedOrgId)
          : await startPostForMeOrgOAuth(selectedOrgId, platform);
      if (result.success) {
        setShowConnect(false);
        await loadOrgAccounts(selectedOrgId);
        appAlert('Connected', `Organization ${getSocialPlatformLabel(platform)} account linked.`);
      } else {
        appAlert('Connection failed', result.error ?? 'Could not connect org account.');
      }
    } finally {
      setConnectingOrgPlatform(null);
    }
  }

  function handleOrgDisconnect(accountId: number) {
    if (!selectedOrgId) return;
    appAlert('Disconnect account', 'Remove this organization social account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const response = await userSocialApi.disconnectOrgAccount(selectedOrgId, accountId);
            if (response.success) await loadOrgAccounts(selectedOrgId);
            else appAlert('Error', response.error ?? 'Failed to disconnect');
          })();
        },
      },
    ]);
  }

  const orgMode = selectedOrgId != null && organizations.length > 0;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Connected accounts"
        subtitle="Post clips via Post For Me"
        showBack
        rightAction={
          <Pressable
            onPress={() => setShowConnect(true)}
            disabled={!!connectingPlatform || !!connectingOrgPlatform}
            className="rounded-lg bg-primary px-3 py-2"
          >
            <Text className="text-sm font-semibold text-primary-foreground">Connect</Text>
          </Pressable>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="gap-4 px-4 py-4 pb-10"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          {organizations.length > 0 ? (
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setSelectedOrgId(null)}
                className={`rounded-lg border px-3 py-2 ${
                  !orgMode ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                }`}
              >
                <Text className={!orgMode ? 'text-accent' : 'text-foreground'}>Personal</Text>
              </Pressable>
              {organizations.map((org) => (
                <Pressable
                  key={org.id}
                  onPress={() => setSelectedOrgId(org.id)}
                  className={`rounded-lg border px-3 py-2 ${
                    selectedOrgId === org.id ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                  }`}
                >
                  <Text className={selectedOrgId === org.id ? 'text-accent' : 'text-foreground'}>
                    {org.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!orgMode ? (
            accounts.length === 0 ? (
              <View className="items-center rounded-xl border border-dashed border-border px-6 py-10">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
                  <Ionicons name="share-social-outline" size={24} color={tokens.colors.accent} />
                </View>
                <Text className="text-center text-lg font-semibold text-foreground">
                  No accounts connected
                </Text>
                <Text className="mt-2 text-center text-sm text-muted">
                  Connect Instagram, TikTok, YouTube, or X to post clips directly from Clippster.
                </Text>
                <Pressable
                  onPress={() => setShowConnect(true)}
                  className="mt-4 rounded-lg bg-primary px-5 py-3"
                >
                  <Text className="font-semibold text-primary-foreground">Connect account</Text>
                </Pressable>
              </View>
            ) : (
              accounts.map((account) => (
                <SocialAccountCard
                  key={account.id}
                  account={account}
                  onDisconnect={handleDisconnect}
                  onReconnect={() => void handleConnect(account.platform as SocialPlatform)}
                />
              ))
            )
          ) : orgAccounts.length === 0 ? (
            <View className="items-center rounded-xl border border-dashed border-border px-6 py-10">
              <Text className="text-center text-muted">No organization accounts connected.</Text>
              <Pressable
                onPress={() => setShowConnect(true)}
                className="mt-4 rounded-lg bg-primary px-5 py-3"
              >
                <Text className="font-semibold text-primary-foreground">Connect org account</Text>
              </Pressable>
            </View>
          ) : (
            orgAccounts.map((account) => (
              <SocialAccountCard
                key={`org-${account.id}`}
                account={account}
                onDisconnect={handleOrgDisconnect}
                onReconnect={() => void handleOrgConnect(account.platform as SocialPlatform)}
              />
            ))
          )}
        </ScrollView>
      )}

      <ConnectPlatformSheet
        visible={showConnect}
        connectingPlatform={connectingPlatform ?? connectingOrgPlatform}
        onClose={() => setShowConnect(false)}
        onConnect={(platform) => {
          if (orgMode) void handleOrgConnect(platform);
          else void handleConnect(platform);
        }}
      />
    </View>
  );
}
