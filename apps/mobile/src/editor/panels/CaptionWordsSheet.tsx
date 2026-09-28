import { useState, useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MenuRow } from '@/components/navigation/MenuRow'
import { Input } from '@/components/ui/input'
import { SeekBar } from '@/components/ui/seek-bar'
import { EmptyState } from '@/components/ui/EmptyState'
import { EditCaptionWordCommand, RetimeCaptionWordCommand } from '../commands/captionCommands'
import type { MobileEditorController } from '../state/editorController'
import { secondsToTicks, ticksToSeconds } from '../model/schema'

export function CaptionWordsSheet({
  visible,
  controller,
  onClose
}: {
  visible: boolean
  controller: MobileEditorController
  onClose: () => void
}) {
  const snapshot = useSyncExternalStore(
    (callback) => controller.subscribe(callback),
    () => controller.snapshot
  )
  const words = snapshot.document.captionDocument?.words ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [duration, setDuration] = useState(0.5)
  const selected = words.find((word) => word.id === selectedId)
  const close = () => {
    setSelectedId(null)
    onClose()
  }
  return (
    <BottomSheet
      visible={visible}
      variant="page"
      title={selected ? 'Edit caption word' : 'Caption words'}
      onClose={selected ? () => setSelectedId(null) : close}
      keyboardAvoiding
      primaryAction={{
        title: selected ? 'Apply word' : 'Done',
        disabled: !!selected && !text.trim(),
        onPress: () => {
          if (!selected) {
            close()
            return
          }
          controller.commit(new EditCaptionWordCommand(selected.id, text, Date.now()))
          controller.commit(
            new RetimeCaptionWordCommand(
              selected.id,
              selected.start,
              selected.start + secondsToTicks(duration),
              Date.now()
            )
          )
          setSelectedId(null)
        }
      }}
    >
      {selected ? (
        <>
          <Text className="text-xs font-semibold text-foreground">Word</Text>
          <Input value={text} onChangeText={setText} accessibilityLabel="Caption word" />
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">Word duration</Text>
            <Text className="text-sm text-foreground">{duration.toFixed(2)} sec</Text>
          </View>
          <SeekBar
            minimumValue={0.1}
            maximumValue={Math.max(3, ticksToSeconds(selected.end - selected.start))}
            step={0.05}
            value={duration}
            onValueChange={setDuration}
          />
        </>
      ) : words.length ? (
        words.map((word) => (
          <MenuRow
            key={word.id}
            icon="text-outline"
            title={word.word}
            subtitle={`${ticksToSeconds(word.start).toFixed(2)}–${ticksToSeconds(word.end).toFixed(2)} sec`}
            onPress={() => {
              setSelectedId(word.id)
              setText(word.word)
              setDuration(ticksToSeconds(word.end - word.start))
            }}
          />
        ))
      ) : (
        <EmptyState
          icon="chatbox-outline"
          title="No transcript yet"
          subtitle="Transcribe the source clip to edit timed caption words."
        />
      )}
    </BottomSheet>
  )
}
