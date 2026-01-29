import { ref, type Ref } from 'vue';
import {
  getFullVideoEditorEdit,
  getOrCreateVideoEditorEdit,
  type FullVideoEditorEdit,
} from '@/services/database/video-editor-edits';
import { getProject } from '@/services/database/projects';

/**
 * Options for the editor data loader composable
 */
export interface EditorDataLoaderOptions {
  /** Fallback title from props (e.g., clipTitle) */
  fallbackTitle?: string;
  /** Another fallback title from props (e.g., editorProjectName) */
  secondaryFallbackTitle?: string;
}

/**
 * Return type for the editor data loader composable
 */
export interface EditorDataLoaderReturn {
  /** The current edit ID */
  editId: Ref<string | null>;
  /** The full editor edit data */
  editorEdit: Ref<FullVideoEditorEdit | null>;
  /** The current project ID */
  projectId: Ref<string | null>;
  /** The editor title */
  editorTitle: Ref<string>;
  /** Whether data is currently loading */
  isLoading: Ref<boolean>;
  /** Load editor data for a given project ID */
  loadEditorData: (editorProjectId: string | null | undefined) => Promise<void>;
  /** Reset all state */
  reset: () => void;
}

/**
 * Composable for loading and managing editor data
 *
 * Extracts the data loading logic from ClipEditorDialog.vue into a focused,
 * testable composable. Handles:
 * - Loading project data from the database
 * - Creating or fetching video editor edits
 * - Managing editor state (editId, editorEdit, projectId, title)
 *
 * @example
 * ```ts
 * const { editId, editorEdit, projectId, editorTitle, loadEditorData } = useEditorDataLoader({
 *   fallbackTitle: props.clipTitle,
 *   secondaryFallbackTitle: props.editorProjectName,
 * });
 *
 * // Load data when project ID changes
 * await loadEditorData(props.editorProjectId);
 * ```
 */
export function useEditorDataLoader(
  options: EditorDataLoaderOptions = {}
): EditorDataLoaderReturn {
  const { fallbackTitle, secondaryFallbackTitle } = options;

  // State
  const editId = ref<string | null>(null);
  const editorEdit = ref<FullVideoEditorEdit | null>(null);
  const projectId = ref<string | null>(null);
  const editorTitle = ref<string>('Untitled Clip');
  const isLoading = ref(false);

  /**
   * Load editor data for a given project ID
   */
  async function loadEditorData(editorProjectId: string | null | undefined): Promise<void> {
    if (!editorProjectId) {
      console.log('[useEditorDataLoader] No project ID provided');
      return;
    }

    isLoading.value = true;

    try {
      console.log(`[useEditorDataLoader] Loading video editor project: ${editorProjectId}`);

      projectId.value = editorProjectId;

      // Load project to get the name/title (always use database as source of truth)
      const project = await getProject(editorProjectId);
      if (project && project.name) {
        editorTitle.value = project.name;
      } else if (fallbackTitle) {
        editorTitle.value = fallbackTitle;
      } else if (secondaryFallbackTitle) {
        editorTitle.value = secondaryFallbackTitle;
      } else {
        editorTitle.value = 'Untitled Clip';
      }

      // Get or create video editor edit
      const editRecord = await getOrCreateVideoEditorEdit(editorProjectId);
      editId.value = editRecord.id;

      // Load full edit with all related data
      const fullEdit = await getFullVideoEditorEdit(editorProjectId);
      if (fullEdit) {
        editorEdit.value = fullEdit;
        console.log('[useEditorDataLoader] Editor data loaded:', {
          audioTracks: fullEdit.audioTracks.length,
          textOverlays: fullEdit.textOverlays.length,
          stickers: fullEdit.stickers.length,
          watermarks: fullEdit.watermarks.length,
          effects: fullEdit.effects.length,
        });
      }
    } catch (error) {
      console.error('[useEditorDataLoader] Failed to load editor data:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Reset all state to initial values
   */
  function reset(): void {
    editId.value = null;
    editorEdit.value = null;
    projectId.value = null;
    editorTitle.value = 'Untitled Clip';
    isLoading.value = false;
  }

  return {
    editId,
    editorEdit,
    projectId,
    editorTitle,
    isLoading,
    loadEditorData,
    reset,
  };
}
