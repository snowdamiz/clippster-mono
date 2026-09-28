import { useState } from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { EditorChoices, EditorSheet } from '../panels/EditorSheet'
import { tokens } from '@/theme/tokens'

import type { CanvasRatio } from '../model/schema'

export function CanvasControls({
  activeRatio,
  safeAreaVisible,
  onRatioChange,
  onToggleSafeArea
}: {
  activeRatio: CanvasRatio
  safeAreaVisible: boolean
  onRatioChange: (ratio: CanvasRatio) => void
  onToggleSafeArea: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Canvas settings"
        onPress={() => setOpen(true)}
        className="min-h-11 justify-center px-3"
      >
        <Text className="text-[13px] font-semibold text-accent">Canvas</Text>
      </Pressable>
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
