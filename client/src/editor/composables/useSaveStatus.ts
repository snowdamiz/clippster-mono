import { computed, onMounted, onUnmounted, shallowRef } from "vue";
import { EditorCore } from "../core";

export function useSaveStatus() {
	const save = EditorCore.getInstance().save;
	const state = shallowRef(save.getState());
	let unsubscribe: (() => void) | null = null;

	onMounted(() => {
		unsubscribe = save.subscribe(() => {
			state.value = save.getState();
		});
	});

	onUnmounted(() => {
		unsubscribe?.();
		unsubscribe = null;
	});

	return {
		isDirty: computed(() => state.value.isDirty),
		isSaving: computed(() => state.value.isSaving),
		lastSavedAt: computed(() => state.value.lastSavedAt),
		error: computed(() => state.value.error),
	};
}
