import { type Ref } from 'vue';
import { updateProject } from '@/services/database/projects';

/**
 * Options for the title management composable
 */
export interface TitleManagementOptions {
  /** The current project ID */
  projectId: Ref<string | null>;
  /** The editor title ref to update */
  editorTitle: Ref<string>;
}

/**
 * Return type for the title management composable
 */
export interface TitleManagementReturn {
  /** Update the title locally and persist to database */
  updateTitle: (newTitle: string) => Promise<void>;
}

/**
 * Composable for managing editor title
 *
 * Extracts the title update logic from ClipEditorDialog.vue into a focused,
 * testable composable. Handles:
 * - Updating the local title state
 * - Persisting the title to the database
 * - Error handling for failed updates
 *
 * @example
 * ```ts
 * const { updateTitle } = useTitleManagement({
 *   projectId,
 *   editorTitle,
 * });
 *
 * // Update title from user input
 * await updateTitle('My New Title');
 * ```
 */
export function useTitleManagement(options: TitleManagementOptions): TitleManagementReturn {
  const { projectId, editorTitle } = options;

  /**
   * Update the title locally and persist to database
   */
  async function updateTitle(newTitle: string): Promise<void> {
    // Update local state immediately for responsiveness
    editorTitle.value = newTitle;

    // Persist to database if we have a project ID
    if (projectId.value) {
      try {
        await updateProject(projectId.value, newTitle);
        console.log('[useTitleManagement] Project title updated:', newTitle);
      } catch (error) {
        console.error('[useTitleManagement] Failed to update project title:', error);
      }
    }
  }

  return {
    updateTitle,
  };
}
