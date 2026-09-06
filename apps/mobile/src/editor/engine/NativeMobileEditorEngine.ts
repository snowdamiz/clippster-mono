import {
  getNativeEditorModule,
  isNativeEditorAvailable,
  type CapabilitySpec,
  type ExportRequest as NativeExportRequest,
  type PreviewQuality as NativePreviewQuality,
} from '@clippster/editor-native';
import type { TargetAspectRatio } from '@clippster/shared-types';
import { EventEmitter } from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';

import type { MobileEditProjectV3 } from '../model/schema';
import { ticksToSeconds } from '../model/schema';
import { getVideoTrack } from '../model/timeline';
import type {
  EditorChangeSet,
  EditorTime,
  ExportJob,
  ExportRequest,
  MobileEditorEngine,
  PreviewQuality,
} from './MobileEditorEngine';

export type {
  EditorChangeSet,
  EditorTime,
  ExportJob,
  ExportRequest,
  MobileEditorEngine,
  PreviewQuality,
} from './MobileEditorEngine';

type TimeListener = (timeSeconds: number) => void;
type ProgressListener = (progress: number, message?: string) => void;

type EngineEmitter = {
  addListener: (
    event: string,
    listener: (payload: Record<string, unknown>) => void,
  ) => { remove: () => void };
};

function mapQuality(quality: PreviewQuality): NativePreviewQuality {
  switch (quality) {
    case 'proxy':
      return 'low';
    case 'balanced':
      return 'medium';
    case 'full':
      return 'full';
    default:
      return 'auto';
  }
}

export class NativeMobileEditorEngine implements MobileEditorEngine {
  private document: MobileEditProjectV3 | null = null;
  private capabilities: CapabilitySpec[] = [];
  private timeListeners = new Set<TimeListener>();
  private progressListeners = new Set<ProgressListener>();
  private removeTimeSub: (() => void) | null = null;
  private removeProgressSub: (() => void) | null = null;
  private removeCompleteSub: (() => void) | null = null;
  private removeErrorSub: (() => void) | null = null;

  static isAvailable(): boolean {
    return isNativeEditorAvailable();
  }

  private module() {
    const native = getNativeEditorModule();
    if (!native) {
      throw new Error(
        'Native editor engine unavailable. Rebuild the dev client after installing @clippster/editor-native.',
      );
    }
    return native;
  }

  async load(project: MobileEditProjectV3): Promise<void> {
    const native = this.module();
    this.bindEvents(native);
    this.document = project;
    this.capabilities = await native.getCapabilities();
    await native.loadRevision(JSON.stringify(project));
  }

  async apply(change: EditorChangeSet): Promise<void> {
    this.document = change.document;
    await this.module().applyRevision(JSON.stringify(change.document));
  }

  play(): void {
    void this.module().play();
  }

  pause(): void {
    void this.module().pause();
  }

  async seek(time: EditorTime, mode: 'interactive' | 'precise'): Promise<void> {
    await this.module().seek(time, mode);
  }

  setPreviewQuality(quality: PreviewQuality): void {
    void this.module().setPreviewQuality(mapQuality(quality));
  }

  async export(request: ExportRequest): Promise<ExportJob> {
    const document = this.document;
    if (!document) throw new Error('Load a project before exporting');
    const exportDir =
      request.outputDirectory ?? `${FileSystem.documentDirectory}exports/`;
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

    const outputs: string[] = [];
    for (const ratio of request.ratios) {
      const canvas = document.canvas.outputByRatio[ratio];
      const stamp = Date.now();
      const outputPath = `${exportDir}${document.targetId}_${ratio.replace(':', 'x')}_${stamp}.mp4`;
      const documentForRatio: MobileEditProjectV3 = {
        ...document,
        canvas: { ...document.canvas, activeRatio: ratio },
      };
      const payload = {
        ratios: [ratio] as TargetAspectRatio[],
        documentJson: JSON.stringify(documentForRatio),
        sceneJson: JSON.stringify(documentForRatio),
        outputPath,
        ratio,
        width: canvas.width,
        height: canvas.height,
        fps: canvas.fps,
        outputDirectory: exportDir,
      } satisfies NativeExportRequest & Record<string, unknown>;
      const result = await this.module().export(JSON.stringify(payload));
      const paths = Array.isArray(result.outputPaths)
        ? result.outputPaths
        : [outputPath];
      outputs.push(...paths);
    }
    return { outputPaths: outputs };
  }

  async cancelExport(): Promise<void> {
    await this.module().cancelExport();
  }

  async generateProxy(sourceUri: string, destUri: string): Promise<string> {
    return this.module().generateProxy(sourceUri, destUri);
  }

  async generateThumbnail(
    sourceUri: string,
    timeSeconds: number,
    destUri: string,
  ): Promise<string> {
    return this.module().generateThumbnail(sourceUri, timeSeconds, destUri);
  }

  getVisibleCapabilityIds(): string[] {
    return this.capabilities
      .filter(
        (spec) =>
          spec.hasGraphNode &&
          spec.hasAndroidRenderer &&
          spec.hasIosRenderer &&
          spec.hasExport &&
          spec.hasValidation &&
          spec.hasGoldenFixture,
      )
      .map((spec) => spec.id);
  }

  getCapabilities(): CapabilitySpec[] {
    return this.capabilities;
  }

  onTimeUpdate(listener: TimeListener): () => void {
    this.timeListeners.add(listener);
    return () => this.timeListeners.delete(listener);
  }

  onExportProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  primarySourceUri(): string | null {
    if (!this.document) return null;
    const item = getVideoTrack(this.document).items[0];
    if (!item) return null;
    const asset = this.document.assets[item.assetId];
    return asset?.proxy?.uri ?? asset?.sourceUri ?? null;
  }

  documentPlayheadSeconds(tick: number): number {
    return ticksToSeconds(tick);
  }

  async dispose(): Promise<void> {
    this.pause();
    this.removeTimeSub?.();
    this.removeProgressSub?.();
    this.removeCompleteSub?.();
    this.removeErrorSub?.();
    this.removeTimeSub = null;
    this.removeProgressSub = null;
    this.removeCompleteSub = null;
    this.removeErrorSub = null;
    this.timeListeners.clear();
    this.progressListeners.clear();
    this.document = null;
  }

  private bindEvents(native: NonNullable<ReturnType<typeof getNativeEditorModule>>) {
    this.removeTimeSub?.();
    this.removeProgressSub?.();
    this.removeCompleteSub?.();
    this.removeErrorSub?.();
    const emitter = new EventEmitter(native as never) as EngineEmitter;
    this.removeTimeSub = emitter.addListener('onTimeUpdate', (event) => {
      const timeSeconds = Number(event.timeSeconds ?? 0);
      for (const listener of this.timeListeners) listener(timeSeconds);
    }).remove;
    this.removeProgressSub = emitter.addListener('onExportProgress', (event) => {
      const progress = Number(event.progress ?? 0);
      const message = typeof event.message === 'string' ? event.message : undefined;
      for (const listener of this.progressListeners) listener(progress, message);
    }).remove;
    this.removeCompleteSub = emitter.addListener('onExportComplete', () => undefined).remove;
    this.removeErrorSub = emitter.addListener('onEngineError', (event) => {
      const message = typeof event.message === 'string' ? event.message : 'Engine error';
      console.error('[ClippsterEditorNative]', message);
    }).remove;
  }
}

export function createMobileEditorEngine(): NativeMobileEditorEngine {
  return new NativeMobileEditorEngine();
}
