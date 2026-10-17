import { Text, View } from 'react-native'
import { CAPTION_PRESETS } from '@/lib/captionPresets'
import { EditorChoices } from '@/editor/panels/EditorSheet'

interface CaptionPresetPickerProps {
  selectedId: string
  onSelect: (presetId: string) => void
}

export function CaptionPresetPicker({ selectedId, onSelect }: CaptionPresetPickerProps) {
  const preset = CAPTION_PRESETS.find((candidate) => candidate.id === selectedId) ?? CAPTION_PRESETS[0]
  const preview = preset.preview
  return (
    <View className="gap-[17px]">
      <EditorChoices
        options={CAPTION_PRESETS.map((item) => ({ value: item.id, label: item.name }))}
        value={selectedId}
        onChange={onSelect}
      />
      <View className="min-h-[112px] items-center justify-center rounded-[18px] bg-surface p-4">
        <Text
          style={{
            color: preview.color,
            fontWeight: preview.fontWeight,
            letterSpacing: preview.letterSpacing,
            backgroundColor: preview.backgroundColor,
            textShadowColor: preview.textShadowColor,
            textShadowRadius: preview.textShadowRadius,
            textShadowOffset: preview.textShadowColor ? { width: 0, height: 0 } : undefined,
            paddingHorizontal: 6,
            paddingVertical: 3,
            fontSize: 24,
            textAlign: 'center'
          }}
        >
          {preset.id === 'karaoke' ? (
            <>
              <Text style={{ color: '#38bdf8' }}>WORD</Text>
              <Text style={{ color: '#FFFFFF' }}> BY </Text>
              <Text style={{ color: '#38bdf8' }}>WORD</Text>
            </>
          ) : (
            preview.text
          )}
        </Text>
      </View>
      <Text className="text-sm leading-[21px] text-muted">{preset.description}</Text>
    </View>
  )
}
