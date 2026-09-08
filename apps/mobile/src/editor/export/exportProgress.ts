export type EditorExportState = 'idle' | 'building' | 'complete' | 'error';

export interface EditorExportProgress {
  state: EditorExportState;
  progress: number;
  message: string;
  error?: string;
  outputPaths?: string[];
  buildIds?: string[];
}
