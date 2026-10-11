import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { AppIcon } from '@/components/AppIcon'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionCard } from '@/components/ui/SectionCard'
import { appAlert } from '@/lib/appAlert'
import { userBrandingApi } from '@/services/api'
import {
  listCachedUserProfiles,
  getCachedUserAsset,
  type CachedUserAsset,
  syncPersonalBrandingFromCloud,
  type CachedUserCreatorProfile
} from '@/services/userBrandingSync'
import { tokens } from '@/theme/tokens'

interface BrandingSheetProps {
  visible: boolean
  onClose: () => void
}

export function BrandingSheet({ visible, onClose }: BrandingSheetProps) {
  const [profiles, setProfiles] = useState<CachedUserCreatorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [assets, setAssets] = useState<Record<number, CachedUserAsset>>({})
  const [profileName, setProfileName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const selectedProfile = profiles.find((profile) => profile.server_id === selectedId) ?? profiles[0]

  const refresh = useCallback(async () => {
    const next = await listCachedUserProfiles()
    setProfiles(next)
    const ids = [
      ...new Set(
        next
          .flatMap((profile) => [profile.intro_id, profile.outro_id, profile.watermark_id])
          .filter((id): id is number => id != null)
      )
    ]
    const cached = await Promise.all(ids.map(getCachedUserAsset))
    setAssets(Object.fromEntries(cached.flatMap((asset) => (asset ? [[asset.server_id, asset]] : []))))
  }, [])

  useEffect(() => {
    if (!visible) return
    void (async () => {
      setLoading(true)
      setLoadError(false)
      try {
        await syncPersonalBrandingFromCloud()
        await refresh()
      } catch {
        setLoadError(true)
        await refresh().catch(() => {})
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, refresh])

  if (!visible) return null

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncPersonalBrandingFromCloud()
      await refresh()
      appAlert(
        'Synced',
        `${result.profiles} profiles · ${result.assets} assets${result.failed ? ` · ${result.failed} failed` : ''}`
      )
    } catch (error) {
      appAlert('Branding update failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleUploadAsset(assetType: 'watermark' | 'intro' | 'outro') {
    const picked = await DocumentPicker.getDocumentAsync({
      type: assetType === 'watermark' ? ['image/*'] : ['video/*', 'image/*'],
      copyToCacheDirectory: true
    })
    if (picked.canceled || !picked.assets?.[0]) return

    const file = picked.assets[0]
    setUploading(true)
    try {
      const result = await userBrandingApi.uploadAsset({
        assetType,
        name: file.name,
        file: {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream'
        }
      })
      if (!result.success) {
        appAlert('Upload failed', result.error ?? 'Could not upload asset')
        return
      }
      if (selectedProfile && result.asset) {
        const updated = await userBrandingApi.updateProfile(selectedProfile.server_id, {
          [`${assetType}_id`]: result.asset.id
        })
        if (!updated.success)
          throw new Error(updated.error ?? 'Asset uploaded, but could not update the selected profile.')
      }
      await syncPersonalBrandingFromCloud()
      await refresh()
      setUploadOpen(false)
      appAlert(
        'Uploaded',
        selectedProfile
          ? `${assetType} assigned to ${selectedProfile.name}.`
          : `${assetType} is in your cloud branding library.`
      )
    } catch (error) {
      appAlert('Branding update failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateProfile() {
    if (!profileName.trim()) return
    setUploading(true)
    try {
      const result = await userBrandingApi.upsertProfile({
        name: profileName.trim(),
        scope: 'personal_studio',
        client_id: `mobile-${Date.now()}`
      })
      if (!result.success) {
        appAlert('Could not create profile', result.error ?? 'Try again')
        return
      }
      await syncPersonalBrandingFromCloud()
      await refresh()
      if (result.profile) setSelectedId(result.profile.id)
      setCreateOpen(false)
      setProfileName('')
    } catch (error) {
      appAlert('Branding update failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Creator branding"
      headerIcon="Palette"
      scrollable
      primaryAction={{
        title: syncing ? 'Syncing…' : 'Sync now',
        onPress: () => void handleSync(),
        disabled: syncing || uploading
      }}
      headerAccessory={
        <Pressable
          onPress={() => setCreateOpen(true)}
          disabled={uploading || syncing}
          className="min-h-11 justify-center"
        >
          <Text className="text-sm text-accent">+ New profile</Text>
        </Pressable>
      }
    >
      <Text className="text-sm leading-5 text-muted">Your branding profiles and assets stay synced with desktop.</Text>
      {loadError ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          Could not refresh your branding. Showing any saved profiles. Try Sync now again.
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.accent} />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon="Palette"
          title="Make it yours"
          subtitle="Create your first branding profile or sync an existing one."
        />
      ) : (
        <View className="gap-3">
          {profiles.map((profile) => (
            <Pressable
              key={profile.server_id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedProfile?.server_id === profile.server_id }}
              onPress={() => setSelectedId(profile.server_id)}
              className={`min-h-[80px] flex-row items-center gap-3 rounded-[18px] border bg-surface p-4 ${selectedProfile?.server_id === profile.server_id ? 'border-accent' : 'border-border'}`}
            >
              <AppIcon
                name={selectedProfile?.server_id === profile.server_id ? 'CircleCheck' : 'Radio'}
                size={22}
                color={selectedProfile?.server_id === profile.server_id ? tokens.colors.accent : tokens.colors.muted}
              />
              <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-surfaceMuted">
                <AppIcon name="Palette" size={18} color={tokens.colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{profile.name}</Text>
                <Text className="text-xs leading-5 text-muted">
                  {[
                    profile.disabled ? 'Disabled' : 'Synced profile',
                    profile.watermark_id && 'Watermark',
                    profile.intro_id && 'Intro',
                    profile.outro_id && 'Outro'
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Text className="text-[17px] font-semibold text-foreground">
        {selectedProfile ? 'Selected profile assets' : 'Branding library'}
      </Text>
      <SectionCard>
        {(['intro', 'outro', 'watermark'] as const).map((type) => {
          const id = selectedProfile?.[`${type}_id`]
          const asset = id ? assets[id] : undefined
          return (
            <View key={type} className="min-h-[82px] flex-row items-center gap-3 border-b border-border py-3">
              {type === 'watermark' && asset ? (
                <Image source={{ uri: asset.local_path }} className="h-12 w-12 rounded-xl" resizeMode="contain" />
              ) : (
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-surfaceMuted">
                  <AppIcon name={type === 'watermark' ? 'Image' : 'Video'} size={24} color={tokens.colors.foreground} />
                </View>
              )}
              <View className="flex-1 gap-1">
                <Text className="text-sm font-semibold capitalize text-foreground">{type}</Text>
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {asset?.name ?? (id ? 'Asset saved' : 'No asset yet')}
                </Text>
              </View>
              <Button
                title={id ? 'Replace' : 'Add asset'}
                variant="outline"
                className="min-h-11 px-3"
                disabled={uploading || syncing}
                onPress={() => void handleUploadAsset(type)}
              />
            </View>
          )
        })}
        <View className="py-4">
          <Button
            title="Upload asset"
            variant="outline"
            onPress={() => setUploadOpen(true)}
            disabled={uploading || syncing}
          />
        </View>
      </SectionCard>
      {uploading ? (
        <View className="flex-row items-center gap-3">
          <ActivityIndicator color={tokens.colors.accent} />
          <Text className="text-sm text-muted">Updating your branding…</Text>
        </View>
      ) : null}
      <BottomSheet
        visible={createOpen}
        onClose={() => {
          if (!uploading) setCreateOpen(false)
        }}
        title="New branding profile"
        primaryAction={{
          title: uploading ? 'Creating…' : 'Create profile',
          disabled: uploading || !profileName.trim(),
          onPress: () => void handleCreateProfile()
        }}
      >
        <Input value={profileName} onChangeText={setProfileName} placeholder="Profile name" maxLength={100} />
      </BottomSheet>
      <BottomSheet
        visible={uploadOpen}
        onClose={() => {
          if (!uploading) setUploadOpen(false)
        }}
        title="Upload asset"
      >
        {(['intro', 'outro', 'watermark'] as const).map((type) => (
          <Button
            key={type}
            title={`Upload ${type}`}
            variant="outline"
            onPress={() => void handleUploadAsset(type)}
            disabled={uploading || syncing}
          />
        ))}
      </BottomSheet>
    </BottomSheet>
  )
}
