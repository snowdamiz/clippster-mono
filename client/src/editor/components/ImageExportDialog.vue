<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, RotateCcw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import ExportOptionGroup from "./export/ExportOptionGroup.vue";
import ExportProgress from "./export/ExportProgress.vue";
import ExportResult from "./export/ExportResult.vue";
import {
	useImageMode,
	type ImageExportFormat,
} from "../composables/useImageMode";
import { useEditor } from "../composables/useEditor";

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	close: [];
	exported: [path: string | null];
}>();

const { exportAndSave } = useImageMode();
const { editor, version } = useEditor({
	subscribe: {
		project: true,
		playback: false,
		timeline: false,
		scenes: false,
		media: false,
		selection: false,
	},
});

type ExportDestination = "library" | "library_and_disk" | "disk";

const format = ref<ImageExportFormat>("png");
const destination = ref<ExportDestination>("library_and_disk");
const isExporting = ref(false);
const error = ref<string | null>(null);
const successPath = ref<string | null>(null);
const successMessage = ref("");

const formatOptions: { value: ImageExportFormat; label: string; hint: string }[] = [
	{ value: "png", label: "PNG", hint: "Lossless quality with transparency support" },
	{ value: "jpg", label: "JPEG", hint: "Smaller files — best for photos without transparency" },
	{ value: "webp", label: "WebP", hint: "Modern format — smaller than PNG with good quality" },
];

const destinationOptions: { value: ExportDestination; label: string; hint: string }[] = [
	{
		value: "library",
		label: "Save to Images",
		hint: "Add to your Clippster Image gallery only",
	},
	{
		value: "library_and_disk",
		label: "Save and export",
		hint: "Save to Image gallery and download a local file",
	},
	{
		value: "disk",
		label: "Export",
		hint: "Download a local file only — skip the Image gallery",
	},
];

const formatHint = computed(
	() => formatOptions.find((o) => o.value === format.value)?.hint ?? "",
);

const destinationHint = computed(
	() => destinationOptions.find((o) => o.value === destination.value)?.hint ?? "",
);

const destinationBadge = computed(
	() => destinationOptions.find((o) => o.value === destination.value)?.label ?? "",
);

const exportButtonLabel = computed(() => {
	switch (destination.value) {
		case "library":
			return "Save to Images";
		case "library_and_disk":
			return "Save and export";
		default:
			return "Export image";
	}
});

const projectName = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull()?.metadata.name || "Untitled Design";
});

const canvasLabel = computed(() => {
	void version.value;
	const size = editor.project.getActiveOrNull()?.settings.canvasSize;
	if (!size) return "";
	return `${size.width} × ${size.height}`;
});

watch(
	() => props.open,
	(open) => {
		if (open) {
			error.value = null;
			successPath.value = null;
			successMessage.value = "";
			isExporting.value = false;
		}
	},
);

function close() {
	if (isExporting.value) return;
	emit("close");
}

async function handleExport() {
	if (isExporting.value) return;
	isExporting.value = true;
	error.value = null;
	successPath.value = null;
	successMessage.value = "";

	try {
		const path = await exportAndSave(format.value, projectName.value, {
			destination: destination.value,
			preferDiskDialog: destination.value !== "library",
		});
		if (!path) {
			// User cancelled the save dialog
			return;
		}
		successPath.value = path;
		successMessage.value =
			destination.value === "library"
				? "Saved to your Image gallery"
				: destination.value === "library_and_disk"
					? "Saved to Image gallery and exported"
					: "Image exported";
		emit("exported", path);
	} catch (e) {
		console.error("[ImageExportDialog] Export failed:", e);
		error.value = e instanceof Error ? e.message : "Export failed";
	} finally {
		isExporting.value = false;
	}
}
</script>

<template>
	<Modal
		:open="open"
		title="Export image"
		:description="canvasLabel ? `${projectName} · ${canvasLabel}` : projectName"
		:icon="Download"
		size="md"
		:dismissible="!isExporting"
		:hide-close="isExporting"
		@update:open="(value) => { if (!value) close(); }"
	>
		<!-- Success -->
		<ExportResult
			v-if="successPath && !isExporting"
			status="success"
			title="Export complete"
			:message="successMessage || 'Your image has been saved'"
		>
			<div class="flex flex-col gap-0.5 rounded-lg border border-line-subtle bg-surface-sunken px-3 py-2">
				<span class="eyebrow">Saved to</span>
				<span class="truncate font-mono text-xs text-fg-muted" :title="successPath">{{ successPath }}</span>
			</div>
		</ExportResult>

		<!-- Error -->
		<ExportResult v-else-if="error && !isExporting" status="error" title="Export failed" :message="error" />

		<!-- Exporting -->
		<ExportProgress
			v-else-if="isExporting"
			label="Rendering at full resolution"
			:hint="
				destination === 'library'
					? 'Saving to your Image gallery…'
					: destination === 'library_and_disk'
						? 'Saving to gallery and opening save dialog…'
						: 'Preparing image and opening save dialog…'
			"
		/>

		<!-- Settings -->
		<div v-else class="flex flex-col gap-4">
			<ExportOptionGroup v-model="format" label="Format" :hint="formatHint" :options="formatOptions" />
			<ExportOptionGroup
				v-model="destination"
				label="Destination"
				:hint="destinationHint"
				:options="destinationOptions"
			/>
		</div>

		<template #footer>
			<Button v-if="!isExporting" variant="ghost" @click="close">
				{{ successPath || error ? "Close" : "Cancel" }}
			</Button>
			<Button v-if="successPath && !isExporting" variant="primary" @click="handleExport">
				<Download />
				Save again
			</Button>
			<Button v-else-if="error && !isExporting" variant="primary" @click="handleExport">
				<RotateCcw />
				Retry export
			</Button>
			<Button v-else-if="!isExporting" variant="primary" @click="handleExport">
				<Download />
				{{ exportButtonLabel }}
			</Button>
			<Button v-else variant="primary" loading>Exporting…</Button>
		</template>
	</Modal>
</template>
