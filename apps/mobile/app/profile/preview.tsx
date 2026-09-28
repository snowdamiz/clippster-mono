import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { AppHeader } from '@/components/AppHeader'
import * as WebBrowser from 'expo-web-browser'
import { MenuRow } from '@/components/navigation/MenuRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { clipperProfilesApi } from '@/services/api'
import { tokens } from '@/theme/tokens'

export default function ProfilePreviewScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const response = await clipperProfilesApi.getClipperBySlug(slug)
        if (response.success && response.profile) {
          setName(response.profile.display_name ?? 'Clipper')
          setBio(response.profile.bio ?? '')
          setTags([...(response.profile.specialty_tags ?? []), ...(response.profile.content_style_tags ?? [])])
        }
      } catch {
        setName('')
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Public preview" showBack />
      <ScrollView contentContainerClassName="gap-[17px] px-5 py-4">
        <EmptyState
          icon="person-outline"
          title={name || 'Profile unavailable'}
          subtitle={bio || 'Your public creator profile'}
        />
        {tags.length > 0 ? <Text className="text-center text-sm text-muted">{tags.join(' · ')}</Text> : null}
        {slug && name ? (
          <MenuRow
            icon="open-outline"
            title="Public profile link"
            subtitle={`clippster.app/clippers/${slug}`}
            onPress={() =>
              void WebBrowser.openBrowserAsync(`https://clippster.app/clippers/${encodeURIComponent(slug)}`)
            }
          />
        ) : null}
        <Button title="Back to profile" variant="outline" onPress={() => router.back()} />
        <Text className="text-center text-sm text-muted">Full public profile is available on clippster.app</Text>
      </ScrollView>
    </View>
  )
}
