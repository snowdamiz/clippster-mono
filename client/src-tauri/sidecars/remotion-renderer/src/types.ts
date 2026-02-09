export interface RenderCommand {
  type: 'render' | 'cancel';
  renderId: string;
  composition?: any;
  outputPath?: string;
  codec?: 'h264' | 'h265';
  crf?: number;
}

export interface ProgressMessage {
  type: 'progress';
  renderId: string;
  progress: number;
}

export interface CompleteMessage {
  type: 'complete';
  renderId: string;
  outputPath: string;
}

export interface ErrorMessage {
  type: 'error';
  renderId: string;
  error: string;
}

export interface RenderOptions {
  renderId: string;
  composition: any;
  outputPath: string;
  codec: 'h264' | 'h265';
  crf: number;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
}
