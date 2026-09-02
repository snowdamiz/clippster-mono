import type { SubtitleSettings } from '@clippster/shared-types';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CaptionPresetPicker } from '@/components/subtitles/CaptionPresetPicker';
import { SeekBar } from '@/components/ui/seek-bar';
import { settingsFromPresetId } from '@/lib/captionPresets';

export const CAPTION_TEXT_COLORS = [
  '#FFFFFF',
  '#FACC15',
  '#000000',
  '#EF4444',
  '#22D3EE',
  '#F97316',
  '#A855F7',
];

export const CAPTION_HIGHLIGHT_COLORS = [
  '#FACC15',
  '#FFFFFF',
  '#22D3EE',
  '#EF4444',
  '#0ea5e9',
  '#EC4899',
];

interface CaptionStylePanelProps {
  enabled: boolean;
  presetId: string;
  settings: SubtitleSettings;
  onChange: (next: { enabled: boolean; presetId: string; settings: SubtitleSettings }) => void;
}

function ColorRow({
  label,
  value,
  colors,
  onChange,
}: {
  label: string;
  value: string;
  colors: string[];
  onChange: (color: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {colors.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={color}
              onPress={() => onChange(color)}
              className={`h-8 w-8 rounded-full border-2 ${selected ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </View>
    </View>
  );
}

export function CaptionStylePanel({ enabled, presetId, settings, onChange }: CaptionStylePanelProps) {
  function updateSettings(partial: Partial<SubtitleSettings>) {
    onChange({
      enabled,
      presetId,
      settings: { ...settings, ...partial, enabled },
    });
  }

  return (
    <ScrollView className="max-h-64" contentContainerClassName="gap-3 px-4 pb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Captions</Text>
        <Pressable
          onPress={() =>
            onChange({
              enabled: !enabled,
              presetId,
              settings: { ...settings, enabled: !enabled },
            })
          }
          className={`rounded-full px-3 py-1 ${enabled ? 'bg-primary' : 'bg-surface'}`}
        >
          <Text className={`text-xs font-semibold ${enabled ? 'text-primary-foreground' : 'text-muted'}`}>
            {enabled ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>

      <CaptionPresetPicker
        selectedId={presetId}
        onSelect={(id) => {
          const next = settingsFromPresetId(id);
          onChange({
            enabled: true,
            presetId: id,
            settings: {
              ...next,
              enabled: true,
              positionPercentage: settings.positionPercentage,
            },
          });
        }}
      />

      <ColorRow
        label="Text color"
        value={settings.textColor}
        colors={CAPTION_TEXT_COLORS}
        onChange={(textColor) => updateSettings({ textColor })}
      />
      <ColorRow
        label="Highlight"
        value={settings.highlightColor}
        colors={CAPTION_HIGHLIGHT_COLORS}
        onChange={(highlightColor) => updateSettings({ highlightColor })}
      />

      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
          Size {Math.round(settings.fontSize)}
        </Text>
        <SeekBar
          minimumValue={24}
          maximumValue={84}
          step={1}
          value={settings.fontSize}
          onValueChange={(fontSize) => updateSettings({ fontSize })}
        />
      </View>
    </ScrollView>
  );
}
