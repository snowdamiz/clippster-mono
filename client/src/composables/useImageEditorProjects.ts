import { ref, computed } from 'vue';
import type { ImageEditorProject, ProjectSummary } from '@/services/imageEditorApi';
import * as projectApi from '@/services/imageEditorApi';
import { resolveLocalProjectId } from '@/editor/bridge/image-project-document';
import { cleanupLocalDesignStudioProject } from '@/services/designStudioCleanup';

export function useImageEditorProjects() {
  const project = ref<ImageEditorProject | null>(null);
  const projects = ref<ProjectSummary[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const projectId = computed(() => project.value?.id ?? null);
  const projectName = computed(() => project.value?.name ?? 'Untitled Design');

  async function listProjects(): Promise<ProjectSummary[]> {
    try {
      const list = await projectApi.listProjects();
      projects.value = list;
      return list;
    } catch (e: any) {
      console.warn('[useImageEditorProjects] Failed to list projects:', e);
      return [];
    }
  }

  async function createProject(data: {
    name: string;
    project_data: any;
    thumbnail_url?: string;
    canvas_width?: number;
    canvas_height?: number;
  }) {
    isLoading.value = true;
    error.value = null;
    try {
      const created = await projectApi.createProject(data);
      project.value = created;
      return created;
    } catch (e: any) {
      error.value = e.message || 'Failed to create project';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadProject(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      const loaded = await projectApi.getProject(id);
      project.value = loaded;
      return loaded;
    } catch (e: any) {
      error.value = e.message || 'Failed to load project';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveProject(updates: {
    name?: string;
    project_data?: any;
    thumbnail_url?: string;
    canvas_width?: number;
    canvas_height?: number;
  }) {
    if (!project.value) throw new Error('No active project');
    
    isLoading.value = true;
    error.value = null;
    try {
      const updated = await projectApi.updateProject(project.value.id, updates);
      project.value = updated;
      return updated;
    } catch (e: any) {
      error.value = e.message || 'Failed to save project';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteProject(id: number) {
    try {
      // Fetch full project so we can clean local UUID + editor-media before/after API delete
      let localId: string | null = null;
      try {
        const full = await projectApi.getProject(id);
        localId = resolveLocalProjectId(full.project_data);
      } catch (e) {
        console.warn('[useImageEditorProjects] Could not load project before delete:', e);
      }

      await projectApi.deleteProject(id);

      if (localId) {
        await cleanupLocalDesignStudioProject(localId);
      }

      if (project.value?.id === id) {
        project.value = null;
      }
      projects.value = projects.value.filter(p => p.id !== id);
    } catch (e: any) {
      error.value = e.message || 'Failed to delete project';
      throw e;
    }
  }

  async function renameProject(id: number, name: string) {
    try {
      const updated = await projectApi.updateProject(id, { name });
      if (project.value?.id === id) {
        project.value = updated;
      }
      const idx = projects.value.findIndex(p => p.id === id);
      if (idx !== -1) {
        projects.value[idx] = { ...projects.value[idx], name };
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to rename project';
      throw e;
    }
  }

  function closeProject() {
    project.value = null;
    error.value = null;
  }

  function clearError() {
    error.value = null;
  }

  return {
    project,
    projects,
    isLoading,
    error,
    projectId,
    projectName,
    listProjects,
    createProject,
    loadProject,
    saveProject,
    deleteProject,
    renameProject,
    closeProject,
    clearError,
  };
}
