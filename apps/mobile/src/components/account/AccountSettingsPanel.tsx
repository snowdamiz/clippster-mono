import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { confirmAccountDeletion } from '@/lib/confirmAccountDeletion';
import { getAppVersion } from '@/lib/config';
import { authApi, cloudProjectsApi } from '@/services/api';
import {
  getStorageQuota,
  isWifiOnlySync,
  setWifiOnlySync,
  syncAllProjects,
} from '@/services/cloudSync';
import { getFfmpegVersion } from '@/services/ffmpeg';

const PRIVACY_URL = 'https://clippster.app/privacy';
const TERMS_URL = 'https://clippster.app/terms';
const BILLING_URL = 'https://clippster.app/settings/billing';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function CreditsRow() {
  const { tierLabel, creditsLabel, loading, refreshAccount } = useAccount();

  return (
    <Pressable
      onPress={() => router.push('/billing' as never)}
      className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
    >
      <View>
        <Text className="text-sm font-medium text-foreground">{tierLabel} plan</Text>
        <Text className="text-xs text-muted">
          {loading ? 'Syncing account…' : `${creditsLabel} AI credits`}
        </Text>
      </View>
      <Pressable onPress={() => void refreshAccount()}>
        <Text className="text-sm text-accent">Manage</Text>
      </Pressable>
    </Pressable>
  );
}

export function AccountSettingsPanel() {
  const { authProvider, logout } = useAuth();
  const [ffmpegVersion, setFfmpegVersion] = useState('Loading...');
  const [quota, setQuota] = useState<{ bytes_used: number; bytes_limit: number; tier: string } | null>(null);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void getFfmpegVersion().then(setFfmpegVersion);
    void getStorageQuota().then((q) => {
      if (q.success) setQuota({ bytes_used: q.bytes_used, bytes_limit: q.bytes_limit, tier: q.tier });
    });
    void isWifiOnlySync().then(setWifiOnly);
  }, []);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const result = await cloudProjectsApi.checkoutStorageTier('cloud_50');
      const url = result.checkout_url ?? BILLING_URL;
      await Linking.openURL(url);
    } finally {
      setUpgrading(false);
    }
  }

  function handleDeleteAccount() {
    confirmAccountDeletion(() => {
      void (async () => {
        setDeleting(true);
        try {
          const result = await authApi.deleteAccount();
          if (!result.success) {
            Alert.alert('Error', result.error ?? result.message ?? 'Could not delete account');
            return;
          }
          await logout();
          router.replace('/(auth)/login');
        } finally {
          setDeleting(false);
        }
      })();
    });
  }

  return (
    <View className="gap-4">
      <Card className="gap-3">
        <Text className="text-sm font-semibold text-foreground">Cloud storage</Text>
        {quota ? (
          <>
            <Text className="text-sm text-muted">
              {formatBytes(quota.bytes_used)} of {formatBytes(quota.bytes_limit)} used · {quota.tier}
            </Text>
            <View className="h-2 overflow-hidden rounded-full bg-border">
              <View
                className="h-full bg-accent"
                style={{
                  width: `${quota.bytes_limit > 0 ? Math.min(100, (quota.bytes_used / quota.bytes_limit) * 100) : 0}%`,
                }}
              />
            </View>
          </>
        ) : (
          <Text className="text-sm text-muted">Loading quota…</Text>
        )}
        <Button
          title={upgrading ? 'Opening billing…' : 'Upgrade cloud storage'}
          variant="outline"
          onPress={handleUpgrade}
          disabled={upgrading}
        />
        <Button title="Sync projects now" variant="outline" onPress={() => void syncAllProjects()} />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-foreground">Sync on Wi‑Fi only</Text>
          <Switch
            value={wifiOnly}
            onValueChange={(value) => {
              setWifiOnly(value);
              void setWifiOnlySync(value);
            }}
          />
        </View>
      </Card>

      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Organization</Text>
        <Button title="Shared clips inbox" variant="outline" onPress={() => router.push('/(tabs)/inbox')} />
      </Card>

      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">About</Text>
        <Text className="text-sm text-muted">Signed in via {authProvider ?? 'unknown'}</Text>
        <Separator className="my-1" />
        <Text className="text-sm text-muted">App version</Text>
        <Text className="text-base text-foreground">{getAppVersion()}</Text>
        <Separator className="my-1" />
        <Text className="text-sm text-muted">FFmpeg (LGPL)</Text>
        <Text className="text-base text-foreground">{ffmpegVersion}</Text>
        <Text className="text-xs text-muted">
          This app uses FFmpeg licensed under LGPL. Source and license notices are available at
          https://ffmpeg.org/legal.html
        </Text>
      </Card>

      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Legal</Text>
        <Button title="Privacy Policy" variant="outline" onPress={() => void Linking.openURL(PRIVACY_URL)} />
        <Button title="Terms of Service" variant="outline" onPress={() => void Linking.openURL(TERMS_URL)} />
      </Card>

      <Button title="Sign out" variant="outline" onPress={handleLogout} />
      <Button
        title={deleting ? 'Deleting…' : 'Delete account'}
        variant="outline"
        onPress={handleDeleteAccount}
        disabled={deleting}
      />
    </View>
  );
}
