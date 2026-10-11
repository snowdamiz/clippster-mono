import { Image, Pressable, Text, View } from 'react-native'
import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { tokens } from '@/theme/tokens'

export type CreatorTool = 'clipper' | 'accounts' | 'branding' | 'cloud'
const TOOLS: { id: CreatorTool; icon: AppIconName; title: string; subtitle: string }[] = [
  { id: 'clipper', icon: 'UserRound', title: 'Clipper profile', subtitle: 'Bio, skills, portfolio' },
  { id: 'accounts', icon: 'Globe', title: 'Connected accounts', subtitle: 'Personal & organization channels' },
  { id: 'branding', icon: 'Palette', title: 'Creator branding', subtitle: 'Intros, outros, watermarks' },
  { id: 'cloud', icon: 'Cloud', title: 'Cloud & shared work', subtitle: 'Sync and organization clips' }
]

export function CreatorToolsSheet({
  visible,
  onClose,
  name,
  avatarUrl,
  onPreview,
  onSelect
}: {
  visible: boolean
  onClose: () => void
  name: string
  avatarUrl?: string | null
  onPreview: () => void
  onSelect: (tool: CreatorTool) => void
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} variant="page" title="Creator tools">
      <View className="mb-3 flex-row items-center gap-4 py-3">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} className="h-16 w-16 rounded-full" />
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-full bg-surfaceMuted">
            <AppIcon name="UserRound" size={32} color={tokens.colors.foreground} />
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text className="text-xl font-bold text-foreground">{name}</Text>
          <Text className="text-sm text-muted">Content creator</Text>
          <Pressable onPress={onPreview} className="min-h-11 justify-center">
            <Text className="text-sm text-accent">Preview profile →</Text>
          </Pressable>
        </View>
      </View>
      {TOOLS.map((tool) => (
        <Pressable
          key={tool.id}
          accessibilityRole="button"
          onPress={() => onSelect(tool.id)}
          className="min-h-[90px] flex-row items-center gap-4 rounded-[18px] border border-border bg-surface p-4"
        >
          <AppIcon name={tool.icon} size={32} color={tokens.colors.foreground} />
          <View className="flex-1 gap-1">
            <Text className="text-[17px] font-semibold text-foreground">{tool.title}</Text>
            <Text className="text-xs leading-5 text-muted">{tool.subtitle}</Text>
          </View>
          <AppIcon name="ChevronRight" size={20} color={tokens.colors.muted} />
        </Pressable>
      ))}
    </BottomSheet>
  )
}
