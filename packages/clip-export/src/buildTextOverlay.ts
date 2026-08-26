import type { ClipTextBoxState, TargetAspectRatio } from '@clippster/shared-types';

export interface TextOverlayExportInput {
  textBox: ClipTextBoxState;
  targetRatio: TargetAspectRatio;
  pngPath: string;
  width: number;
  height: number;
}

export function mergeTextBoxForRatio(state: ClipTextBoxState, ratio: string): ClipTextBoxState {
  const pr = state.perRatioConfigs?.[ratio];
  if (!pr?.position) return { ...state };
  return {
    ...state,
    positionX: pr.position.x,
    positionY: pr.position.y,
    widthPct: pr.style?.maxWidth ?? state.widthPct,
    style: { ...state.style, ...pr.style },
  };
}

export function buildTextOverlayFilterArgs(
  videoLabel: string,
  textInputIndex: number,
  textBox: ClipTextBoxState,
  frameWidth: number,
  frameHeight: number,
  outputLabel = 'texted',
): string {
  const posX = Math.round((textBox.positionX / 100) * frameWidth);
  const posY = Math.round((textBox.positionY / 100) * frameHeight);
  return `[${videoLabel}][${textInputIndex}:v]overlay=x=${posX}-(overlay_w/2):y=${posY}-(overlay_h/2):enable='between(t,${textBox.startTime},${textBox.endTime})'[${outputLabel}]`;
}

export interface TextOverlayRasterSpec {
  width: number;
  height: number;
  text: string;
  style: ClipTextBoxState['style'];
}

export function buildTextOverlayRasterSpec(
  textBox: ClipTextBoxState,
  frameWidth: number,
  frameHeight: number,
): TextOverlayRasterSpec {
  const boxWidth = Math.round((textBox.widthPct / 100) * frameWidth);
  const fontSize = Math.round((textBox.style.fontSize / 1080) * frameHeight);
  return {
    width: boxWidth,
    height: Math.round(fontSize * textBox.style.lineHeight * 2 + textBox.style.padding * 2),
    text: textBox.text,
    style: { ...textBox.style, fontSize },
  };
}
