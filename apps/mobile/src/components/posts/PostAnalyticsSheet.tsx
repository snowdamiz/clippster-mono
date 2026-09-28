import type { PostAnalytics, ScheduledPost } from '@clippster/api-client'
import { formatMetricCount, getSocialPlatformLabel, isValidScheduleTime } from '@clippster/api-client'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MenuRow } from '@/components/navigation/MenuRow'
import { AccountsSheet } from '@/components/me/AccountsSheet'
import { ScheduleTimeSheet, formatScheduleLabel, toLocalScheduleValue } from '@/components/schedule/ScheduleTimeSheet'
import { PostStatusBadge } from './PostStatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tokens } from '@/theme/tokens'
import { appAlert } from '@/lib/appAlert'

interface PostAnalyticsSheetProps {
  visible: boolean
  post: ScheduledPost | null
  onClose: () => void
  onCancel?: (postId: number) => Promise<void>
  onRetry?: (postId: number) => Promise<void>
  onUpdate?: (postId: number, data: { caption?: string; scheduled_at?: string }) => Promise<void>
}

interface MetricRowProps {
  label: string
  value: number
  icon: keyof typeof Ionicons.glyphMap
}

function MetricRow({ label, value, icon }: MetricRowProps) {
  return (
    <View className="min-h-[60px] flex-row items-center justify-between border-b border-border py-[13px]">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color={tokens.colors.muted} />
        <Text className="text-sm text-muted">{label}</Text>
      </View>
      <Text className="text-base font-semibold text-foreground">{formatMetricCount(value)}</Text>
    </View>
  )
}

function AnalyticsGrid({ analytics }: { analytics: PostAnalytics }) {
  const hasMetrics =
    analytics.view_count > 0 ||
    analytics.like_count > 0 ||
    analytics.comment_count > 0 ||
    analytics.save_count > 0 ||
    analytics.reach_count > 0 ||
    analytics.impressions_count > 0

  if (!hasMetrics) {
    return (
      <View className="rounded-lg bg-surfaceMuted px-4 py-6">
        <Text className="text-center text-sm text-muted">Metrics sync after publish. Check back in a few hours.</Text>
      </View>
    )
  }

  return (
    <View className="rounded-[18px] bg-surface px-4">
      <MetricRow label="Views" value={analytics.view_count} icon="eye-outline" />
      <MetricRow label="Likes" value={analytics.like_count} icon="heart-outline" />
      <MetricRow label="Comments" value={analytics.comment_count} icon="chatbubble-outline" />
      <MetricRow label="Saves" value={analytics.save_count} icon="bookmark-outline" />
      <MetricRow label="Reach" value={analytics.reach_count} icon="people-outline" />
      <MetricRow label="Impressions" value={analytics.impressions_count} icon="stats-chart-outline" />
    </View>
  )
}

