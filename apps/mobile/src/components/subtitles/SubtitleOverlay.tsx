import type { SubtitleSettings, WordInfo } from '@clippster/shared-types';
import { Canvas, Group, RoundedRect, Shadow, Text, matchFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { hexToSkiaColor } from '@/lib/skiaColors';
import {
  getVisibleWordsAtTime,
  maxWordsChunkForAspectRatioString,
} from '@/lib/subtitleVisibleWords';

export const SAMPLE_CAPTION_WORDS: WordInfo[] = [
  { word: 'SAMPLE', start: 0, end: 1_000_000 },
  { word: 'TEXT', start: 0, end: 1_000_000 },
];

interface SubtitleOverlayProps {
  settings: SubtitleSettings;
  words: WordInfo[];
  currentTime: number;
  targetRatio: string;
  frameWidth?: number;
  frameHeight?: number;
  sampleFallback?: boolean;
}

function fontWeightToSkia(weight: number): 'normal' | 'bold' | '600' | '700' | '800' | '900' {
  if (weight >= 800) return '800';
  if (weight >= 700) return 'bold';
  if (weight >= 600) return '600';
  return 'normal';
}

function resolveFontFamily(family: string): string {
  if (family.includes('Bebas')) {
    return Platform.OS === 'android' ? 'sans-serif-condensed' : 'System';
  }
  if (family.includes('Roboto')) {
    return Platform.OS === 'android' ? 'sans-serif' : 'System';
  }
  return Platform.OS === 'android' ? 'sans-serif' : 'System';
}

const STROKE_OFFSETS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export function SubtitleOverlay({
  settings,
  words,
  currentTime,
  targetRatio,
  frameWidth = 360,
  frameHeight,
  sampleFallback = false,
}: SubtitleOverlayProps) {
  const [ratioW, ratioH] = targetRatio.split(':').map(Number);
  const height = frameHeight ?? frameWidth / ((ratioW || 16) / (ratioH || 9));
  const previewScale = frameWidth / 1080;

  const override = settings.perRatioConfigs?.[targetRatio];
  const positionPct = override?.positionPercentage ?? settings.positionPercentage;
  const fontSize = (override?.fontSize ?? settings.fontSize) * previewScale;
  const textColor = override?.textColor ?? settings.textColor;
  const highlightColor = override?.highlightColor ?? settings.highlightColor;
  const strokeWidth = override?.border2Width ?? settings.border2Width;
  const strokeColor = override?.border2Color ?? settings.border2Color;

  const maxWords = maxWordsChunkForAspectRatioString(targetRatio, settings.animationStyle);
  const sourceWords = words.length > 0 ? words : sampleFallback ? SAMPLE_CAPTION_WORDS : [];
  const visible = useMemo(
    () => getVisibleWordsAtTime(sourceWords, currentTime, maxWords),
    [sourceWords, currentTime, maxWords],
  );

  const font = useMemo(
    () =>
      matchFont({
        fontFamily: resolveFontFamily(override?.fontFamily ?? settings.fontFamily),
        fontSize,
        fontWeight: fontWeightToSkia(override?.fontWeight ?? settings.fontWeight),
      }),
    [settings.fontFamily, override?.fontFamily, fontSize, override?.fontWeight, settings.fontWeight],
  );

  if (!settings.enabled || visible.length === 0) return null;

  const y = (positionPct / 100) * height;
  const charWidth = fontSize * 0.58;
  const gap = fontSize * (settings.wordSpacing || 0.35);
  const totalWidth = visible.reduce(
    (sum, word, index) => sum + word.word.length * charWidth + (index > 0 ? gap : 0),
    0,
  );
  let x = frameWidth / 2 - totalWidth / 2;
  if (settings.textAlign === 'left') x = frameWidth * 0.06;
  if (settings.textAlign === 'right') x = frameWidth * 0.94 - totalWidth;

  const padX = settings.backgroundEnabled ? Math.max(settings.padding, 8) * previewScale : 0;
  const padY = settings.backgroundEnabled ? Math.max(settings.padding, 6) * previewScale : 0;
  const boxX = x - padX;
  const boxY = y - fontSize - padY * 0.2;
  const boxW = totalWidth + padX * 2;
  const boxH = fontSize * (settings.lineHeight || 1.2) + padY;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: frameWidth, height }]}>
      <Canvas style={{ width: frameWidth, height }}>
        <Group>
          {settings.backgroundEnabled ? (
            <RoundedRect
              x={boxX}
              y={boxY}
              width={boxW}
              height={boxH}
              r={settings.borderRadius || 4}
              color={hexToSkiaColor(settings.backgroundColor)}
            />
          ) : null}
          {visible.flatMap((word, index) => {
            const active = currentTime >= word.start && currentTime < word.end;
            const wordX = x + (index > 0 ? gap : 0);
            const color = hexToSkiaColor(active ? highlightColor : textColor);
            const nodes = [];
            if (strokeWidth > 0) {
              const offset = Math.max(1, strokeWidth * previewScale * 0.45);
              for (const [dx, dy] of STROKE_OFFSETS) {
                nodes.push(
                  <Text
                    key={`${word.start}-${index}-s-${dx}-${dy}`}
                    x={wordX + dx * offset}
                    y={y + dy * offset}
                    text={word.word}
                    font={font}
                    color={hexToSkiaColor(strokeColor)}
                  />,
                );
              }
            }
            nodes.push(
              <Text
                key={`${word.start}-${index}`}
                x={wordX}
                y={y}
                text={word.word}
                font={font}
                color={color}
              >
                {settings.shadowBlur > 0 || settings.animationStyle === 'glow' ? (
                  <Shadow
                    dx={settings.shadowOffsetX}
                    dy={settings.shadowOffsetY}
                    blur={Math.max(settings.shadowBlur, 8)}
                    color={hexToSkiaColor(settings.shadowColor || highlightColor)}
                  />
                ) : null}
              </Text>,
            );
            x = wordX + word.word.length * charWidth;
            return nodes;
          })}
        </Group>
      </Canvas>
    </View>
  );
}
