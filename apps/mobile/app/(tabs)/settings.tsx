import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { getAppVersion } from '@/lib/config';
import { cloudProjectsApi } from '@/services/api';
import {
  getStorageQuota,
  isWifiOnlySync,
  setWifiOnlySync,
  syncAllProjects,
} from '@/services/cloudSync';
import { getFfmpegVersion } from '@/services/ffmpeg';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function SettingsScreen() {
  const { user, authProvider, logout } = useAuth();
  const [ffmpegVersion, setFfmpegVersion] = useState('Loading...');
  const [quota, setQuota] = useState<{ bytes_used: number; bytes_limit: number; tier: string } | null>(null);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

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
      if (result.success) {
        setQuota((prev) =>
          prev ? { ...prev, tier: result.tier, bytes_limit: result.bytes_limit } : prev,
        );
      }
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="More" />
      <ScrollView contentContainerClassName="gap-4 px-4 py-4">
        <Card className="gap-2">
          <Text className="text-sm text-muted">Signed in as</Text>
          <Text className="text-lg font-semibold text-foreground">{user?.email ?? user?.name ?? 'User'}</Text>
          <Text className="text-sm text-muted">Provider: {authProvider ?? 'unknown'}</Text>
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-foreground">Cloud Storage</Text>
          {quota ? (
            <>
              <Text className="text-sm text-muted">
                {formatBytes(quota.bytes_used)} of {formatBytes(quota.bytes_limit)} used · {quota.tier}
              </Text>
              <View className="h-2 overflow-hidden rounded-full bg-border">
                <View
                  className="h-full bg-primary"
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
            title={upgrading ? 'Upgrading…' : 'Upgrade to 50 GB'}
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
          <Text className="text-sm text-muted">App version</Text>
          <Text className="text-base text-foreground">{getAppVersion()}</Text>
          <Separator className="my-2" />
          <Text className="text-sm text-muted">FFmpeg (dev build)</Text>
          <Text className="text-base text-foreground">{ffmpegVersion}</Text>
        </Card>

        <Card className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Organization</Text>
          <Button title="Shared clips inbox" variant="outline" onPress={() => router.push('/(tabs)/inbox')} />
        </Card>

        <Card className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Distribution</Text>
          <Button title="Connected accounts" variant="outline" onPress={() => router.push('/(tabs)/accounts')} />
          <Button title="Scheduled posts" variant="outline" onPress={() => router.push('/(tabs)/posts')} />
        </Card>

        <Button title="Sign out" variant="outline" onPress={handleLogout} />
      </ScrollView>
    </View>
  );
}
