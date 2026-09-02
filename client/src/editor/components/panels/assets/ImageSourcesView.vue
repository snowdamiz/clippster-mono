<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFrameExtractor } from "@/composables/useFrameExtractor";
import { getAllClips } from "@/services/database/clips";
import { getAllImageAssets } from "@/services/database/image-assets";
import type { Clip } from "@/services/database/types";
import type { ImageAsset } from "@/services/database/types";
import { processMediaAssets } from "../../../lib/media/processing";
import { buildImageElement } from "../../../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { fileNameFromPathOrName } from "@/utils/fsNames";
import {
	Upload,
	Image,
	Film,
	Search,
	Loader2,
	Plus,
	Clock,
	Link2,
	ClipboardPaste,
} from "lucide-vue-next";

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		media: true,
		playback: false,
		timeline: false,
		scenes: false,
		selection: false,
	},
});
const { isExtracting, extractFrame, extractFrameAsDataUrl } = useFrameExtractor();

const activeSubTab = ref<"upload" | "clips" | "gallery" | "url" | "paste">("upload");
const clips = ref<Clip[]>([]);
const galleryImages = ref<ImageAsset[]>([]);
const searchQuery = ref("");
const isProcessing = ref(false);
const thumbnailCache = ref<Map<string, string>>(new Map());
const urlInput = ref("");
const urlError = ref<string | null>(null);
const pasteHint = ref("Click here, then Ctrl+V / Cmd+V to paste an image");
const isDragOver = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

// Frame extraction state
const selectedClipForFrame = ref<Clip | null>(null);
const frameTimestamp = ref(0);
const framePreviewUrl = ref<string | null>(null);

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const uploadedImages = computed(() => {
	void version.value;
	return editor.media.getAssets().filter((a) => a.type === "image" && !a.ephemeral);
});

function getMimeType(ext: string): string {
	const map: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		bmp: "image/bmp",
		svg: "image/svg+xml",
	};
	return map[ext] || "image/png";
}

async function addAssetToCanvas(mediaId: string) {
	const hydrated = await editor.media.ensureAssetHydrated(mediaId);
	if (!hydrated) return;
	const element = buildImageElement({
		mediaId,
		name: hydrated.name,
		duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		startTime: editor.playback.getCurrentTime(),
	});
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

async function removeUploadedAsset(id: string) {
	if (!activeProject.value) return;
	await editor.media.removeMediaAsset({ projectId: activeProject.value.metadata.id, id });
}

const builtClips = computed(() => {
	return clips.value.filter(
		(c) => c.built_file_path && c.build_status === "completed",
	);
});

const filteredClips = computed(() => {
	if (!searchQuery.value.trim()) return builtClips.value;
	const q = searchQuery.value.toLowerCase();
	return builtClips.value.filter((c) => {
		const name = c.name || c.project_name || "";
		return name.toLowerCase().includes(q);
	});
});

const filteredGallery = computed(() => {
	if (!searchQuery.value.trim()) return galleryImages.value;
	const q = searchQuery.value.toLowerCase();
	return galleryImages.value.filter((img) => img.name.toLowerCase().includes(q));
});

onMounted(async () => {
	await Promise.all([loadClips(), loadGallery()]);
});

async function loadClips() {
	try {
		clips.value = await getAllClips();
		// Load thumbnails
		for (const clip of builtClips.value) {
			if (clip.built_thumbnail_path && !thumbnailCache.value.has(clip.id)) {
				try {
					const dataUrl = await invoke<string>("read_file_as_data_url", {
						filePath: clip.built_thumbnail_path,
					});
					thumbnailCache.value.set(clip.id, dataUrl);
				} catch {
					// ignore
				}
			}
		}
	} catch (err) {
		console.error("[ImageSourcesView] Failed to load clips:", err);
	}
}

async function loadGallery() {
	try {
		galleryImages.value = await getAllImageAssets();
		for (const img of galleryImages.value) {
			if (img.file_path && !thumbnailCache.value.has(img.id)) {
				try {
					const dataUrl = await invoke<string>("read_file_as_data_url", {
						filePath: img.file_path,
					});
					thumbnailCache.value.set(img.id, dataUrl);
				} catch {
					/* skip */
				}
			}
		}
	} catch (err) {
		console.error("[ImageSourcesView] Failed to load gallery:", err);
	}
}

async function addBlobToCanvas(blob: Blob, name: string) {
	if (!activeProject.value) return;
	isProcessing.value = true;
	try {
		const file = new File([blob], name, { type: blob.type || "image/png" });
		const dt = new DataTransfer();
		dt.items.add(file);
		const processedAssets = await processMediaAssets({
			files: dt.files,
			onProgress: () => {},
		});
		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value!.metadata.id,
				asset,
			});
			const element = buildImageElement({
				mediaId,
				name: asset.name,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: editor.playback.getCurrentTime(),
			});
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	} finally {
		isProcessing.value = false;
	}
}

