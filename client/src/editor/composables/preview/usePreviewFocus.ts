import { ref } from "vue";

// Module-level singleton — shared across all uses of this module
const _previewFocused = ref(false);

export function usePreviewFocus() {
	return {
		previewFocused: _previewFocused,
		setPreviewFocused: (v: boolean) => {
			_previewFocused.value = v;
		},
	};
}
