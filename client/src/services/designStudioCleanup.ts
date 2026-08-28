/**
 * Full Design Studio project cleanup: local SQLite rows + editor-media/{id}/ on disk.
 * Mirrors Video Editor / ExportButton cleanup so deletes don't leave orphans.
 */
import { invoke } from "@tauri-apps/api/core";
import { storageService } from "@/editor/storage/tauri-storage-adapter";

export async function cleanupLocalDesignStudioProject(localProjectId: string): Promise<void> {
	const id = localProjectId?.trim();
	if (!id) return;

	try {
		await storageService.deleteProjectMedia({ projectId: id });
	} catch (err) {
		console.warn("[DesignStudio] Failed to delete local media asset rows:", id, err);
	}

	try {
		await storageService.deleteProject({ id });
	} catch (err) {
		console.warn("[DesignStudio] Failed to delete local project row:", id, err);
	}

	try {
		await invoke("delete_editor_project_media", { projectId: id });
	} catch (err) {
		console.warn("[DesignStudio] Failed to delete editor-media directory:", id, err);
	}
}
