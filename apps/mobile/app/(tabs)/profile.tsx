import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CreditsRow } from '@/components/account/AccountSettingsPanel';
import { AccountsSheet } from '@/components/me/AccountsSheet';
import { BillingSheet } from '@/components/me/BillingSheet';
import { BrandingSheet } from '@/components/me/BrandingSheet';
import { ClipperProfileSheet } from '@/components/me/ClipperProfileSheet';
import { CloudSyncSheet } from '@/components/me/CloudSyncSheet';
import { PostsSheet } from '@/components/me/PostsSheet';
import { PreferencesSheet } from '@/components/me/PreferencesSheet';
import { SecuritySheet } from '@/components/me/SecuritySheet';
import { MenuRow } from '@/components/navigation/MenuRow';
import { PublicProfileLinkRow } from '@/components/profile/PublicProfileLinkRow';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { confirmAccountDeletion } from '@/lib/confirmAccountDeletion';
import { getAppVersion } from '@/lib/config';
import { appAlert } from '@/lib/appAlert';
import { authApi, clipperProfilesApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

const PRIVACY_URL = 'https://clippster.app/privacy';
const TERMS_URL = 'https://clippster.app/terms';

type MeSheet =
  | 'clipper'
  | 'security'
  | 'preferences'
  | 'branding'
  | 'billing'
  | 'accounts'
  | 'posts'
  | 'cloud'
  | null;

export default function ProfileScreen() {
  const { sheet: sheetParam } = useLocalSearchParams<{ sheet?: string }>();
  const { user, authProvider, logout } = useAuth();
  const { tierLabel, creditsLabel } = useAccount();
  const [deleting, setDeleting] = useState(false);
  const [clipperLoading, setClipperLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<MeSheet>(null);

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

  useEffect(() => {
    if (sheetParam === 'posts') setOpenSheet('posts');
    else if (sheetParam === 'accounts') setOpenSheet('accounts');
    else if (sheetParam === 'billing') setOpenSheet('billing');
  }, [sheetParam]);

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
  const closeSheet = () => {
    setOpenSheet(null);
    if (sheetParam) {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Me" />

      <ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-10">
        <Pressable
          onPress={() => setOpenSheet('clipper')}
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
                {clipperLoading ? (user?.name ?? '…') : shownName}
              </Text>
              <Text className="text-sm text-muted">{user?.email ?? ''}</Text>
              {profileSlug ? <PublicProfileLinkRow slug={profileSlug} /> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.colors.muted} />
          </View>
        </Pressable>

        <CreditsRow onManage={() => setOpenSheet('billing')} />

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Account</Text>
          <MenuRow
            icon="shield-checkmark-outline"
            title="Email & password"
            subtitle="Change login email or password"
            onPress={() => setOpenSheet('security')}
          />
          <MenuRow
            icon="options-outline"
            title="Preferences"
            subtitle="Notifications and time format (synced)"
            onPress={() => setOpenSheet('preferences')}
          />
          <MenuRow
            icon="color-palette-outline"
            title="Creator branding"
            subtitle="Intros, outros, watermarks — synced with desktop"
            onPress={() => setOpenSheet('branding')}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
            Subscription
          </Text>
          <MenuRow
            icon="card-outline"
            title="Plans & billing"
            subtitle={`${tierLabel} · ${creditsLabel} credits`}
            onPress={() => setOpenSheet('billing')}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
            Distribution
          </Text>
          <MenuRow
            icon="link-outline"
            title="Connected accounts"
            subtitle="Link Instagram, TikTok, YouTube, X via Post For Me"
            onPress={() => setOpenSheet('accounts')}
          />
          <MenuRow
            icon="calendar-outline"
            title="Scheduled posts"
            subtitle="View and manage upcoming posts"
            onPress={() => setOpenSheet('posts')}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Workspace</Text>
          <MenuRow
            icon="cloud-outline"
            title="Cloud & sync"
            subtitle="Storage, sync settings, shared inbox"
            onPress={() => setOpenSheet('cloud')}
          />
          <MenuRow
            icon="briefcase-outline"
            title="Clipper profile"
            subtitle="Portfolio, campaigns, and public profile"
            onPress={() => setOpenSheet('clipper')}
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
          <Text className="px-1 text-xs text-muted">Signed in via {authProvider ?? 'email'}</Text>
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

      <ClipperProfileSheet
        visible={openSheet === 'clipper'}
        onClose={closeSheet}
        onProfileUpdated={() => void loadClipperProfile()}
      />
      <SecuritySheet visible={openSheet === 'security'} onClose={closeSheet} />
      <PreferencesSheet visible={openSheet === 'preferences'} onClose={closeSheet} />
      <BrandingSheet visible={openSheet === 'branding'} onClose={closeSheet} />
      <BillingSheet visible={openSheet === 'billing'} onClose={closeSheet} />
      <AccountsSheet visible={openSheet === 'accounts'} onClose={closeSheet} />
      <PostsSheet visible={openSheet === 'posts'} onClose={closeSheet} />
      <CloudSyncSheet visible={openSheet === 'cloud'} onClose={closeSheet} />
    </View>
  );
}
