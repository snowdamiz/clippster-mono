import type { ReactNode } from 'react';
import type { SubtitleSettings } from '@clippster/shared-types';
import { Pressable, Text, View } from 'react-native';
import { SeekBar } from '@/components/ui/seek-bar';
import {
  CAPTION_ANIMATION_STYLES,
  CAPTION_FONTS,
  CAPTION_HIGHLIGHT_PRESETS,
  CAPTION_TEXT_COLORS,
  CAPTION_WEIGHTS,
  getCaptionStyleDefaults,
} from '@/lib/captionStyleDefaults';

interface CaptionStylePanelProps {
  enabled: boolean;
  settings: SubtitleSettings;
  onChange: (next: { enabled: boolean; settings: SubtitleSettings }) => void;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-2 border-b border-border pb-3">
      <View>
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</Text>
        {hint ? <Text className="mt-0.5 text-[11px] text-muted">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
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
      <Text className="text-xs text-muted">{label}</Text>
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

export function CaptionStylePanel({ enabled, settings, onChange }: CaptionStylePanelProps) {
  function patch(partial: Partial<SubtitleSettings>, nextEnabled = enabled) {
    onChange({
      enabled: nextEnabled,
      settings: { ...settings, ...partial, enabled: nextEnabled },
    });
  }

  const showHighlight = ['karaoke', 'pop', 'zoom', 'glow'].includes(settings.animationStyle);

  return (
    <View className="gap-3 px-4 pb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Captions</Text>
        <Pressable
          onPress={() => patch({}, !enabled)}
          className={`rounded-full px-3 py-1 ${enabled ? 'bg-accent' : 'bg-surface'}`}
        >
          <Text className={`text-xs font-semibold ${enabled ? 'text-white' : 'text-muted'}`}>
            {enabled ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>

      <Section title="Animation Style">
        <View className="flex-row flex-wrap gap-2">
          {CAPTION_ANIMATION_STYLES.map((style) => {
            const selected = settings.animationStyle === style.id;
            return (
              <Pressable
                key={style.id}
                onPress={() =>
                  patch({
                    ...getCaptionStyleDefaults(style.id),
                    animationStyle: style.id,
                  })
                }
                className={`w-[48%] rounded-lg border px-2.5 py-2 ${
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-xs font-semibold text-foreground">{style.name}</Text>
                <Text className="mt-0.5 text-[10px] text-muted" numberOfLines={2}>
                  {style.desc}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {showHighlight ? (
        <Section title="Highlight Color" hint="Color when word is active">
          <ColorRow
            label=""
            value={settings.highlightColor}
            colors={CAPTION_HIGHLIGHT_PRESETS.map((p) => p.value)}
            onChange={(highlightColor) => patch({ highlightColor })}
          />
        </Section>
      ) : null}

      <Section title="Font">
        <View className="flex-row flex-wrap gap-2">
          {CAPTION_FONTS.map((font) => {
            const selected = settings.fontFamily === font;
            return (
              <Pressable
                key={font}
                onPress={() => patch({ fontFamily: font })}
                className={`rounded-lg border px-2.5 py-1.5 ${
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-xs text-foreground">{font}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-2 gap-1">
          <Text className="text-xs text-muted">Size {Math.round(settings.fontSize)}px</Text>
          <SeekBar
            minimumValue={8}
            maximumValue={120}
            step={1}
            value={settings.fontSize}
            onValueChange={(fontSize) => patch({ fontSize })}
          />
        </View>

        <View className="mt-2 gap-1">
          <Text className="text-xs text-muted">Weight</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {CAPTION_WEIGHTS.map((weight) => {
              const selected = settings.fontWeight === weight.v;
              return (
                <Pressable
                  key={weight.v}
                  onPress={() => patch({ fontWeight: weight.v })}
                  className={`rounded-full px-2.5 py-1 ${
                    selected ? 'bg-accent' : 'border border-border bg-surface'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${selected ? 'text-white' : 'text-foreground'}`}
                  >
                    {weight.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-2 gap-1">
          <Text className="text-xs text-muted">Alignment</Text>
          <View className="flex-row gap-1.5">
            {(['left', 'center', 'right'] as const).map((align) => {
              const selected = settings.textAlign === align;
              return (
                <Pressable
                  key={align}
                  onPress={() => patch({ textAlign: align })}
                  className={`flex-1 items-center rounded-lg py-2 ${
                    selected ? 'bg-accent' : 'border border-border bg-surface'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold capitalize ${
                      selected ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {align}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title="Colors" hint="Subtitle fill and karaoke highlight">
        <ColorRow
          label="Text"
          value={settings.textColor}
          colors={CAPTION_TEXT_COLORS}
          onChange={(textColor) => patch({ textColor })}
        />
        <ColorRow
          label="Highlight"
          value={settings.highlightColor}
          colors={CAPTION_HIGHLIGHT_PRESETS.map((p) => p.value)}
          onChange={(highlightColor) => patch({ highlightColor })}
        />
      </Section>

      <Section title="Outline" hint="Stroke behind the text">
        <View className="gap-1">
          <Text className="text-xs text-muted">
            Border {Math.round(settings.border1Width || settings.border2Width)}px
          </Text>
          <SeekBar
            minimumValue={0}
            maximumValue={20}
            step={1}
            value={settings.border1Width || settings.border2Width}
            onValueChange={(width) =>
              patch({
                border1Width: width,
                border2Width: 0,
                border1Color: settings.border1Color || '#000000',
              })
            }
          />
        </View>
      </Section>

      <Section title="Background">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted">Fill behind text</Text>
          <Pressable
            onPress={() => patch({ backgroundEnabled: !settings.backgroundEnabled })}
            className={`rounded-full px-3 py-1 ${
              settings.backgroundEnabled ? 'bg-accent' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                settings.backgroundEnabled ? 'text-white' : 'text-muted'
              }`}
            >
              {settings.backgroundEnabled ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>
        {settings.backgroundEnabled ? (
          <View className="mt-2 gap-1">
            <Text className="text-xs text-muted">Padding {Math.round(settings.padding)}px</Text>
            <SeekBar
              minimumValue={0}
              maximumValue={40}
              step={1}
              value={settings.padding}
              onValueChange={(padding) => patch({ padding })}
            />
          </View>
        ) : null}
      </Section>

      <Section title="Position">
        <View className="gap-1">
          <Text className="text-xs text-muted">
            Vertical {Math.round(settings.positionPercentage)}%
          </Text>
          <SeekBar
            minimumValue={5}
            maximumValue={95}
            step={1}
            value={settings.positionPercentage}
            onValueChange={(positionPercentage) => patch({ positionPercentage })}
          />
        </View>
      </Section>
    </View>
  );
}
