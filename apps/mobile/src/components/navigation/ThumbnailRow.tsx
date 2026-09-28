import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { tokens } from '@/theme/tokens'

interface ThumbnailRowProps {
  title: string
  subtitle?: string
  image?: string | null
  onPress?: () => void
  children?: ReactNode
  selected?: boolean
}

export function ThumbnailRow({ title, subtitle, image, onPress, children, selected }: ThumbnailRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected === undefined ? undefined : { selected }}
      className="min-h-[84px] flex-row items-center gap-3 border-b border-border py-[13px]"
    >
      {image ? (
        <Image
          source={{ uri: image }}
          className="h-[58px] w-[72px] rounded-[10px] bg-surfaceMuted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-[58px] w-[72px] items-center justify-center rounded-[10px] bg-surfaceMuted">
          <Ionicons name="videocam-outline" size={24} color={tokens.colors.muted} />
        </View>
      )}
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text className="text-xs leading-[18px] text-muted">{subtitle}</Text> : null}
        {children}
      </View>
      {onPress ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'chevron-forward'}
          size={20}
          color={selected ? tokens.colors.accent : tokens.colors.muted}
        />
      ) : null}
    </Pressable>
  )
}
