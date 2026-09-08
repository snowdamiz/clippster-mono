import { requireNativeModule, NativeModule } from 'expo-modules-core';

import type { CapabilitySpec, PreviewQuality, SeekMode } from './types';

export type ClippsterEditorNativeEvents = {
  onTimeUpdate: (event: { timeSeconds: number; mode?: string }) => void;
  onExportProgress: (event: { progress: number; message?: string }) => void;
  onExportComplete: (event: { outputPaths: string[] }) => void;
  onExportError: (event: { message: string }) => void;
  onEngineError: (event: { message: string }) => void;
};

export type ClippsterEditorNativeModule = NativeModule<ClippsterEditorNativeEvents> & {
  ticksPerSecond?: number;
  getCapabilities(): Promise<CapabilitySpec[]>;
  loadRevision(documentJson: string): Promise<void>;
  applyRevision(documentJson: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(timeSeconds: number, mode: SeekMode): Promise<void>;
  setPreviewQuality(quality: PreviewQuality | string): Promise<void>;
  getCurrentTime(): Promise<number>;
  export(requestJson: string): Promise<{ outputPaths: string[] }>;
  cancelExport(): Promise<void>;
  generateProxy(sourceUri: string, destUri: string): Promise<string>;
  generateThumbnail(
    sourceUri: string,
    timeSeconds: number,
    destUri: string,
  ): Promise<string>;
  probeMedia(sourceUri: string): Promise<{
    width: number;
    height: number;
    duration: number;
    videoCodec: string;
    audioCodec: string | null;
  }>;
};

let cached: ClippsterEditorNativeModule | null | undefined;

export function getNativeEditorModule(): ClippsterEditorNativeModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireNativeModule<ClippsterEditorNativeModule>('ClippsterEditorNative');
  } catch {
    cached = null;
  }
  return cached;
}

export function isNativeEditorAvailable(): boolean {
  return getNativeEditorModule() != null;
}
