import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { ScreenHeader } from '@/components/ScreenHeader'

import { AccountsSheet } from '@/components/me/AccountsSheet'
import { BillingSheet } from '@/components/me/BillingSheet'
import { BrandingSheet } from '@/components/me/BrandingSheet'
import { ClipperProfileSheet } from '@/components/me/ClipperProfileSheet'
import { CloudSyncSheet } from '@/components/me/CloudSyncSheet'
import { PostsSheet } from '@/components/me/PostsSheet'

import { MenuRow } from '@/components/navigation/MenuRow'
import { PublicProfileLinkRow } from '@/components/profile/PublicProfileLinkRow'

import { useAccount } from '@/context/AccountContext'
import { useAuth } from '@/context/AuthContext'
import { useFeatureFlags } from '@/context/FeatureFlagsContext'

import { clipperProfilesApi } from '@/services/api'

import { tokens } from '@/theme/tokens'

type MeSheet = 'clipper' | 'branding' | 'billing' | 'accounts' | 'posts' | 'cloud' | null

export default function ProfileScreen() {
  const { sheet: sheetParam } = useLocalSearchParams<{ sheet?: string }>()
  const { user } = useAuth()
  const { canAccessCampaigns } = useFeatureFlags()
  const { tierLabel, creditsLabel } = useAccount()

  const [clipperLoading, setClipperLoading] = useState(true)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileSlug, setProfileSlug] = useState<string | null>(null)
  const [openSheet, setOpenSheet] = useState<MeSheet>(null)

  const loadClipperProfile = useCallback(async () => {
    try {
      const response = await clipperProfilesApi.getMyProfile()
      if (response.success && response.profile) {
        setDisplayName(response.profile.display_name)
        setAvatarUrl(response.profile.avatar_url)
        setProfileSlug(response.profile.slug ?? null)
      }
    } finally {
      setClipperLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadClipperProfile()
  }, [loadClipperProfile])

  useEffect(() => {
    if (sheetParam === 'posts') setOpenSheet('posts')
    else if (sheetParam === 'accounts') setOpenSheet('accounts')
    else if (sheetParam === 'billing') setOpenSheet('billing')
  }, [sheetParam])

  const shownName = displayName ?? user?.name ?? 'Clippster'
  const closeSheet = () => {
    setOpenSheet(null)
    if (sheetParam) {
      router.replace('/(tabs)/profile')
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Me" />

      <ScrollView contentContainerClassName="gap-4 px-5 py-3 pb-10">
        <Pressable onPress={() => setOpenSheet('clipper')} className="overflow-hidden">
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

        <MenuRow
          icon="card-outline"
          title="Your plan & AI credits"
          subtitle={`${tierLabel} · ${creditsLabel} AI credits`}
          onPress={() => setOpenSheet('billing')}
        />
        <View>
          <MenuRow
            icon="person-outline"
            title="Clipper profile"
            subtitle="Portfolio and public presence"
            onPress={() => setOpenSheet('clipper')}
          />
          <MenuRow
            icon="link-outline"
            title="Connected accounts"
            subtitle="Personal and organization channels"
            onPress={() => setOpenSheet('accounts')}
          />
          <MenuRow
            icon="calendar-outline"
            title="Posts"
            subtitle="Scheduled, published, and failed"
            onPress={() => setOpenSheet('posts')}
          />
          <MenuRow
            icon="color-palette-outline"
            title="Creator branding"
            subtitle="Profiles, intros, outros, watermarks"
            onPress={() => setOpenSheet('branding')}
          />
          <MenuRow
            icon="cloud-outline"
            title="Cloud & shared work"
            subtitle="Sync conflicts and shared clips"
            onPress={() => setOpenSheet('cloud')}
          />
          {canAccessCampaigns ? (
            <MenuRow
              icon="trophy-outline"
              title="Campaigns"
              subtitle="Opportunities and submissions"
              onPress={() => router.push('/(tabs)/campaigns')}
            />
          ) : null}
          <MenuRow
            icon="settings-outline"
            title="Settings"
            subtitle="Security, preferences, and about"
            onPress={() => router.push('/(tabs)/settings')}
          />
        </View>
      </ScrollView>

      <ClipperProfileSheet
        visible={openSheet === 'clipper'}
        onClose={closeSheet}
        onProfileUpdated={() => void loadClipperProfile()}
      />
      <BrandingSheet visible={openSheet === 'branding'} onClose={closeSheet} />
      <BillingSheet visible={openSheet === 'billing'} onClose={closeSheet} />
      <AccountsSheet visible={openSheet === 'accounts'} onClose={closeSheet} />
      <PostsSheet visible={openSheet === 'posts'} onClose={closeSheet} />
      <CloudSyncSheet visible={openSheet === 'cloud'} onClose={closeSheet} />
    </View>
  )
}
