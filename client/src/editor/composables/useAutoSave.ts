/**
 * Auto-save composable for the editor.
 * Saves the current project every 30 seconds if there are unsaved changes.
 */
import { ref, onMounted, onUnmounted } from "vue";
import { useEditor } from "./useEditor";

const AUTO_SAVE_INTERVAL_MS = 30_000;

export function useAutoSave() {
	const { editor, version } = useEditor();
	const lastSavedVersion = ref(0);
	const isSaving = ref(false);
	const lastSavedAt = ref<Date | null>(null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	async function save() {
		const currentVersion = version.value;
		if (currentVersion === lastSavedVersion.value) return;
		if (isSaving.value) return;
		if (!editor.project.getActiveOrNull()) return;

		isSaving.value = true;
		try {
			await editor.project.saveCurrentProject();
			lastSavedVersion.value = currentVersion;
			lastSavedAt.value = new Date();
		} catch (error) {
			console.error("[AutoSave] Failed to save:", error);
		} finally {
			isSaving.value = false;
		}
	}

	onMounted(() => {
		lastSavedVersion.value = version.value;
		intervalId = setInterval(save, AUTO_SAVE_INTERVAL_MS);
	});

	onUnmounted(() => {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	});

	return {
		isSaving,
		lastSavedAt,
	};
}
