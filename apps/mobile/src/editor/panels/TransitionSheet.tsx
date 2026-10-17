import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { EditorChoices, EditorSheet } from './EditorSheet'
import { SeekBar } from '@/components/ui/seek-bar'
import type { TransitionKind } from '../model/schema'

const TRANSITIONS: { kind: TransitionKind; label: string }[] = [
  { kind: 'cut', label: 'Cut' },
  { kind: 'fade', label: 'Fade' },
  { kind: 'dissolve', label: 'Dissolve' },
  { kind: 'wipe', label: 'Wipe' }
]

export function TransitionSheet({
  visible,
  initialKind,
  initialDurationSeconds,
  onClose,
  onApply
}: {
  visible: boolean
  initialKind: TransitionKind
  initialDurationSeconds: number
  onClose: () => void
  onApply: (kind: TransitionKind, durationSeconds: number) => void
}) {
  const [kind, setKind] = useState(initialKind)
  const [duration, setDuration] = useState(initialDurationSeconds)

  useEffect(() => {
    if (!visible) return
    setKind(initialKind)
    setDuration(initialDurationSeconds)
  }, [initialDurationSeconds, initialKind, visible])

  return (
    <EditorSheet
      visible={visible}
      title="Transition"
      onClose={onClose}
      action={{
        title: 'Apply transition',
        onPress: () => {
          onApply(kind, kind === 'cut' ? 0 : duration)
          onClose()
        }
      }}
    >
      <Text className="text-sm text-muted">Between clips</Text>
      <EditorChoices
        options={TRANSITIONS.map((option) => ({ value: option.kind, label: option.label }))}
        value={kind}
        onChange={setKind}
      />
      <View className="flex-row justify-between">
        <Text className="text-sm text-muted">Duration</Text>
        <Text className="text-sm font-semibold text-foreground">
          {kind === 'cut' ? 'Instant' : `${duration.toFixed(1)}s`}
        </Text>
      </View>
      <SeekBar minimumValue={0.1} maximumValue={1.5} step={0.1} value={duration} onValueChange={setDuration} />
    </EditorSheet>
  )
}