async function handleUrlImport() {
	urlError.value = null;
	const raw = urlInput.value.trim();
	if (!raw) {
		urlError.value = "Enter an image URL";
		return;
	}
	try {
		isProcessing.value = true;
		const response = await fetch(raw);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const blob = await response.blob();
		if (!blob.type.startsWith("image/")) {
			urlError.value = "URL did not return an image";
			return;
		}
		const ext = blob.type.split("/")[1] || "png";
		await addBlobToCanvas(blob, `url-import.${ext}`);
		urlInput.value = "";
	} catch (err: any) {
		urlError.value = err?.message || "Failed to fetch image";
	} finally {
		isProcessing.value = false;
	}
}

async function handlePaste(e: ClipboardEvent) {
	const items = e.clipboardData?.items;
	if (!items) return;
	for (const item of Array.from(items)) {
		if (item.type.startsWith("image/")) {
			e.preventDefault();
			const blob = item.getAsFile();
			if (blob) {
				await addBlobToCanvas(blob, `paste-${Date.now()}.png`);
				pasteHint.value = "Image pasted onto canvas";
			}
			return;
		}
	}
	// Also accept image URL text
	const text = e.clipboardData?.getData("text");
	if (text && /^https?:\/\//i.test(text.trim())) {
		urlInput.value = text.trim();
		activeSubTab.value = "url";
		await handleUrlImport();
	}
}

function getClipName(clip: Clip): string {
	return clip.name || clip.project_name || "Untitled Clip";
}

function openLocalFilePicker() {
	fileInputRef.value?.click();
}

async function onLocalFileInputChange(e: Event) {
	const input = e.target as HTMLInputElement;
	if (input.files?.length) {
		await addFilesToCanvas(input.files);
	}
	input.value = "";
}

/** Open OS file explorer and add selected images to the canvas. */
async function handleUpload() {
	if (!activeProject.value) return;

	// Prefer Tauri native dialog when available; otherwise fall back to <input type="file">.
	try {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const selected = await open({
			multiple: true,
			title: "Upload images from your computer",
			filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"] }],
		});
		if (!selected) return;

		const paths = Array.isArray(selected) ? selected : [selected];
		isProcessing.value = true;

		for (const filePath of paths) {
			const name = fileNameFromPathOrName(filePath);
			const ext = name.split(".").pop()?.toLowerCase() || "";
			const bytes = await readFile(filePath);
			const file = new File([bytes], name, { type: getMimeType(ext) });

			const processedAssets = await processMediaAssets({
				files: [file],
				onProgress: () => {},
			});

			for (const processed of processedAssets) {
				const mediaId = await editor.media.addMediaAsset({
					projectId: activeProject.value!.metadata.id,
					asset: {
						...processed,
						diskImportPath: filePath,
					},
				});
				await addAssetToCanvas(mediaId);
			}
		}
	} catch (err) {
		console.warn("[ImageSourcesView] Native dialog failed, using file input:", err);
		openLocalFilePicker();
	} finally {
		isProcessing.value = false;
	}
}

async function addFilesToCanvas(files: FileList | File[]) {
	if (!activeProject.value) return;
	const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
	if (list.length === 0) return;
	isProcessing.value = true;
	try {
		const dt = new DataTransfer();
		for (const file of list) dt.items.add(file);
		const processedAssets = await processMediaAssets({
			files: dt.files,
			onProgress: () => {},
		});
		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value.metadata.id,
				asset,
			});
			await addAssetToCanvas(mediaId);
		}
	} catch (err) {
		console.error("[ImageSourcesView] Dropped files failed:", err);
	} finally {
		isProcessing.value = false;
	}
}

function onPanelDragEnter(e: DragEvent) {
	if (![...e.dataTransfer?.types ?? []].includes("Files")) return;
	e.preventDefault();
	isDragOver.value = true;
}

function onPanelDragOver(e: DragEvent) {
	if (![...e.dataTransfer?.types ?? []].includes("Files")) return;
	e.preventDefault();
	isDragOver.value = true;
}

function onPanelDragLeave(e: DragEvent) {
	const next = e.relatedTarget as Node | null;
	if (next && (e.currentTarget as HTMLElement).contains(next)) return;
	isDragOver.value = false;
}

