import { Image } from 'expo-image';
import { requireNativeModule } from 'expo-modules-core';

let cached: typeof Image | null | undefined;

/** True only when the native ExpoImage module is linked (requires dev rebuild). */
export function getExpoImage(): typeof Image | null {
  if (cached !== undefined) return cached;
  try {
    requireNativeModule('ExpoImage');
    cached = Image;
  } catch {
    cached = null;
  }
  return cached;
}
