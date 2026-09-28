import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { EditorChoices, EditorSheet } from './EditorSheet'
import { SeekBar } from '@/components/ui/seek-bar'
import type { TextStyle } from '../model/schema'

const COLORS = ['#FFFFFF', '#FACC15', '#22D3EE', '#EF4444', '#F97316', '#A855F7']
const ANIMATIONS = ['none', 'fade', 'pop', 'bounce', 'slide'] as const

export function TextStyleSheet({
  visible,
  mode = 'style',
  initialStyle,
  initialAnimation,
  onClose,
  onApply
}: {
  mode?: 'style' | 'animation'
  visible: boolean
  initialStyle?: TextStyle
  initialAnimation?: string
  onClose: () => void
  onApply: (style: TextStyle, animation?: string) => void
}) {
  const [style, setStyle] = useState<TextStyle | undefined>(initialStyle)
  const [animation, setAnimation] = useState(initialAnimation ?? 'none')

  useEffect(() => {
    if (!visible) return
    setStyle(initialStyle)
    setAnimation(initialAnimation ?? 'none')
  }, [initialAnimation, initialStyle, visible])

  if (!style) return null
  return (
    <EditorSheet
      visible={visible}
      title={mode === 'animation' ? 'Text animation' : 'Text style'}
      onClose={onClose}
      action={{
        title: mode === 'animation' ? 'Apply animation' : 'Apply style',
        onPress: () => {
          onApply(style, animation === 'none' ? undefined : animation)
          onClose()
        }
      }}
    >
      {mode === 'style' ? (
        <>
          <Text className="mb-2 mt-4 text-sm text-muted">Color</Text>
          <View className="flex-row flex-wrap gap-3">
            {COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setStyle((current) => (current ? { ...current, color } : current))}
                className={`h-10 w-10 rounded-full border-2 ${
                  style.color === color ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </View>
          <View className="mt-5 flex-row justify-between">
            <Text className="text-sm text-muted">Size</Text>
            <Text className="text-sm font-semibold text-foreground">{Math.round(style.fontSize)}</Text>
          </View>
          <SeekBar
            minimumValue={18}
            maximumValue={96}
            step={1}
            value={style.fontSize}
            onValueChange={(fontSize) => setStyle((current) => (current ? { ...current, fontSize } : current))}
          />
        </>
      ) : null}
      <>
        <Text className="mb-2 mt-3 text-sm text-muted">Animation</Text>
        <EditorChoices
          options={ANIMATIONS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
          value={animation}
          onChange={setAnimation}
        />
      </>
    </EditorSheet>
  )
}
