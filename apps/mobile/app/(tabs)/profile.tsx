import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
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
import { useFeatureFlags } from '@/context/FeatureFlagsContext';
import { confirmAccountDeletion } from '@/lib/confirmAccountDeletion';
import { getAppVersion } from '@/lib/config';
import { appAlert } from '@/lib/appAlert';
import { authApi, clipperProfilesApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

const PRIVACY_URL = 'https://clippster.app/privacy';
const TERMS_URL = 'https://clippster.app/terms';

type MeSheet =
  | 'settings'
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
  const { canAccessCampaigns } = useFeatureFlags();
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

      <ScrollView contentContainerClassName="gap-4 px-5 py-3 pb-10">
        <Pressable
          onPress={() => setOpenSheet('clipper')}
          className="overflow-hidden"
        >
          
          <View className="flex-row items-center gap-3 py-2">
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

        <MenuRow icon="card-outline" title="Your plan & AI credits" subtitle={`${tierLabel} · ${creditsLabel} AI credits`} onPress={() => setOpenSheet('billing')} />
        <View>
          <MenuRow icon="person-outline" title="Clipper profile" subtitle="Portfolio and public presence" onPress={() => setOpenSheet('clipper')} />
          <MenuRow icon="link-outline" title="Connected accounts" subtitle="Personal and organization channels" onPress={() => setOpenSheet('accounts')} />
          <MenuRow icon="calendar-outline" title="Posts" subtitle="Scheduled, published, and failed" onPress={() => setOpenSheet('posts')} />
          <MenuRow icon="color-palette-outline" title="Creator branding" subtitle="Profiles, intros, outros, watermarks" onPress={() => setOpenSheet('branding')} />
          <MenuRow icon="cloud-outline" title="Cloud & shared work" subtitle="Sync conflicts and shared clips" onPress={() => setOpenSheet('cloud')} />
          {canAccessCampaigns ? <MenuRow icon="trophy-outline" title="Campaigns" subtitle="Opportunities and submissions" onPress={() => router.push('/(tabs)/campaigns')} /> : null}
          <MenuRow icon="settings-outline" title="Settings" subtitle="Security, preferences, and about" onPress={() => setOpenSheet('settings')} />
        </View>
      </ScrollView>

      <BottomSheet visible={openSheet === 'settings'} onClose={closeSheet} title="Settings">
        <MenuRow icon="shield-checkmark-outline" title="Email & password" onPress={() => setOpenSheet('security')} />
        <MenuRow icon="options-outline" title="Preferences" onPress={() => setOpenSheet('preferences')} />
        <MenuRow icon="information-circle-outline" title="App version" value={getAppVersion()} onPress={() => {}} trailing={<View />} />
        <MenuRow icon="document-text-outline" title="Privacy Policy" onPress={() => void Linking.openURL(PRIVACY_URL)} />
        <MenuRow icon="document-outline" title="Terms of Service" onPress={() => void Linking.openURL(TERMS_URL)} />
        <Text className="text-xs text-muted">Signed in via {authProvider ?? 'email'}</Text>
        <Button title="Sign out" variant="outline" onPress={handleLogout} />
        <Button title={deleting ? 'Deleting…' : 'Delete account'} variant="destructive" disabled={deleting} onPress={handleDeleteAccount} />
      </BottomSheet>
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