async function onPanelDrop(e: DragEvent) {
	e.preventDefault();
	isDragOver.value = false;
	if (e.dataTransfer?.files?.length) {
		await addFilesToCanvas(e.dataTransfer.files);
	}
}

// Add clip thumbnail as image element
async function addClipThumbnail(clip: Clip) {
	if (!activeProject.value || !clip.built_thumbnail_path) return;

	try {
		const dataUrl = await invoke<string>("read_file_as_data_url", {
			filePath: clip.built_thumbnail_path,
		});
		const response = await fetch(dataUrl);
		const blob = await response.blob();
		const file = new File([blob], `${getClipName(clip)}_thumbnail.png`, { type: "image/png" });

		const dt = new DataTransfer();
		dt.items.add(file);

		const processedAssets = await processMediaAssets({
			files: dt.files,
			onProgress: () => {},
		});

		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value!.metadata.id,
				asset,
			});
			// Also add to timeline
			const element = buildImageElement({
				mediaId,
				name: asset.name,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: editor.playback.getCurrentTime(),
			});
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	} catch (err) {
		console.error("[ImageSourcesView] Failed to add clip thumbnail:", err);
	}
}

// Extract frame from clip video
async function openFrameExtractor(clip: Clip) {
	selectedClipForFrame.value = clip;
	frameTimestamp.value = 0;
	framePreviewUrl.value = null;

	if (clip.built_file_path) {
		const preview = await extractFrameAsDataUrl(clip.built_file_path, 0);
		framePreviewUrl.value = preview;
	}
}

async function updateFramePreview() {
	const clip = selectedClipForFrame.value;
	if (!clip?.built_file_path) return;
	const preview = await extractFrameAsDataUrl(clip.built_file_path, frameTimestamp.value);
	framePreviewUrl.value = preview;
}

async function addExtractedFrame() {
	const clip = selectedClipForFrame.value;
	if (!clip?.built_file_path || !activeProject.value) return;

	const framePath = await extractFrame(
		clip.built_file_path,
		frameTimestamp.value,
		`frame_${getClipName(clip)}_${frameTimestamp.value}s`,
	);
	if (!framePath) return;

	try {
		const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: framePath });
		const response = await fetch(dataUrl);
		const blob = await response.blob();
		const file = new File([blob], `${getClipName(clip)}_frame.png`, { type: "image/png" });

		const dt = new DataTransfer();
		dt.items.add(file);

		const processedAssets = await processMediaAssets({
			files: dt.files,
			onProgress: () => {},
		});

		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value!.metadata.id,
				asset,
			});
			const element = buildImageElement({
				mediaId,
				name: asset.name,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: editor.playback.getCurrentTime(),
			});
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	} catch (err) {
		console.error("[ImageSourcesView] Failed to add extracted frame:", err);
	}

	selectedClipForFrame.value = null;
}

// Add gallery image to canvas
async function addGalleryImage(img: ImageAsset) {
	if (!activeProject.value) return;

	try {
		const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: img.file_path });
		const response = await fetch(dataUrl);
		const blob = await response.blob();
		const file = new File([blob], img.name, { type: img.mime_type || "image/png" });

		const dt = new DataTransfer();
		dt.items.add(file);

		const processedAssets = await processMediaAssets({
			files: dt.files,
			onProgress: () => {},
		});

		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value!.metadata.id,
				asset,
			});
			const element = buildImageElement({
				mediaId,
				name: asset.name,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: editor.playback.getCurrentTime(),
			});
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	} catch (err) {
		console.error("[ImageSourcesView] Failed to add gallery image:", err);
	}
}

function formatDuration(seconds: number | null): string {
	if (!seconds) return "";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}
</script>

