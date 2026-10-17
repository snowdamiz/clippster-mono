import { AppIcon } from '@/components/AppIcon'
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import type { ProjectClipRow } from '@/services/database'
import { formatClock, formatDurationLabel, toLocalImageUri } from '@/lib/formatTime'
import { tokens } from '@/theme/tokens'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MenuRow } from '@/components/navigation/MenuRow'

interface ClipListCardProps {
  clip: ProjectClipRow
  index: number
  fallbackThumbnail?: string | null
  onPress: () => void
  onDelete: () => void
}

export function ClipListCard({ clip, index, fallbackThumbnail, onPress, onDelete }: ClipListCardProps) {
  const [optionsVisible, setOptionsVisible] = useState(false)
  const start = clip.start_time ?? 0
  const end = clip.end_time ?? start
  const duration = clip.duration ?? Math.max(0, end - start)
  const thumbUri =
    toLocalImageUri(clip.thumbnail_path) ??
    toLocalImageUri(clip.built_thumbnail_path) ??
    toLocalImageUri(fallbackThumbnail)
  const title = clip.name || `Clip ${index}`

  return (
    <>
      <View className="flex-row items-center rounded-[14px] border border-border bg-surface p-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${title}`}
          onPress={onPress}
          className="min-w-0 flex-1 flex-row items-center gap-3"
        >
          <View className="h-[58px] w-[72px] items-center justify-center overflow-hidden rounded-[10px] bg-surfaceMuted">
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <AppIcon name="Video" size={22} color={tokens.colors.muted} />
            )}
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text numberOfLines={2} className="text-sm font-semibold text-foreground">
              {title}
            </Text>
            <Text className="text-xs text-muted">
              {formatDurationLabel(duration)} · {formatClock(start)} – {formatClock(end)}
            </Text>
          </View>
          <AppIcon name="ChevronRight" size={18} color={tokens.colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Options for ${title}`}
          onPress={() => setOptionsVisible(true)}
          className="min-h-11 min-w-11 items-center justify-center"
        >
          <AppIcon name="EllipsisVertical" size={20} color={tokens.colors.muted} />
        </Pressable>
      </View>
      <BottomSheet visible={optionsVisible} onClose={() => setOptionsVisible(false)} title={title}>
        <Text className="text-sm text-muted">
          {formatDurationLabel(duration)} · {formatClock(start)} – {formatClock(end)}
        </Text>
        {clip.virality_score != null ? (
          <Text className="text-sm text-muted">Virality score · {Math.round(clip.virality_score)}%</Text>
        ) : null}
        {clip.confidence_score != null ? (
          <Text className="text-sm text-muted">Confidence · {Math.round(clip.confidence_score * 100)}%</Text>
        ) : null}
        {clip.detection_reason ? (
          <Text className="text-sm leading-[21px] text-muted">{clip.detection_reason}</Text>
        ) : null}
        <MenuRow
          icon="Play"
          title="Open clip"
          onPress={() => {
            setOptionsVisible(false)
            onPress()
          }}
        />
        <MenuRow
          icon="Trash2"
          title="Delete clip"
          destructive
          onPress={() => {
            setOptionsVisible(false)
            onDelete()
          }}
        />
      </BottomSheet>
    </>
  )
}
