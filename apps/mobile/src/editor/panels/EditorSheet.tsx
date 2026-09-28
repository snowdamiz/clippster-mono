import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BottomSheet, type BottomSheetAction } from '@/components/ui/BottomSheet'

/** Shared editor sheet spacing and actions from the approved mobile design. */
export function EditorSheet({
  visible,
  title,
  onClose,
  children,
  action,
  secondaryAction
}: {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  action?: BottomSheetAction
  secondaryAction?: BottomSheetAction
}) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      closeMode="none"
      contentClassName="gap-[15px] px-[18px] py-[15px]"
      primaryAction={action}
      secondaryAction={secondaryAction ?? { title: 'Cancel', onPress: onClose, variant: 'ghost' }}
    >
      {children}
    </BottomSheet>
  )
}

export function EditorChoices<T extends string>({
  options,
  value,
  onChange
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View className="flex-row flex-wrap gap-[5px] rounded-[14px] bg-background p-[5px]">
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          className={`min-h-11 items-center justify-center rounded-[10px] px-3 ${value === option.value ? 'bg-surfaceMuted' : ''}`}
        >
          <Text className={`text-xs font-semibold ${value === option.value ? 'text-foreground' : 'text-muted'}`}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
