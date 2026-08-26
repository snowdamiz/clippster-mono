import type { ClipTextBoxState } from '@clippster/shared-types';
import type { TargetAspectRatio } from '@clippster/shared-types';
import { Canvas } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { createTextPillSkiaElement } from '@/lib/skiaTextPill';

interface TextBoxOverlayProps {
  state: ClipTextBoxState;
  currentTime: number;
  targetRatio?: TargetAspectRatio;
  ignoreTiming?: boolean;
  frameWidth: number;
  frameHeight?: number;
  onPositionChange?: (x: number, y: number) => void;
}

export function TextBoxOverlay({
  state,
  currentTime,
  targetRatio = '9:16',
  ignoreTiming = false,
  frameWidth,
  frameHeight,
  onPositionChange,
}: TextBoxOverlayProps) {
  const [ratioW, ratioH] = targetRatio.split(':').map(Number);
  const height = frameHeight ?? frameWidth / ((ratioW || 9) / (ratioH || 16));
  const previewScale = frameWidth / 1080;

  const element = useMemo(
    () => createTextPillSkiaElement(state, targetRatio, { previewScale }),
    [state, targetRatio, previewScale],
  );

  if (!state.enabled) return null;
  if (!ignoreTiming && (currentTime < state.startTime || currentTime > state.endTime)) {
    return null;
  }

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !!onPositionChange,
    onPanResponderMove: (_, gs) => {
      if (!onPositionChange) return;
      const newX = Math.max(0, Math.min(100, state.positionX + (gs.dx / frameWidth) * 100));
      const newY = Math.max(0, Math.min(100, state.positionY + (gs.dy / height) * 100));
      onPositionChange(newX, newY);
    },
  });

  return (
    <View
      {...(onPositionChange ? pan.panHandlers : {})}
      pointerEvents={onPositionChange ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { width: frameWidth, height }]}
    >
      <Canvas style={{ width: frameWidth, height }}>{element}</Canvas>
    </View>
  );
}
