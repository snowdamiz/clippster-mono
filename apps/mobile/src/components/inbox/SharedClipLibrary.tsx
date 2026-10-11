import type { SharedClip } from '@clippster/api-client'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import { AppIcon } from '@/components/AppIcon'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { appAlert } from '@/lib/appAlert'
import { sharedClipsApi } from '@/services/api'
import { downloadAndImportSharedClip } from '@/services/sharedClipImport'
import { tokens } from '@/theme/tokens'

export function SharedClipLibrary({ visible = true }: { visible?: boolean }) {
  const [clips, setClips] = useState<SharedClip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organization, setOrganization] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [importingId, setImportingId] = useState<number | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await sharedClipsApi.getUserSharedClips()
      if (!response.success) throw new Error(response.error ?? 'Could not load shared clips.')
      setClips(response.clips)
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load clips.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (visible) void load()
  }, [visible, load])
  async function importClip(clip: SharedClip) {
    if (importingId != null) return
    setImportingId(clip.id)
    try {
      const result = await downloadAndImportSharedClip(clip)
      if (!result.success || !result.projectId) throw new Error(result.error ?? 'Import failed.')
      setClips((previous) =>
        previous.map((item) => (item.id === clip.id ? { ...item, downloaded_at: new Date().toISOString() } : item))
      )
      appAlert('Imported', 'The clip is now in your project library.')
    } catch (failure) {
      appAlert('Import failed', failure instanceof Error ? failure.message : 'Please try again.')
    } finally {
      setImportingId(null)
    }
  }
  const organizations = [
    ...new Map(clips.map((clip) => [clip.organization_id, clip.organization_name ?? 'Organization'])).entries()
  ]
  const filtered = clips.filter((clip) => organization == null || clip.organization_id === organization)
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-foreground">Shared clips</Text>
        <Pressable
          accessibilityLabel="Refresh shared clips"
          disabled={loading}
          onPress={() => void load()}
          className="min-h-11 min-w-11 items-center justify-center"
        >
          <AppIcon name="RefreshCw" size={21} color={tokens.colors.accent} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => setPickerOpen(true)}
        className="min-h-[56px] flex-row items-center gap-3 rounded-[14px] border border-border bg-surface p-4"
      >
        <AppIcon name="Building2" size={23} color={tokens.colors.foreground} />
        <Text className="flex-1 text-sm font-semibold text-foreground">
          {organizations.find(([id]) => id === organization)?.[1] ?? 'All organizations'}
        </Text>
        <AppIcon name="ChevronDown" size={18} color={tokens.colors.muted} />
      </Pressable>
      {loading ? (
        <ActivityIndicator color={tokens.colors.accent} />
      ) : error ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {error}
        </Text>
      ) : filtered.length === 0 ? (
        <EmptyState icon="Share2" title="No shared clips" subtitle="Clips shared by your organizations appear here." />
      ) : (
        <View className="rounded-[18px] border border-border bg-surface px-3">
          {filtered.map((clip) => (
            <View key={clip.id} className="min-h-[100px] flex-row items-center gap-3 border-b border-border py-3">
              <Pressable
                onPress={() => router.push(`/inbox/${clip.id}`)}
                className="h-16 w-20 overflow-hidden rounded-xl bg-surfaceMuted"
              >
                {clip.thumbnail_url ? (
                  <Image source={{ uri: clip.thumbnail_url }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <AppIcon name="Video" color={tokens.colors.muted} />
                  </View>
                )}
                {clip.duration != null ? (
                  <Text className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] text-white">
                    {Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2, '0')}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable onPress={() => router.push(`/inbox/${clip.id}`)} className="flex-1 gap-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                  {clip.name}
                </Text>
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {clip.organization_name ?? 'Organization'}
                </Text>
                <Text className="text-xs text-muted">
                  {clip.days_until_expiration <= 0
                    ? 'Expired'
                    : clip.branding_required
                      ? 'Branding required'
                      : 'Shared with you'}
                </Text>
              </Pressable>
              <Button
                title={importingId === clip.id ? 'Importing…' : clip.downloaded_at ? 'Imported' : 'Import'}
                variant="accent"
                className="px-3"
                disabled={importingId != null || Boolean(clip.downloaded_at) || clip.days_until_expiration <= 0}
                onPress={() => void importClip(clip)}
              />
            </View>
          ))}
        </View>
      )}
      <View className="flex-row items-center gap-2">
        <AppIcon name="Info" size={18} color={tokens.colors.muted} />
        <Text className="flex-1 text-xs leading-5 text-muted">Imported clips appear in your project library.</Text>
      </View>
      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Organization">
        {[{ id: null, name: 'All organizations' }, ...organizations.map(([id, name]) => ({ id, name }))].map((item) => (
          <Button
            key={item.id ?? 'all'}
            title={item.name}
            variant={organization === item.id ? 'accent' : 'outline'}
            onPress={() => {
              setOrganization(item.id)
              setPickerOpen(false)
            }}
          />
        ))}
      </BottomSheet>
    </View>
  )
}
