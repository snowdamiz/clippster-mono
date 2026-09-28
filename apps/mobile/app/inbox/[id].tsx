import type { SharedClip } from '@clippster/api-client'
import { getExpirationText } from '@clippster/api-client'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import { EmptyState } from '@/components/ui/EmptyState'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { sharedClipsApi } from '@/services/api'
import { downloadAndImportSharedClip } from '@/services/sharedClipImport'
import { tokens } from '@/theme/tokens'
import { appAlert } from '@/lib/appAlert'

export default function SharedClipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const clipId = Number(id)
  const [clip, setClip] = useState<SharedClip | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    const response = await sharedClipsApi.getUserSharedClips()
    if (response.success) {
      const found = response.clips.find((c) => c.id === clipId) ?? null
      setClip(found)
      if (found) {
        void sharedClipsApi.markViewed(found.id)
      }
    }
  }, [clipId])

  useEffect(() => {
    void (async () => {
      try {
        await load()
      } catch {
        setClip(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [load])

  async function handleDownload() {
    if (!clip) return
    if (clip.days_until_expiration <= 0) {
      appAlert('Expired', 'This clip has expired and can no longer be downloaded.')
      return
    }

    setDownloading(true)
    try {
      const result = await downloadAndImportSharedClip(clip)
      if (result.success && result.projectId) {
        appAlert('Imported', 'Clip saved to your workspace.', [
          { text: 'Open project', onPress: () => router.push(`/project/${result.projectId}`) },
          { text: 'OK' }
        ])
        await load()
      } else {
        appAlert('Download failed', result.error ?? 'Could not download clip')
      }
    } catch (error) {
      appAlert('Download failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (!loading && !clip)
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Shared clip" showBack />
        <EmptyState
          title="Clip unavailable"
          subtitle="This shared clip may have expired or could not be loaded."
          action={
            <Button
              title="Try again"
              onPress={() => {
                setLoading(true)
                void load()
                  .catch(() => setClip(null))
                  .finally(() => setLoading(false))
              }}
            />
          }
        />
      </View>
    )
  if (loading || !clip) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={clip.name} showBack />
      <ScrollView contentContainerClassName="gap-[17px] px-5 py-4 pb-10">
        {clip.thumbnail_url ? (
          <Image source={{ uri: clip.thumbnail_url }} className="h-[320px] w-full rounded-[18px]" />
        ) : null}

        <Card className="gap-2">
          <Text className="text-muted">{clip.organization_name}</Text>
          {clip.description ? <Text className="text-foreground">{clip.description}</Text> : null}
          <Text className={clip.days_until_expiration <= 2 ? 'text-destructive' : 'text-muted'}>
            {getExpirationText(clip.days_until_expiration)}
          </Text>
          {clip.branding_required ? (
            <Text className="text-warning">Org branding is required when exporting this clip.</Text>
          ) : null}
        </Card>

        <Button
          title={downloading ? 'Downloading...' : 'Download & import to workspace'}
          disabled={downloading || clip.days_until_expiration <= 0}
          onPress={handleDownload}
        />
      </ScrollView>
    </View>
  )
}
