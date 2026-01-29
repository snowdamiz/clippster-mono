import { ref, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import { getVideoEditorProjectWithSources } from '@/services/database/video-editor-projects';

/**
 * Export configuration sent to the backend
 */
export interface ExportConfig {
  video_sources: Array<{
    source_path: string;
    start_time: number;
    end_time: number;
    trim_start: number;
    trim_end: number | null;
  }>;
  audio_tracks: Array<{
    file_path: string;
    start_time: number;
    end_time: number;
    volume: number;
    is_muted: boolean;
  }>;
  text_overlays: Array<{
    text: string;
    start_time: number;
    end_time: number;
    position_x: number;
    position_y: number;
    style_data: string;
  }>;
  output_path: string;
  total_duration: number;
  width: number;
  height: number;
}

/**
 * Options for useEditorExport
 */
export interface EditorExportOptions {
  /** Current project ID */
  projectId: Ref<string | null>;
  /** Current editor edit with all data */
  editorEdit: Ref<FullVideoEditorEdit | null>;
  /** Total timeline duration */
  duration: Ref<number>;
  /** Project title for default filename */
  title: Ref<string>;
}

/**
 * Return type for useEditorExport
 */
export interface EditorExportReturn {
  /** Whether export is in progress */
  isExporting: Ref<boolean>;
  /** Export progress (0-100) */
  exportProgress: Ref<number>;
  /** Build export configuration from current state */
  buildExportConfig: (outputPath: string) => Promise<ExportConfig>;
  /** Execute the export process */
  executeExport: () => Promise<void>;
  /** Prompt user for save location and export */
  exportWithDialog: () => Promise<void>;
}

/**
 * useEditorExport - Handle export configuration and execution
 *
 * Extracts export logic from ClipEditorDialog (lines 851-950)
 *
 * Export process:
 * 1. Prompt user for save location
 * 2. Get video metadata for dimensions
 * 3. Build export configuration from all tracks
 * 4. Execute export via Tauri backend
 *
 * Usage:
 * ```ts
 * const { isExporting, exportProgress, executeExport, exportWithDialog } = useEditorExport({
 *   projectId,
 *   editorEdit,
 *   duration,
 *   title: editorTitle
 * });
 *
 * // Export with dialog
 * await exportWithDialog();
 *
 * // Or build config manually
 * const config = await buildExportConfig('/path/to/output.mp4');
 * ```
 */
export function useEditorExport(options: EditorExportOptions): EditorExportReturn {
  const { projectId, editorEdit, duration, title } = options;

  const isExporting = ref(false);
  const exportProgress = ref(0);

  /**
   * Build export configuration from current state
   */
  async function buildExportConfig(outputPath: string): Promise<ExportConfig> {
    if (!projectId.value) {
      throw new Error('No project ID available');
    }

    if (!editorEdit.value) {
      throw new Error('No editor edit data available');
    }

    // Get project data with sources
    const projectData = await getVideoEditorProjectWithSources(projectId.value);
    if (!projectData || projectData.sources.length === 0) {
      throw new Error('No video sources to export');
    }

    // Get video metadata for dimensions
    const firstSource = projectData.sources[0];
    const metadata = await invoke<{ width: number; height: number; duration: number }>(
      'get_video_metadata',
      { videoPath: firstSource.source_path }
    );

    // Build export configuration
    const config: ExportConfig = {
      video_sources: projectData.sources.map((source) => ({
        source_path: source.source_path,
        start_time: source.start_time,
        end_time: source.end_time,
        trim_start: source.trim_start,
        trim_end: source.trim_end,
      })),
      audio_tracks: (editorEdit.value.audioTracks || []).map((track) => ({
        file_path: track.file_path,
        start_time: track.start_time,
        end_time: track.end_time,
        volume: track.volume,
        is_muted: track.is_muted === 1,
      })),
      text_overlays: (editorEdit.value.textOverlays || []).map((text) => ({
        text: text.text,
        start_time: text.start_time,
        end_time: text.end_time,
        position_x: text.position_x,
        position_y: text.position_y,
        style_data: text.style_data,
      })),
      output_path: outputPath,
      total_duration: duration.value,
      width: metadata.width,
      height: metadata.height,
    };

    return config;
  }

  /**
   * Execute the export process with a given config
   */
  async function executeExport(): Promise<void> {
    if (!projectId.value || !editorEdit.value) {
      throw new Error('Missing project or edit data');
    }

    // Get project data with sources
    const projectData = await getVideoEditorProjectWithSources(projectId.value);
    if (!projectData || projectData.sources.length === 0) {
      throw new Error('No video sources to export');
    }

    // Prompt user for save location
    const savePath = await save({
      defaultPath: `${title.value}.mp4`,
      filters: [
        {
          name: 'Video',
          extensions: ['mp4'],
        },
      ],
    });

    if (!savePath) {
      // User cancelled
      return;
    }

    console.log('[useEditorExport] Exporting to:', savePath);

    try {
      isExporting.value = true;
      exportProgress.value = 10;

      // Build export config
      const config = await buildExportConfig(savePath);

      console.log('[useEditorExport] Export config:', config);
      exportProgress.value = 30;

      // Execute export
      await invoke('export_video_editor_project', { config });

      exportProgress.value = 100;
      console.log('[useEditorExport] Export completed successfully');

      // Show success message
      alert(`Video exported successfully to:\n${savePath}`);
    } finally {
      isExporting.value = false;
      exportProgress.value = 0;
    }
  }

  /**
   * Export with dialog (alias for executeExport for clarity)
   */
  async function exportWithDialog(): Promise<void> {
    if (!projectId.value || !editorEdit.value) {
      console.warn('[useEditorExport] Cannot export: missing project or edit data');
      return;
    }

    console.log('[useEditorExport] Starting export for project:', projectId.value);

    try {
      await executeExport();
    } catch (error) {
      console.error('[useEditorExport] Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    isExporting,
    exportProgress,
    buildExportConfig,
    executeExport,
    exportWithDialog,
  };
}
