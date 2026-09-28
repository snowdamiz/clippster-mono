import { CLIP_EFFECT_PRESETS, type ClipEffect, type ClipEffectType } from '@clippster/clip-export'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { EditorChoices, EditorSheet } from './EditorSheet'
import { SeekBar } from '@/components/ui/seek-bar'

export type EffectsSheetMode = 'filters' | 'effects' | 'adjust'

const SUPPORTED_STYLE = new Set<ClipEffectType>([
  'vignette',
  'grain',
  'mirror',
  'letterbox',
  'blur',
  'sharpen',
  'glitch'
])

function presetsForMode(mode: EffectsSheetMode) {
  // LUT is intentionally absent from CLIP_EFFECT_PRESETS until provenance ships.
  return CLIP_EFFECT_PRESETS.filter((preset) => {
    if (mode === 'filters') return preset.category === 'color'
    if (mode === 'adjust') return preset.category === 'adjust'
    return preset.category === 'style' && SUPPORTED_STYLE.has(preset.type)
  })
}

function titleForMode(mode: EffectsSheetMode): string {
  if (mode === 'filters') return 'Filters'
  if (mode === 'adjust') return 'Adjust'
  return 'Effects'
}

function defaultIntensity(mode: EffectsSheetMode, type: ClipEffectType | null): number {
  if (!type) return mode === 'adjust' ? 50 : 70
  if (mode === 'adjust') return 50
  return 70
}

export function EffectsSheet({
  visible,
  initialEffect,
  onClose,
  onApply,
  mode = 'filters'
}: {
  visible: boolean
  initialEffect?: ClipEffect
  onClose: () => void
  onApply: (effect: ClipEffect | null) => void
  mode?: EffectsSheetMode
}) {
  const presets = presetsForMode(mode)
  const [type, setType] = useState<ClipEffectType | null>(initialEffect?.type ?? null)
  const [intensity, setIntensity] = useState(
    initialEffect?.intensity ?? defaultIntensity(mode, initialEffect?.type ?? null)
  )

  useEffect(() => {
    if (!visible) return
    const nextType = initialEffect?.type ?? null
    setType(nextType)
    setIntensity(initialEffect?.intensity ?? defaultIntensity(mode, nextType))
  }, [initialEffect, mode, visible])

  return (
    <EditorSheet
      visible={visible}
      title={titleForMode(mode)}
      onClose={onClose}
      action={{
        title: mode === 'adjust' ? 'Apply adjustment' : mode === 'filters' ? 'Apply filter' : 'Apply effect',
        onPress: () => {
          onApply(type ? { type, intensity } : null)
          onClose()
        }
      }}
    >
      <EditorChoices
        options={[
          { value: 'none', label: 'None' },
          ...presets.map((preset) => ({ value: preset.type, label: preset.label }))
        ]}
        value={type ?? 'none'}
        onChange={(next) => {
          setType(next === 'none' ? null : (next as ClipEffectType))
          if (mode === 'adjust' && type !== next) setIntensity(50)
        }}
      />
      <View className="mb-1 flex-row justify-between">
        <Text className="text-sm text-muted">{mode === 'adjust' ? 'Amount (50 = neutral)' : 'Intensity'}</Text>
        <Text className="text-sm font-semibold text-foreground">{Math.round(intensity)}%</Text>
      </View>
      <SeekBar minimumValue={0} maximumValue={100} step={1} value={intensity} onValueChange={setIntensity} />
    </EditorSheet>
  )
}
