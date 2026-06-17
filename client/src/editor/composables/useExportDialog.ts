import { ref } from "vue";

export interface ExportDialogTimeRange {
	startTime: number;
	endTime: number;
}

const isOpen = ref(false);
const exportTimeRange = ref<ExportDialogTimeRange | null>(null);
const exportSegmentName = ref<string | null>(null);

export function useExportDialog() {
	function openExportDialog(options?: {
		timeRange?: ExportDialogTimeRange;
		segmentName?: string;
	}) {
		exportTimeRange.value = options?.timeRange ?? null;
		exportSegmentName.value = options?.segmentName ?? null;
		isOpen.value = true;
	}

	function closeExportDialog() {
		isOpen.value = false;
		exportTimeRange.value = null;
		exportSegmentName.value = null;
	}

	return {
		isOpen,
		exportTimeRange,
		exportSegmentName,
		openExportDialog,
		closeExportDialog,
	};
}
