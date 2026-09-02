import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CreditsRow } from '@/components/account/AccountSettingsPanel';
import { MenuRow } from '@/components/navigation/MenuRow';
import { PublicProfileLinkRow } from '@/components/profile/PublicProfileLinkRow';
import { useAccount } from '@/context/AccountContext';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { confirmAccountDeletion } from '@/lib/confirmAccountDeletion';
import { getAppVersion } from '@/lib/config';
import { clipperProfilesApi, authApi } from '@/services/api';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

const PRIVACY_URL = 'https://clippster.app/privacy';
const TERMS_URL = 'https://clippster.app/terms';

export default function ProfileScreen() {
  const { user, authProvider, logout } = useAuth();
  const { tierLabel, creditsLabel } = useAccount();
  const [deleting, setDeleting] = useState(false);
  const [clipperLoading, setClipperLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  const loadClipperProfile = useCallback(async () => {
    try {
      const response = await clipperProfilesApi.getMyProfile();
      if (response.success && response.profile) {
        setDisplayName(response.profile.display_name);
        setAvatarUrl(response.profile.avatar_url);
        setProfileSlug(response.profile.slug ?? null);
      }
    } finally {
      setClipperLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClipperProfile();
  }, [loadClipperProfile]);

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

  const shownName = displayName ?? user?.name ?? 'Clippster';

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Me" />

      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
        <Pressable
          onPress={() => router.push('/profile/clipper' as never)}
          className="overflow-hidden rounded-xl border border-border bg-surface"
        >
          <View className="h-[3px] bg-accent" />
          <View className="flex-row items-center gap-4 p-4">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="h-14 w-14 rounded-full" />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-full bg-surfaceMuted">
                <Ionicons name="person" size={28} color={tokens.colors.muted} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">
                {clipperLoading ? user?.name ?? '…' : shownName}
              </Text>
              <Text className="text-sm text-muted">{user?.email ?? ''}</Text>
              {profileSlug ? <PublicProfileLinkRow slug={profileSlug} /> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.colors.muted} />
          </View>
        </Pressable>

        <CreditsRow />

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Account</Text>
          <MenuRow
            icon="shield-checkmark-outline"
            title="Email & password"
            subtitle="Change login email or password"
            onPress={() => router.push('/profile/security' as never)}
          />
          <MenuRow
            icon="options-outline"
            title="Preferences"
            subtitle="Notifications and time format (synced)"
            onPress={() => router.push('/profile/preferences' as never)}
          />
          <MenuRow
            icon="color-palette-outline"
            title="Creator branding"
            subtitle="Intros, outros, watermarks — synced with desktop"
            onPress={() => router.push('/profile/branding' as never)}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Subscription</Text>
          <MenuRow
            icon="card-outline"
            title="Plans & billing"
            subtitle={`${tierLabel} · ${creditsLabel} credits`}
            onPress={() => router.push('/billing' as never)}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Distribution</Text>
          <MenuRow
            icon="link-outline"
            title="Connected accounts"
            subtitle="Link Instagram, TikTok, YouTube, X via Post For Me"
            onPress={() => router.push('/(tabs)/accounts')}
          />
          <MenuRow
            icon="calendar-outline"
            title="Scheduled posts"
            subtitle="View and manage upcoming posts"
            onPress={() => router.push('/(tabs)/posts')}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Workspace</Text>
          <MenuRow
            icon="cloud-outline"
            title="Cloud & sync"
            subtitle="Storage, sync settings, shared inbox"
            onPress={() => router.push('/profile/settings' as never)}
          />
          <MenuRow
            icon="briefcase-outline"
            title="Clipper profile"
            subtitle="Portfolio, campaigns, and public profile"
            onPress={() => router.push('/profile/clipper' as never)}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">About</Text>
          <MenuRow
            icon="information-circle-outline"
            title="App version"
            value={getAppVersion()}
            onPress={() => {}}
            trailing={<View />}
          />
          <MenuRow
            icon="document-text-outline"
            title="Privacy Policy"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          />
          <MenuRow
            icon="document-outline"
            title="Terms of Service"
            onPress={() => void Linking.openURL(TERMS_URL)}
          />
          <Text className="px-1 text-xs text-muted">
            Signed in via {authProvider ?? 'email'}
          </Text>
        </View>

        <View className="gap-2 pt-2">
          <Button title="Sign out" variant="outline" onPress={handleLogout} />
          <Button
            title={deleting ? 'Deleting…' : 'Delete account'}
            variant="outline"
            onPress={handleDeleteAccount}
            disabled={deleting}
          />
        </View>
      </ScrollView>
    </View>
  );
}
