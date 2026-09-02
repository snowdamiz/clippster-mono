import type { ClipTextBoxState, TargetAspectRatio } from '@clippster/shared-types';
import { mergeTextBoxForRatio } from '@clippster/clip-export';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';
import { ImageFormat, drawAsImage } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { createTextPillSkiaElement } from '@/lib/skiaTextPill';

export async function renderTextOverlayPng(
  state: ClipTextBoxState,
  targetRatio: TargetAspectRatio,
  outputPath: string,
): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Text overlay PNG export requires a native build');
  }

  const merged = mergeTextBoxForRatio(state, targetRatio);
  const dims = TARGET_DIMENSIONS[targetRatio];
  const element = createTextPillSkiaElement(merged, targetRatio);

  const image = await drawAsImage(element, { width: dims.width, height: dims.height });
  if (!image) {
    throw new Error('Failed to rasterize text overlay');
  }

  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  await FileSystem.writeAsStringAsync(outputPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(outputPath);
  if (!info.exists) {
    throw new Error('Text overlay PNG was not written to disk');
  }

  return outputPath;
}

export function getTextOverlayPngPath(
  exportDir: string,
  clipId: string,
  ratio: TargetAspectRatio,
): string {
  return `${exportDir}${clipId}_text_${ratio.replace(':', 'x')}.png`;
}

export { layoutTextPill } from '@/lib/skiaTextPill';
