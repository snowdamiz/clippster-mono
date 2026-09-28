import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Ionicons } from '@expo/vector-icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { appAlert } from '@/lib/appAlert'
import { userBrandingApi } from '@/services/api'
import {
  listCachedUserProfiles,
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

  const refresh = useCallback(async () => {
    setProfiles(await listCachedUserProfiles())
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
      await syncPersonalBrandingFromCloud()
      await refresh()
      appAlert('Uploaded', `${assetType} is in your cloud branding library.`)
    } catch (error) {
      appAlert('Branding update failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateProfile() {
    setUploading(true)
    try {
      const result = await userBrandingApi.upsertProfile({
        name: `Profile ${new Date().toLocaleDateString()}`,
        scope: 'personal_studio',
        client_id: `mobile-${Date.now()}`
      })
      if (!result.success) {
        appAlert('Could not create profile', result.error ?? 'Try again')
        return
      }
      await syncPersonalBrandingFromCloud()
      await refresh()
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
      subtitle="Intros, outros, watermarks — synced with desktop"
      headerIcon="color-palette-outline"
      scrollable
      maxHeightClassName="max-h-[92%]"
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
          icon="color-palette-outline"
          title="Make it yours"
          subtitle="Create your first branding profile or sync an existing one."
        />
      ) : (
        <View>
          {profiles.map((profile) => (
            <View
              key={profile.server_id}
              className="min-h-[72px] flex-row items-center gap-3 border-b border-border py-4"
            >
              <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-surfaceMuted">
                <Ionicons name="color-palette-outline" size={18} color={tokens.colors.accent} />
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
            </View>
          ))}
        </View>
      )}
      <Button
        title="New profile"
        variant="outline"
        onPress={() => void handleCreateProfile()}
        disabled={uploading || syncing}
      />
      <Text className="text-[17px] font-semibold text-foreground">Upload assets</Text>
      <View className="flex-row gap-2">
        {(['watermark', 'intro', 'outro'] as const).map((type) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={`Upload ${type}`}
            onPress={() => void handleUploadAsset(type)}
            disabled={uploading || syncing}
            className={`min-h-[84px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-surface ${uploading || syncing ? 'opacity-50' : ''}`}
          >
            <Ionicons
              name={type === 'watermark' ? 'image-outline' : 'videocam-outline'}
              size={22}
              color={tokens.colors.foreground}
            />
            <Text className="text-xs text-foreground">
              {type === 'watermark' ? 'Watermark' : type === 'intro' ? 'Intro' : 'Outro'}
            </Text>
          </Pressable>
        ))}
      </View>
      {uploading ? (
        <View className="flex-row items-center gap-3">
          <ActivityIndicator color={tokens.colors.accent} />
          <Text className="text-sm text-muted">Updating your branding…</Text>
        </View>
      ) : null}
      <Button
        title={syncing ? 'Syncing…' : 'Sync now'}
        variant="outline"
        onPress={() => void handleSync()}
        disabled={syncing || uploading}
      />
    </BottomSheet>
  )
}
