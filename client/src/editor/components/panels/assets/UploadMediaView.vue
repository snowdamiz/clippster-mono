<script setup lang="ts">
import { ref, computed } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEditor } from "../../../composables/useEditor";
import { useFileUpload } from "../../../composables/useFileUpload";
import { useImageMode } from "../../../composables/useImageMode";
import { processMediaAssets } from "../../../lib/media/processing";
import { buildImageElement } from "../../../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { fileNameFromPathOrName } from "@/utils/fsNames";
import { Upload, Loader2, Check, AlertCircle, FolderOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { SectionHeader } from "@/components/ui/section-header";
import AssetListRow from "../shared/AssetListRow.vue";

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

const isProcessing = ref(false);
const progress = ref(0);

interface SessionItem {
	name: string;
	status: "processing" | "done" | "error";
}

const sessionItems = ref<SessionItem[]>([]);

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const { isImageMode } = useImageMode();

async function addImageToCanvas(mediaId: string, name: string) {
	const element = buildImageElement({
		mediaId,
		name,
		duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		startTime: editor.playback.getCurrentTime(),
	});
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

function getMimeType(ext: string): string {
	const map: Record<string, string> = {
		mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
		avi: "video/x-msvideo", mkv: "video/x-matroska", m4v: "video/x-m4v",
		flv: "video/x-flv", wmv: "video/x-ms-wmv",
		mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
		aac: "audio/aac", m4a: "audio/mp4", flac: "audio/flac",
		jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
		gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
		svg: "image/svg+xml",
	};
	return map[ext] || "application/octet-stream";
}

async function processFiles(files: FileList | File[]) {
	const fileArray = Array.from(files);
	if (fileArray.length === 0) return;
	if (!activeProject.value) return;

	for (const f of fileArray) {
		sessionItems.value = [...sessionItems.value, { name: f.name, status: "processing" }];
	}

	isProcessing.value = true;
	progress.value = 0;

	try {
		const processedAssets = await processMediaAssets({
			files: fileArray,
			onProgress: (p: { progress: number }) => { progress.value = p.progress; },
		});

		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value.metadata.id,
				asset,
			});

			if (isImageMode.value && asset.type === "image") {
				await addImageToCanvas(mediaId, asset.name);
			}

			const idx = sessionItems.value.findIndex(
				(s) => s.name === asset.name && s.status === "processing"
			);
			if (idx >= 0) {
				const updated = [...sessionItems.value];
				updated[idx] = { ...updated[idx], status: "done" };
				sessionItems.value = updated;
			}
		}

		// Mark remaining processing items as error (unsupported or failed)
		sessionItems.value = sessionItems.value.map((s) =>
			s.status === "processing" ? { ...s, status: "error" } : s
		);
	} catch (error) {
		console.error("[UploadMediaView] Error processing files:", error);
		sessionItems.value = sessionItems.value.map((s) =>
			s.status === "processing" ? { ...s, status: "error" } : s
		);
	} finally {
		isProcessing.value = false;
		progress.value = 0;
	}
}

async function browseFiles() {
	const isTauri =
		typeof window !== "undefined" &&
		("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

	if (!isTauri) {
		openFilePicker();
		return;
	}

	try {
		const selected = await open({
			multiple: true,
			filters: [
				{
					name: "Media",
					extensions: [
						"mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v",
						"mp3", "wav", "ogg", "aac", "m4a", "flac",
						"jpg", "jpeg", "png", "gif", "webp", "bmp", "svg",
					],
				},
			],
		});

		if (!selected) return;
		const paths = Array.isArray(selected) ? selected : [selected];

		const files: File[] = [];
		for (const filePath of paths) {
			try {
				const bytes = await readFile(filePath);
				const name = fileNameFromPathOrName(filePath);
				const ext = name.split(".").pop()?.toLowerCase() || "";
				const mime = getMimeType(ext);
				const file = new File([bytes], name, { type: mime });
				(file as File & { path?: string }).path = filePath;
				files.push(file);
			} catch (err) {
				console.error(`[UploadMediaView] Failed to read file: ${filePath}`, err);
			}
		}

		if (files.length > 0) {
			await processFiles(files);
		}
	} catch (err) {
		console.warn("[UploadMediaView] Native dialog failed, using file input:", err);
		openFilePicker();
	}
}

const {
	isDragOver,
	inputRef,
	openFilePicker,
	handleFileChange,
	handleDragEnter,
	handleDragOver,
	handleDragLeave,
	handleDrop,
} = useFileUpload({
	accept: "image/*,video/*,audio/*",
	multiple: true,
	onFilesSelected: (files) => processFiles(files),
});
</script>

<template>
	<div
		class="flex h-full flex-col overflow-hidden"
		@dragenter="handleDragEnter"
		@dragover="handleDragOver"
		@dragleave="handleDragLeave"
		@drop="handleDrop"
	>
		<input
			:ref="(el) => { inputRef = el as HTMLInputElement | null }"
			type="file"
			class="hidden"
			accept="image/*,video/*,audio/*"
			multiple
			@change="handleFileChange"
		/>

		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
			<!-- Drop zone -->
			<div
				:class="[
					'flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors',
					isDragOver
						? 'border-brand-line bg-brand-soft'
						: 'border-line hover:border-line-strong hover:bg-surface-hover',
				]"
				role="button"
				tabindex="0"
				aria-label="Upload media files"
				@click="browseFiles"
				@keydown.enter="browseFiles"
				@keydown.space.prevent="browseFiles"
			>
				<EmptyState
					size="sm"
					:icon="Upload"
					:tone="isDragOver ? 'brand' : 'neutral'"
					:title="isDragOver ? 'Drop files to upload' : 'Drop files here or click to browse'"
					description="PNG, JPG, GIF, WEBP, MP4, MOV, MKV, MP3, WAV, FLAC"
				>
					<Button variant="primary" size="sm" @click.stop="browseFiles">
						<FolderOpen />
						Browse files
					</Button>
				</EmptyState>
			</div>

			<!-- Processing progress -->
			<div v-if="isProcessing" class="flex shrink-0 flex-col gap-1.5">
				<div class="flex items-center justify-between text-xs">
					<span class="text-fg-muted">Processing…</span>
					<span class="tabular text-fg-subtle">{{ progress }}%</span>
				</div>
				<div class="h-1 overflow-hidden rounded-full bg-surface-hover">
					<div
						class="h-full rounded-full bg-brand transition-[width] duration-200"
						:style="{ width: `${progress}%` }"
					/>
				</div>
			</div>

			<!-- Uploaded this session -->
			<section v-if="sessionItems.length > 0" class="shrink-0">
				<SectionHeader variant="eyebrow" title="Uploaded this session" :count="sessionItems.length" class="mb-1" />
				<div class="-mx-2 space-y-px">
					<AssetListRow
						v-for="(item, i) in sessionItems"
						:key="i"
						:title="item.name"
						:meta="
							item.status === 'processing'
								? 'Processing…'
								: item.status === 'done'
									? 'Added to media'
									: 'Could not import this file'
						"
					>
						<template #leading>
							<IconTile
								:icon="item.status === 'processing' ? Loader2 : item.status === 'done' ? Check : AlertCircle"
								:tone="item.status === 'processing' ? 'brand' : item.status === 'done' ? 'success' : 'danger'"
								size="sm"
								:class="item.status === 'processing' && '[&_svg]:animate-spin'"
							/>
						</template>
					</AssetListRow>
				</div>
			</section>
		</div>
	</div>
</template>
