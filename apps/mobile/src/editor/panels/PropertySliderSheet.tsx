import { useEffect, useState } from 'react'
import { Text } from 'react-native'

import { EditorChoices, EditorSheet } from './EditorSheet'
import { SeekBar } from '@/components/ui/seek-bar'

export interface PropertySliderConfig {
  title: string
  value: number
  minimumValue: number
  maximumValue: number
  step: number
  formatValue: (value: number) => string
  apply: (value: number) => void
}

export function PropertySliderSheet({ config, onClose }: { config: PropertySliderConfig | null; onClose: () => void }) {
  const [value, setValue] = useState(config?.value ?? 0)

  useEffect(() => {
    if (config) setValue(config.value)
  }, [config])

  return (
    <EditorSheet
      visible={Boolean(config)}
      title={config?.title ?? ''}
      onClose={onClose}
      action={{
        title: `Apply ${config?.title.split(' ').pop()?.toLowerCase() ?? 'change'}`,
        onPress: () => {
          config?.apply(value)
          onClose()
        }
      }}
    >
      <Text className="text-right text-sm font-semibold text-foreground">{config?.formatValue(value)}</Text>
      {config ? (
        <SeekBar
          minimumValue={config.minimumValue}
          maximumValue={config.maximumValue}
          step={config.step}
          value={value}
          onValueChange={setValue}
        />
      ) : null}
      {config?.title.toLowerCase().includes('speed') ? (
        <>
          <EditorChoices
            options={['0.5', '1', '1.5', '2'].map((speed) => ({ value: speed, label: `${speed}×` }))}
            value={String(value)}
            onChange={(speed) => setValue(Number(speed))}
          />
          <Text className="text-sm leading-[21px] text-muted">Changes playback speed and clip duration.</Text>
        </>
      ) : null}
    </EditorSheet>
  )
}
