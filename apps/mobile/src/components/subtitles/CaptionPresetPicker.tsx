import { Pressable, Text, View } from 'react-native';
import { CAPTION_PRESETS } from '@/lib/captionPresets';

interface CaptionPresetPickerProps {
  selectedId: string;
  onSelect: (presetId: string) => void;
}

export function CaptionPresetPicker({ selectedId, onSelect }: CaptionPresetPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {CAPTION_PRESETS.map((preset) => {
        const selected = preset.id === selectedId;
        const preview = preset.preview;
        return (
          <Pressable
            key={preset.id}
            onPress={() => onSelect(preset.id)}
            className={`w-[48%] overflow-hidden rounded-lg border ${
              selected ? 'border-accent bg-accent/10' : 'border-border bg-surface'
            }`}
          >
            <View className="flex-row items-center justify-between px-2 pt-2">
              <Text className="text-xs font-semibold text-foreground">{preset.name}</Text>
              {selected ? <Text className="text-[10px] font-semibold text-accent">On</Text> : null}
            </View>
            <View className="mx-2 my-2 items-center justify-center rounded-md bg-[#1a1a1c] px-2 py-3">
              <Text
                numberOfLines={1}
                style={{
                  color: preview.color,
                  fontWeight: preview.fontWeight,
                  letterSpacing: preview.letterSpacing,
                  backgroundColor: preview.backgroundColor,
                  textShadowColor: preview.textShadowColor,
                  textShadowRadius: preview.textShadowRadius,
                  textShadowOffset: preview.textShadowColor ? { width: 0, height: 0 } : undefined,
                  paddingHorizontal: preview.backgroundColor ? 6 : 0,
                  paddingVertical: preview.backgroundColor ? 3 : 0,
                  overflow: 'hidden',
                  fontSize: 13,
                }}
              >
                {preset.id === 'karaoke' ? (
                  <>
                    <Text style={{ color: '#0ea5e9' }}>WORD</Text>
                    <Text style={{ color: '#FFFFFF' }}> BY </Text>
                    <Text style={{ color: '#0ea5e9' }}>WORD</Text>
                  </>
                ) : (
                  preview.text
                )}
              </Text>
            </View>
            <Text className="px-2 pb-2 text-[10px] text-muted">{preset.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
