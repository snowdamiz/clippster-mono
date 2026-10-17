import { useState } from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { EditorChoices, EditorSheet } from '../panels/EditorSheet'
import { tokens } from '@/theme/tokens'
import { AppIcon } from '@/components/AppIcon'

import type { CanvasRatio } from '../model/schema'

export function CanvasControls({
  activeRatio,
  safeAreaVisible,
  canvasInset = 0,
  onRatioChange,
  onToggleSafeArea
}: {
  activeRatio: CanvasRatio
  safeAreaVisible: boolean
  canvasInset?: number
  onRatioChange: (ratio: CanvasRatio) => void
  onToggleSafeArea: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <View className="flex-row items-center justify-between" style={{ paddingLeft: canvasInset }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Canvas settings"
          onPress={() => setOpen(true)}
          className="min-h-11 flex-row items-center gap-2 rounded-lg bg-background/80 px-2"
        >
          <Text className="text-[13px] font-semibold text-foreground">{activeRatio}</Text>
          <AppIcon name="ChevronDown" size={15} color={tokens.colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle safe area guides"
          accessibilityState={{ selected: safeAreaVisible }}
          onPress={onToggleSafeArea}
          className="min-h-11 min-w-11 items-center justify-center rounded-lg bg-background/80"
        >
          <AppIcon name="Scan" size={20} color={safeAreaVisible ? tokens.colors.accent : tokens.colors.foreground} />
        </Pressable>
      </View>
      <EditorSheet
        visible={open}
        title="Canvas"
        onClose={() => setOpen(false)}
        secondaryAction={{ title: 'Done', onPress: () => setOpen(false), variant: 'accent' }}
      >
        <EditorChoices
          options={[
            { value: '9:16', label: '9:16 Portrait' },
            { value: '16:9', label: '16:9 Landscape' }
          ]}
          value={activeRatio}
          onChange={onRatioChange}
        />
        <View className="min-h-[60px] flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-sm text-foreground">Show platform safe area</Text>
          <Switch
            accessibilityLabel="Show platform safe area"
            value={safeAreaVisible}
            onValueChange={onToggleSafeArea}
            trackColor={{ true: tokens.colors.accent }}
          />
        </View>
        <Text className="text-sm leading-[21px] text-muted">Keep important text and faces inside the guides.</Text>
      </EditorSheet>
    </>
  )
}
