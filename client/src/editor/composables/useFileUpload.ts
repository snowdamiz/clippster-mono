/**
 * Vue composable equivalent of OpenCut's use-file-upload.ts React hook.
 * Handles file picker and drag-and-drop file uploads.
 */
import { ref, type Ref } from "vue";
import { hasDragData } from "../lib/drag-data";

interface UseFileUploadOptions {
	accept?: string;
	multiple?: boolean;
	onFilesSelected?: (files: FileList) => void;
}

function containsFiles(dataTransfer: DataTransfer): boolean {
	return !hasDragData({ dataTransfer }) && dataTransfer.types.includes("Files");
}

export function useFileUpload({
	accept,
	multiple,
	onFilesSelected,
}: UseFileUploadOptions = {}) {
	const isDragOver = ref(false);
	const dragCounter = ref(0);
	const inputRef = ref<HTMLInputElement | null>(null) as Ref<HTMLInputElement | null>;

	function openFilePicker() {
		if (!inputRef.value) return;
		inputRef.value.accept = accept || "*";
		inputRef.value.multiple = multiple || false;
		inputRef.value.click();
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0 && onFilesSelected) {
			onFilesSelected(files);
		}
		if (target) {
			target.value = "";
		}
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer || !containsFiles(e.dataTransfer)) return;
		dragCounter.value += 1;
		isDragOver.value = true;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer || !containsFiles(e.dataTransfer)) return;
		dragCounter.value -= 1;
		if (dragCounter.value === 0) {
			isDragOver.value = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver.value = false;
		dragCounter.value = 0;

		if (onFilesSelected && e.dataTransfer && containsFiles(e.dataTransfer)) {
			const files = e.dataTransfer.files;
			const shouldUseMultiple = multiple ?? false;

			if (shouldUseMultiple) {
				onFilesSelected(files);
			} else if (files.length > 0) {
				const dataTransfer = new DataTransfer();
				dataTransfer.items.add(files[0]);
				onFilesSelected(dataTransfer.files);
			}
		}
	}

	return {
		isDragOver,
		inputRef,
		openFilePicker,
		handleFileChange,
		handleDragEnter,
		handleDragOver,
		handleDragLeave,
		handleDrop,
	};
}
