import type { ClipTextBoxState, TextOverlayStyle } from '@clippster/shared-types';
import { TARGET_DIMENSIONS, type TargetAspectRatio } from '@clippster/shared-types';
import { Group, RoundedRect, Text, matchFont } from '@shopify/react-native-skia';
import { createElement } from 'react';

import { hexToSkiaColor } from './skiaColors';

export interface TextPillLayout {
  frameWidth: number;
  frameHeight: number;
  boxWidth: number;
  boxHeight: number;
  boxX: number;
  boxY: number;
  fontSize: number;
  displayText: string;
}

export function layoutTextPill(
  state: ClipTextBoxState,
  targetRatio: TargetAspectRatio,
): TextPillLayout {
  const dims = TARGET_DIMENSIONS[targetRatio];
  const frameWidth = dims.width;
  const frameHeight = dims.height;
  const scale = frameHeight / (state.previewHeight ?? 1080);
  const fontSize = Math.max(12, Math.round(state.style.fontSize * scale));
  const padding = Math.round(state.style.padding * scale);
  const boxWidth = Math.round((state.widthPct / 100) * frameWidth);
  const lineHeight = state.style.lineHeight ?? 1.2;
  const lines = state.text.split('\n').length;
  const boxHeight = Math.round(fontSize * lineHeight * Math.max(1, lines) + padding * 2);

  const centerX = (state.positionX / 100) * frameWidth;
  const centerY = (state.positionY / 100) * frameHeight;

  let displayText = state.text;
  if (state.style.textTransform === 'uppercase') displayText = displayText.toUpperCase();
  else if (state.style.textTransform === 'lowercase') displayText = displayText.toLowerCase();

  return {
    frameWidth,
    frameHeight,
    boxWidth,
    boxHeight,
    boxX: centerX - boxWidth / 2,
    boxY: centerY - boxHeight / 2,
    fontSize,
    displayText,
  };
}

function fontWeightToSkia(weight: number): 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' {
  if (weight >= 700) return 'bold';
  if (weight >= 600) return '600';
  if (weight >= 500) return '500';
  return 'normal';
}

export function createTextPillSkiaElement(
  state: ClipTextBoxState,
  targetRatio: TargetAspectRatio,
  options?: { previewScale?: number },
) {
  const layout = layoutTextPill(state, targetRatio);
  const previewScale = options?.previewScale ?? 1;
  const fw = layout.frameWidth * previewScale;
  const fh = layout.frameHeight * previewScale;
  const fontSize = layout.fontSize * previewScale;
  const boxW = layout.boxWidth * previewScale;
  const boxH = layout.boxHeight * previewScale;
  const boxX = layout.boxX * previewScale;
  const boxY = layout.boxY * previewScale;
  const padding = Math.round(state.style.padding * (fh / layout.frameHeight));
  const radius = Math.round(state.style.borderRadius * previewScale);

  const font = matchFont({
    fontFamily: state.style.fontFamily || 'System',
    fontSize,
    fontWeight: fontWeightToSkia(state.style.fontWeight),
  });

  const style = state.style as TextOverlayStyle;
  const children = [];

  if (style.backgroundEnabled && style.backgroundColor) {
    children.push(
      createElement(RoundedRect, {
        key: 'bg',
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        r: radius,
        color: hexToSkiaColor(style.backgroundColor ?? '#FFFFFF'),
      }),
    );
  }

  const textX =
    style.textAlign === 'center'
      ? boxX + boxW / 2
      : style.textAlign === 'right'
        ? boxX + boxW - padding
        : boxX + padding;

  children.push(
    createElement(Text, {
      key: 'text',
      x: textX,
      y: boxY + padding + fontSize * 0.85,
      text: layout.displayText,
      font,
      color: hexToSkiaColor(style.color),
    }),
  );

  return createElement(Group, { key: 'pill' }, children);
}
