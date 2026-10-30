import { invoke } from '@tauri-apps/api/core';
import { hyperframesRequest, type RequestOptions } from './hyperframesClient';

export interface BeatGrid {
  bpm: number | null;
  bpmConfidence: 'high' | 'low' | 'uncertain';
  beats: Array<{ time: number; strength: number }>;
}

export interface CheckFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  selector?: string;
  sourceFile?: string;
  time?: number;
  fixHint?: string;
}

interface CheckSection {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  findings: CheckFinding[];
}

export interface CheckReport {
  ok: boolean;
  lint: CheckSection;
  runtime: CheckSection;
  layout: CheckSection;
  contrast: CheckSection;
}

export type LintReport = CheckSection;

/** Typed access to one session's Hyperframes project directory through the sidecar. */
export class HyperframesWorkspace {
  private constructor(
    readonly projectDir: string,
    readonly gsapSrc: string,
    /** Project-relative font files (`assets/fonts/Family-Weight.ttf`), declared by the compiler. */
    readonly fonts: string[]
  ) {}

  static async open(sessionId: number): Promise<HyperframesWorkspace> {
    const projectDir = await invoke<string>('hyperframes_workspace_dir', { sessionId });
    const { gsapSrc, fonts } = await hyperframesRequest<{ gsapSrc: string; fonts: string[] }>(
      'initWorkspace',
      { projectDir }
    );
    return new HyperframesWorkspace(projectDir, gsapSrc, fonts);
  }

  linkMedia(items: Array<{ id: string; path: string }>) {
    return hyperframesRequest<{ linked: Array<{ id: string; src: string }> }>('linkMedia', {
      projectDir: this.projectDir,
      items,
    });
  }

  writeFile(path: string, content: string) {
    return hyperframesRequest<{ path: string; bytes: number }>('writeFile', {
      projectDir: this.projectDir,
      path,
      content,
    });
  }

  async readFile(path: string): Promise<string> {
    return (
      await hyperframesRequest<{ content: string }>('readFile', {
        projectDir: this.projectDir,
        path,
      })
    ).content;
  }

  deleteFile(path: string) {
    return hyperframesRequest('deleteFile', { projectDir: this.projectDir, path });
  }

  async listFiles(): Promise<string[]> {
    return (
      await hyperframesRequest<{ files: string[] }>('listFiles', { projectDir: this.projectDir })
    ).files;
  }

  async serve(): Promise<string> {
    return (await hyperframesRequest<{ url: string }>('serve', { projectDir: this.projectDir }))
      .url;
  }

  lint(options?: RequestOptions) {
    return hyperframesRequest<LintReport>('lint', { projectDir: this.projectDir }, options);
  }

  check(options?: RequestOptions) {
    return hyperframesRequest<CheckReport>(
      'check',
      { projectDir: this.projectDir, samples: 9 },
      options
    );
  }

  /** Stills at exact times; with `against`, also the reference frame at each time and a pair sheet. */
  snapshot(times: number[], outDir: string, against?: string, options?: RequestOptions) {
    return hyperframesRequest<{ outDir: string; files: string[] }>(
      'snapshot',
      { projectDir: this.projectDir, times, outDir, against },
      options
    );
  }

  render(
    outputPath: string,
    options: RequestOptions & { fps?: number; crf?: number; files?: Record<string, string> } = {}
  ) {
    const { fps, crf, files, ...request } = options;
    return hyperframesRequest<{
      outputPath: string;
      bytes: number;
      duration: number | null;
      warnings: string[];
    }>('render', { projectDir: this.projectDir, outputPath, fps, crf, files }, request);
  }
}

/** Beat grid for any audio or video file. */
export function detectBeats(
  audioPath: string,
  options: RequestOptions & { start?: number; duration?: number } = {}
) {
  const { start, duration, ...request } = options;
  return hyperframesRequest<BeatGrid>('beats', { audioPath, start, duration }, request);
}

/** Download the headless browser used for checks and rendering, if it isn't cached yet. */
export function ensureRenderBrowser(options?: RequestOptions) {
  return hyperframesRequest<{ path: string }>('ensureBrowser', {}, options);
}
