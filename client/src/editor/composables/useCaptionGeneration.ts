import { ref } from "vue";

/**
 * Shared caption-generation status.
 * Module-level so it survives CaptionsView remounts when switching asset tabs
 * (AssetsPanel uses v-if / v-else-if per tab).
 */
const isProcessing = ref(false);
const processingStep = ref("");
const error = ref<string | null>(null);

export function useCaptionGeneration() {
	return {
		isProcessing,
		processingStep,
		error,
	};
}
