import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { confirmAccountDeletion } from '@/lib/confirmAccountDeletion';
import { getAppVersion } from '@/lib/config';
import { authApi } from '@/services/api';
import { getFfmpegVersion } from '@/services/ffmpeg';
import { appAlert } from '@/lib/appAlert';

const PRIVACY_URL = 'https://clippster.app/privacy';
const TERMS_URL = 'https://clippster.app/terms';

export function CreditsRow({ onManage }: { onManage?: () => void }) {
  const { tierLabel, creditsLabel, loading } = useAccount();

  return (
    <Pressable
      onPress={onManage}
      className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
    >
      <View>
        <Text className="text-sm font-medium text-foreground">{tierLabel} plan</Text>
        <Text className="text-xs text-muted">
          {loading ? 'Syncing account…' : `${creditsLabel} AI credits`}
        </Text>
      </View>
      <Text className="text-sm text-accent">Manage</Text>
    </Pressable>
  );
}

export function AccountSettingsPanel() {
  const { authProvider, logout } = useAuth();
  const [ffmpegVersion, setFfmpegVersion] = useState('Loading...');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void getFfmpegVersion().then(setFfmpegVersion);
  }, []);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  function handleDeleteAccount() {
    confirmAccountDeletion(() => {
      void (async () => {
        setDeleting(true);
        try {
          const result = await authApi.deleteAccount();
          if (!result.success) {
            appAlert('Error', result.error ?? result.message ?? 'Could not delete account');
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