<template>
	<div class="flex h-full flex-col bg-[#1e1e1e]">
		<input
			ref="fileInputRef"
			type="file"
			class="hidden"
			accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
			multiple
			@change="onLocalFileInputChange"
		/>

		<div class="grid shrink-0 grid-cols-5 border-b border-black/40 bg-[#2a2a2a]">
			<button
				v-for="tab in ([
					{ key: 'upload', label: 'Upload', icon: Upload },
					{ key: 'url', label: 'URL', icon: Link2 },
					{ key: 'paste', label: 'Paste', icon: ClipboardPaste },
					{ key: 'clips', label: 'Clips', icon: Film },
					{ key: 'gallery', label: 'Gallery', icon: Image },
				] as const)"
				:key="tab.key"
				type="button"
				:title="tab.label"
				:class="[
					'flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[9px] leading-none transition-colors',
					activeSubTab === tab.key
						? 'bg-[#1e1e1e] text-zinc-100'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeSubTab = tab.key"
			>
				<component :is="tab.icon" class="size-3.5 shrink-0" />
				<span class="w-full truncate text-center">{{ tab.label }}</span>
			</button>
		</div>

		<div
			v-if="activeSubTab === 'upload'"
			class="flex flex-1 flex-col overflow-hidden"
			@dragenter="onPanelDragEnter"
			@dragover="onPanelDragOver"
			@dragleave="onPanelDragLeave"
			@drop="onPanelDrop"
		>
			<button
				type="button"
				:disabled="isProcessing"
				:class="[
					'm-2 flex shrink-0 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-6 text-center transition-colors',
					isDragOver
						? 'border-[#4693e0] bg-[#4693e0]/15'
						: 'border-white/20 bg-white/[0.03] hover:border-[#4693e0]/60 hover:bg-[#4693e0]/10',
					isProcessing ? 'opacity-50' : 'cursor-pointer',
				]"
				@click="handleUpload"
			>
				<Loader2 v-if="isProcessing" class="size-7 animate-spin text-[#4693e0]" />
				<Upload v-else class="size-7 text-[#4693e0]" />
				<span class="break-words text-[12px] font-medium text-zinc-100">
					{{ isProcessing ? "Uploading…" : isDragOver ? "Drop images here" : "Click to upload from your computer" }}
				</span>
				<span class="break-words text-[10px] text-zinc-500">PNG, JPG, WebP, GIF · or drag files here</span>
			</button>

			<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
				<p v-if="uploadedImages.length > 0" class="mb-1.5 text-[10px] text-zinc-500">
					Project images · click to add again
				</p>
				<div
					v-if="uploadedImages.length > 0"
					class="grid gap-1.5"
					style="grid-template-columns: repeat(auto-fill, minmax(72px, 1fr))"
				>
					<div
						v-for="item in uploadedImages"
						:key="item.id"
						class="group relative cursor-pointer overflow-hidden rounded-sm border border-black/40 bg-[#141414] text-left hover:border-[#4693e0]"
						:title="`${item.name} — click to add to canvas`"
						@click="addAssetToCanvas(item.id)"
					>
						<div class="aspect-square">
							<img
								v-if="item.url || item.thumbnailUrl"
								:src="item.url || item.thumbnailUrl"
								:alt="item.name"
								class="size-full object-cover"
								draggable="false"
							/>
							<Image v-else class="size-full p-4 text-zinc-700" />
						</div>
						<div class="truncate px-1 py-0.5 text-[9px] text-zinc-400">{{ item.name }}</div>
						<button
							type="button"
							class="absolute top-0.5 right-0.5 hidden rounded bg-black/60 px-1 text-[10px] text-white group-hover:block"
							:aria-label="`Remove ${item.name}`"
							@click.stop="removeUploadedAsset(item.id)"
						>
							✕
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- URL tab -->
		<div v-else-if="activeSubTab === 'url'" class="flex flex-1 flex-col gap-3 p-3">
			<p class="text-[11px] text-zinc-500">Fetch an image from a public URL</p>
			<input
				v-model="urlInput"
				type="url"
				placeholder="https://example.com/image.jpg"
				class="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#4693e0]/50"
				@keydown.enter="handleUrlImport"
			/>
			<p v-if="urlError" class="text-[10px] text-red-400">{{ urlError }}</p>
			<button
				type="button"
				class="rounded-sm bg-[#4693e0] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5aa0e6] disabled:opacity-50"
				:disabled="isProcessing || !urlInput.trim()"
				@click="handleUrlImport"
			>
				{{ isProcessing ? 'Importing…' : 'Add to canvas' }}
			</button>
		</div>

		<!-- Paste tab -->
		<div
			v-else-if="activeSubTab === 'paste'"
			class="flex flex-1 flex-col items-center justify-center gap-2 p-6 outline-none"
			tabindex="0"
			@paste="handlePaste"
			@click="($event.currentTarget as HTMLElement).focus()"
		>
			<ClipboardPaste class="size-8 text-zinc-500" />
			<p class="text-sm text-zinc-400 text-center">{{ pasteHint }}</p>
			<p class="text-[10px] text-zinc-600">Supports clipboard images and image URLs</p>
		</div>

		<!-- Clips tab -->
		<div v-else-if="activeSubTab === 'clips'" class="flex flex-1 flex-col overflow-hidden">
			<!-- Search -->
			<div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
				<Search class="size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search clips..."
					class="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
				/>
			</div>

			<!-- Frame extractor overlay -->
			<div v-if="selectedClipForFrame" class="flex flex-col gap-3 p-3 border-b border-white/10 bg-white/5">
				<div class="flex items-center justify-between">
					<span class="text-xs text-zinc-300 font-medium">Extract Frame</span>
					<button
						type="button"
						class="text-xs text-zinc-500 hover:text-zinc-300"
						@click="selectedClipForFrame = null"
					>✕</button>
				</div>
				<div v-if="framePreviewUrl" class="aspect-video w-full overflow-hidden rounded bg-zinc-800">
					<img :src="framePreviewUrl" class="size-full object-contain" />
				</div>
				<div class="flex items-center gap-2">
					<Clock class="size-3 text-zinc-500" />
					<input
						v-model.number="frameTimestamp"
						type="range"
						:min="0"
						:max="selectedClipForFrame.built_duration || 60"
						:step="0.1"
						class="flex-1"
						@change="updateFramePreview"
					/>
					<span class="text-[10px] text-zinc-500 w-8 text-right">{{ frameTimestamp.toFixed(1) }}s</span>
				</div>
				<button
					type="button"
					class="flex items-center justify-center gap-1 rounded-sm bg-[#4693e0] px-3 py-1.5 text-xs text-white hover:bg-[#5aa0e6] transition-colors"
					:disabled="isExtracting"
					@click="addExtractedFrame"
				>
					<Loader2 v-if="isExtracting" class="size-3 animate-spin" />
					<Plus v-else class="size-3" />
					Add to Canvas
				</button>
			</div>

			<!-- Clip list -->
			<div class="flex-1 overflow-y-auto p-2 space-y-1">
				<div v-if="filteredClips.length === 0" class="flex items-center justify-center h-20 text-zinc-600 text-xs">
					No built clips found
				</div>
				<div
					v-for="clip in filteredClips"
					:key="clip.id"
					class="group flex items-center gap-2 rounded-md p-1.5 hover:bg-white/5 cursor-pointer"
				>
					<div class="size-10 shrink-0 overflow-hidden rounded bg-zinc-800">
						<img
							v-if="thumbnailCache.get(clip.id)"
							:src="thumbnailCache.get(clip.id)"
							:alt="getClipName(clip)"
							class="size-full object-cover"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<Film class="size-4 text-zinc-600" />
						</div>
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate text-xs text-zinc-200">{{ getClipName(clip) }}</div>
						<div class="text-[10px] text-zinc-500">{{ formatDuration(clip.built_duration) }}</div>
					</div>
					<div class="hidden group-hover:flex items-center gap-1">
						<button
							v-if="clip.built_thumbnail_path"
							type="button"
							class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/20"
							title="Use thumbnail"
							@click.stop="addClipThumbnail(clip)"
						>
							Thumb
						</button>
						<button
							type="button"
							class="rounded-sm bg-[#4693e0]/90 px-1.5 py-0.5 text-[10px] text-white hover:bg-[#4693e0]"
							title="Extract frame"
							@click.stop="openFrameExtractor(clip)"
						>
							Frame
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Gallery tab -->
		<div v-else-if="activeSubTab === 'gallery'" class="flex flex-1 flex-col overflow-hidden">
			<div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
				<Search class="size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search images..."
					class="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
				/>
			</div>

			<div class="flex-1 overflow-y-auto p-2">
				<div v-if="filteredGallery.length === 0" class="flex items-center justify-center h-20 text-zinc-600 text-xs">
					No saved images yet
				</div>
				<div
					v-else
					class="grid gap-2"
					style="grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))"
				>
					<div
						v-for="img in filteredGallery"
						:key="img.id"
						class="group relative cursor-pointer overflow-hidden rounded-sm border border-black/40 hover:border-[#4693e0] transition-colors"
						@dblclick="addGalleryImage(img)"
					>
						<div class="aspect-square bg-zinc-800">
							<img
								v-if="thumbnailCache.get(img.id)"
								:src="thumbnailCache.get(img.id)"
								:alt="img.name"
								class="size-full object-cover"
							/>
							<Image v-else class="size-full p-4 text-zinc-700" />
						</div>
						<div class="truncate px-1.5 py-1 text-[10px] text-zinc-400">{{ img.name }}</div>
						<button
							type="button"
							class="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex"
							@click="addGalleryImage(img)"
						>
							<Plus class="size-5 text-white" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
