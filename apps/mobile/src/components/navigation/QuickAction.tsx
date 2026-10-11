import { Pressable, Text } from 'react-native'
import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { tokens } from '@/theme/tokens'

export function QuickAction({
  icon,
  title,
  onPress,
  disabled
}: {
  icon: AppIconName
  title: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[82px] flex-1 items-center justify-center gap-2 rounded-[14px] border border-border bg-surface px-1 ${disabled ? 'opacity-50' : ''}`}
    >
      <AppIcon name={icon} size={24} color={tokens.colors.accent} />
      <Text className="text-center text-[11px] font-medium text-foreground">{title}</Text>
    </Pressable>
  )
}