export function PostAnalyticsSheet({ visible, post, onClose, onCancel, onRetry, onUpdate }: PostAnalyticsSheetProps) {
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  useEffect(() => {
    if (!visible || !post) return
    setEditing(post.can_edit && (post.status === 'scheduled' || post.status === 'pending'))
    setCaption(post.caption ?? '')
    setScheduledAt(post.scheduled_at ? toLocalScheduleValue(new Date(post.scheduled_at)) : '')
    setScheduleOpen(false)
    setAccountsOpen(false)
  }, [visible, post])

  if (!post) return null

  function openEdit() {
    setCaption(post?.caption ?? '')
    setScheduledAt(post?.scheduled_at ? toLocalScheduleValue(new Date(post.scheduled_at)) : '')
    setEditing(true)
  }

  async function handleCancel() {
    if (!post || !onCancel) return
    appAlert('Cancel post', 'Remove this post from the schedule?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel post',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setActionLoading(true)
            try {
              await onCancel(post.id)
              onClose()
            } catch (error) {
              appAlert('Could not cancel post', error instanceof Error ? error.message : 'Please try again.')
            } finally {
              setActionLoading(false)
            }
          })()
        }
      }
    ])
  }

  async function handleRetry() {
    if (!post || !onRetry) return
    setActionLoading(true)
    try {
      await onRetry(post.id)
      onClose()
    } catch (error) {
      appAlert('Could not retry post', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSaveEdit() {
    if (!post || !onUpdate) return
    setActionLoading(true)
    try {
      const data: { caption?: string; scheduled_at?: string } = {}
      if (caption !== (post.caption ?? '')) data.caption = caption
      const original = post.scheduled_at ? toLocalScheduleValue(new Date(post.scheduled_at)) : ''
      if (scheduledAt !== original) {
        const parsed = new Date(scheduledAt)
        if (!isValidScheduleTime(parsed)) {
          appAlert('Invalid time', 'Schedule at least 5 minutes in the future.')
          return
        }
        data.scheduled_at = parsed.toISOString()
      }
      await onUpdate(post.id, data)
      setEditing(false)
      onClose()
    } catch (error) {
      appAlert('Could not update post', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={actionLoading ? () => undefined : onClose}
        variant="page"
        title={
          post.status === 'failed'
            ? 'Post needs attention'
            : post.status === 'published'
              ? 'Post performance'
              : 'Scheduled post'
        }
        keyboardAvoiding
        primaryAction={
          editing
            ? {
                title: actionLoading ? 'Saving…' : 'Save changes',
                onPress: () => void handleSaveEdit(),
                disabled: actionLoading
              }
            : undefined
        }
      >
        {post.thumbnail_url ? (
          <Image
            source={{ uri: post.thumbnail_url }}
            resizeMode="cover"
            className="h-[180px] w-full rounded-[14px] bg-surface"
          />
        ) : null}
        <PostStatusBadge status={post.status} />
        <Text className="text-sm text-muted">
          {getSocialPlatformLabel(post.platform)}
          {post.social_account ? ` · @${post.social_account.username}` : ''} · {post.organization?.name ?? 'Personal'}
        </Text>
        {editing ? (
          <>
            <View className="gap-2">
              <Text className="text-xs font-semibold text-foreground">Caption</Text>
              <Input
                accessibilityLabel="Post caption"
                value={caption}
                onChangeText={setCaption}
                multiline
                textAlignVertical="top"
                maxLength={2200}
                style={{ minHeight: 120 }}
                editable={!actionLoading}
              />
              <Text className="text-right text-xs text-muted">{caption.length} / 2,200</Text>
            </View>
            <MenuRow
              icon="calendar-outline"
              title="Schedule time"
              subtitle={scheduledAt ? formatScheduleLabel(scheduledAt) : 'Choose a time'}
              onPress={() => {
                if (!actionLoading) setScheduleOpen(true)
              }}
            />
            <Button title="Discard edits" variant="ghost" disabled={actionLoading} onPress={() => setEditing(false)} />
          </>
        ) : (
          <>
            {post.caption ? <Text className="text-sm leading-[21px] text-foreground">{post.caption}</Text> : null}
            {post.status === 'published' ? (
              <>
                <AnalyticsGrid analytics={post.analytics} />
                <Text className="text-sm text-muted">Latest available performance for this post.</Text>
              </>
            ) : null}
            {post.status === 'failed' ? (
              <>
                <Text className="rounded-xl bg-destructive/10 p-4 text-sm leading-[21px] text-destructive">
                  {post.error_message || 'This post could not be published. Check its destination and try again.'}
                </Text>
                <Button title="Manage connected accounts" variant="outline" onPress={() => setAccountsOpen(true)} />
                {onRetry ? (
                  <Button
                    title="Retry post"
                    variant="accent"
                    disabled={actionLoading}
                    onPress={() => void handleRetry()}
                  />
                ) : null}
              </>
            ) : null}
            {post.can_edit && onUpdate ? (
              <Button title="Edit caption & time" variant="accent" onPress={openEdit} />
            ) : null}
            {post.post_url ? (
              <Button
                title="Open published post"
                variant="outline"
                onPress={() => void WebBrowser.openBrowserAsync(post.post_url!)}
              />
            ) : null}
          </>
        )}
        {post.can_cancel && onCancel ? (
          <Button
            title="Cancel scheduled post"
            variant="destructive"
            disabled={actionLoading}
            onPress={() => void handleCancel()}
          />
        ) : null}
      </BottomSheet>
      <ScheduleTimeSheet
        visible={scheduleOpen}
        value={scheduledAt}
        onClose={() => setScheduleOpen(false)}
        onConfirm={setScheduledAt}
      />
      <AccountsSheet visible={accountsOpen} onClose={() => setAccountsOpen(false)} />
    </>
  )
}
