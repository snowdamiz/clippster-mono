import type { SubtitleSettings, WordInfo } from '@clippster/shared-types';
import { Canvas, Group, Text, matchFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { hexToSkiaColor } from '@/lib/skiaColors';
import {
  getVisibleWordsAtTime,
  maxWordsChunkForAspectRatioString,
} from '@/lib/subtitleVisibleWords';

interface SubtitleOverlayProps {
  settings: SubtitleSettings;
  words: WordInfo[];
  currentTime: number;
  targetRatio: string;
  frameWidth?: number;
  frameHeight?: number;
}

function fontWeightToSkia(weight: number): 'normal' | 'bold' | '600' | '700' | '800' | '900' {
  if (weight >= 800) return '800';
  if (weight >= 700) return 'bold';
  if (weight >= 600) return '600';
  return 'normal';
}

export function SubtitleOverlay({
  settings,
  words,
  currentTime,
  targetRatio,
  frameWidth = 360,
  frameHeight,
}: SubtitleOverlayProps) {
  const [ratioW, ratioH] = targetRatio.split(':').map(Number);
  const height = frameHeight ?? frameWidth / ((ratioW || 16) / (ratioH || 9));
  const previewScale = frameWidth / 1080;

  const override = settings.perRatioConfigs?.[targetRatio];
  const positionPct = override?.positionPercentage ?? settings.positionPercentage;
  const fontSize = (override?.fontSize ?? settings.fontSize) * previewScale;
  const textColor = override?.textColor ?? settings.textColor;
  const highlightColor = override?.highlightColor ?? settings.highlightColor;

  const maxWords = maxWordsChunkForAspectRatioString(targetRatio, settings.animationStyle);
  const visible = useMemo(
    () => getVisibleWordsAtTime(words, currentTime, maxWords),
    [words, currentTime, maxWords],
  );

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: settings.fontFamily || 'System',
        fontSize,
        fontWeight: fontWeightToSkia(override?.fontWeight ?? settings.fontWeight),
      }),
    [settings.fontFamily, fontSize, override?.fontWeight, settings.fontWeight],
  );

  if (!settings.enabled || visible.length === 0) return null;

  const y = (positionPct / 100) * height;
  const charWidth = fontSize * 0.55;
  const totalWidth = visible.reduce((sum, w) => sum + w.word.length * charWidth + charWidth * 0.35, 0);
  let x = frameWidth / 2 - totalWidth / 2;
  if (settings.textAlign === 'left') x = frameWidth * 0.05;
  if (settings.textAlign === 'right') x = frameWidth * 0.95 - totalWidth;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: frameWidth, height }]}>
      <Canvas style={{ width: frameWidth, height }}>
        <Group>
          {visible.map((w, index) => {
            const active = currentTime >= w.start && currentTime < w.end;
            const wordText = index === 0 ? w.word : ` ${w.word}`;
            const node = (
              <Text
                key={`${w.start}-${index}`}
                x={x}
                y={y}
                text={wordText}
                font={font}
                color={hexToSkiaColor(active ? highlightColor : textColor)}
              />
            );
            x += wordText.length * charWidth;
            return node;
          })}
        </Group>
      </Canvas>
    </View>
  );
}
