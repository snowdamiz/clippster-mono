<script setup lang="ts">
import { ref, computed } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEditor } from "../../../composables/useEditor";
import { useFileUpload } from "../../../composables/useFileUpload";
import { processMediaAssets } from "../../../lib/media/processing";
import { fileNameFromPathOrName } from "@/utils/fsNames";
import { Upload, Loader2, Check, AlertCircle, FolderOpen } from "lucide-vue-next";

const { editor, version } = useEditor();

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
			await editor.media.addMediaAsset({
				projectId: activeProject.value.metadata.id,
				asset,
			});

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
}

const {
	isDragOver,
	inputRef,
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

		<!-- Drop zone -->
		<div class="flex-1 overflow-y-auto p-4">
			<div
				:class="[
					'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
					isDragOver
						? 'border-blue-500 bg-blue-500/10'
						: 'border-white/15 hover:border-white/25',
				]"
				@click="browseFiles"
				role="button"
				tabindex="0"
				@keydown.enter="browseFiles"
			>
				<Upload :class="['size-10', isDragOver ? 'text-blue-400' : 'text-zinc-500']" />
				<div>
					<p :class="['text-sm font-medium', isDragOver ? 'text-blue-400' : 'text-zinc-300']">
						{{ isDragOver ? 'Drop files to upload' : 'Drop files here or click to browse' }}
					</p>
					<p class="mt-1 text-[11px] text-zinc-500">
						PNG, JPG, GIF, WEBP, MP4, MOV, MKV, MP3, WAV, FLAC
					</p>
				</div>
				<button
					type="button"
					class="mt-1 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/10"
					@click.stop="browseFiles"
				>
					<FolderOpen class="size-3.5" />
					Browse Files
				</button>
			</div>

			<!-- Processing progress -->
			<div v-if="isProcessing" class="mt-3 space-y-1.5">
				<div class="flex items-center justify-between text-xs text-zinc-400">
					<span>Processing...</span>
					<span>{{ progress }}%</span>
				</div>
				<div class="h-1.5 overflow-hidden rounded-full bg-white/10">
					<div
						class="h-full rounded-full bg-blue-500 transition-[width] duration-200"
						:style="{ width: `${progress}%` }"
					/>
				</div>
			</div>

			<!-- Uploaded This Session -->
			<div v-if="sessionItems.length > 0" class="mt-4">
				<p class="mb-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
					Uploaded This Session
				</p>
				<div class="space-y-1">
					<div
						v-for="(item, i) in sessionItems"
						:key="i"
						class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
					>
						<Loader2
							v-if="item.status === 'processing'"
							class="size-3.5 shrink-0 animate-spin text-blue-400"
						/>
						<Check
							v-else-if="item.status === 'done'"
							class="size-3.5 shrink-0 text-green-400"
						/>
						<AlertCircle
							v-else
							class="size-3.5 shrink-0 text-red-400"
						/>
						<span
							:class="[
								'truncate',
								item.status === 'error' ? 'text-red-400' : 'text-zinc-300',
							]"
						>
							{{ item.name }}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
