import type { ScheduledPost, ScheduledPostStatus } from '@clippster/api-client'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { PostAnalyticsSheet } from '@/components/posts/PostAnalyticsSheet'
import { PostCard } from '@/components/posts/PostCard'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/tabs'
import { analyticsApi, organizationsApi, schedulingApi } from '@/services/api'
import { tokens } from '@/theme/tokens'

type StatusFilter = 'all' | ScheduledPostStatus

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' }
]

interface PostsSheetProps {
  embedded?: boolean
  visible: boolean
  onClose: () => void
}

export function PostsSheet({ visible, onClose, embedded = false }: PostsSheetProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const loadPosts = useCallback(async (status?: string) => {
    const request = ++requestSequence.current
    try {
      const response = await schedulingApi.listScheduledPosts(status)
      if (!response.success) throw new Error(response.error ?? 'Could not load posts.')
      const personal = response.success ? response.posts : []

      const orgResponse = await organizationsApi.listMyOrganizations()
      const orgPosts: ScheduledPost[] = []
      if (orgResponse.success) {
        for (const org of orgResponse.organizations) {
          const orgList = await schedulingApi.listOrgScheduledPosts(org.id, { status })
          if (orgList.success) {
            orgPosts.push(...orgList.posts)
          }
        }
      }

      const merged = [...personal, ...orgPosts].sort(
        (a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime()
      )
      if (request === requestSequence.current) {
        setPosts(merged)
        setLoadError(null)
      }
    } catch (error) {
      if (request === requestSequence.current)
        setLoadError(error instanceof Error ? error.message : 'Could not load posts.')
    }
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      await loadPosts(filter === 'all' ? undefined : filter)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    void (async () => {
      try {
        await loadPosts(filter === 'all' ? undefined : filter)
      } finally {
        setLoading(false)
      }
    })()
  }, [visible, filter, loadPosts])

  useEffect(() => {
    if (!visible) {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
      return
    }
    const hasPublishing = posts.some((p) => p.status === 'publishing')
    if (hasPublishing) {
      refreshTimer.current = setInterval(() => {
        void loadPosts(filter === 'all' ? undefined : filter)
      }, 30_000)
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [visible, posts, filter, loadPosts])

  async function handleCancel(postId: number) {
    const response = await schedulingApi.cancelScheduledPost(postId)
    if (!response.success) throw new Error(response.error ?? 'Could not cancel post.')
    if (response.success) {
      void analyticsApi.trackEvent({ event_type: 'post_cancelled', metadata: { post_id: postId } })
      await refresh()
    }
  }

  async function handleRetry(postId: number) {
    const response = await schedulingApi.retryScheduledPost(postId)
    if (!response.success) throw new Error(response.error ?? 'Could not retry post.')
    if (response.success) {
      await refresh()
    }
  }

  async function handleUpdate(postId: number, data: { caption?: string; scheduled_at?: string }) {
    const response = await schedulingApi.updateScheduledPost(postId, data)
    if (!response.success) throw new Error(response.error ?? 'Could not update post.')
    if (response.success) {
      await refresh()
    }
  }

  if (!visible) return null

  return (
    <>
      <BottomSheet
        inline={embedded}
        showHandle={false}
        closeMode="none"
        visible={visible}
        onClose={onClose}
        variant="page"
        title={embedded ? undefined : 'Posts'}
        subtitle={embedded ? undefined : 'Scheduled, published, and failed'}
        headerIcon={embedded ? undefined : 'calendar-outline'}
        scrollable
        maxHeightClassName="max-h-[92%]"
        headerAccessory={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh posts"
            onPress={() => void refresh()}
            disabled={refreshing || loading}
            className="rounded-md p-1"
            hitSlop={8}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={tokens.colors.accent} />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={tokens.colors.muted} />
            )}
          </Pressable>
        }
      >
        <Tabs
          items={FILTERS.map((item) => ({ key: item.id, label: item.label }))}
          value={filter}
          onChange={(next) => setFilter(next as StatusFilter)}
        />
        {loadError ? (
          <Text accessibilityRole="alert" className="text-sm text-destructive">
            {loadError} Use refresh to try again.
          </Text>
        ) : null}
        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator color={tokens.colors.accent} />
          </View>
        ) : posts.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No posts yet"
            subtitle="Export a clip and schedule it to get started."
          />
        ) : (
          <View className="gap-3">
            {posts.map((item) => (
              <PostCard key={String(item.id)} post={item} onPress={() => setSelectedPost(item)} />
            ))}
          </View>
        )}
      </BottomSheet>

      <PostAnalyticsSheet
        visible={!!selectedPost}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onCancel={handleCancel}
        onRetry={handleRetry}
        onUpdate={handleUpdate}
      />
    </>
  )
}
