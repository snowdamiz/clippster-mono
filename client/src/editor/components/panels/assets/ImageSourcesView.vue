<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFrameExtractor } from "@/composables/useFrameExtractor";
import { getAllClips } from "@/services/database/clips";
import { getAllImageAssets } from "@/services/database/image-assets";
import type { Clip } from "@/services/database/types";
import type { ImageAsset } from "@/services/database/types";
import type { MediaAsset } from "../../../types/assets";
import { processMediaAssets } from "../../../lib/media/processing";
import { buildImageElement } from "../../../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { invoke } from "@tauri-apps/api/core";
import {
	Upload,
	Image,
	Film,
	Search,
	Loader2,
	Plus,
	Clock,
} from "lucide-vue-next";

const { editor, version } = useEditor();
const { isExtracting, extractFrame, extractFrameAsDataUrl } = useFrameExtractor();

const activeSubTab = ref<"upload" | "clips" | "gallery">("upload");
const clips = ref<Clip[]>([]);
const galleryImages = ref<ImageAsset[]>([]);
const searchQuery = ref("");
const isProcessing = ref(false);
const thumbnailCache = ref<Map<string, string>>(new Map());

// Frame extraction state
const selectedClipForFrame = ref<Clip | null>(null);
const frameTimestamp = ref(0);
const framePreviewUrl = ref<string | null>(null);

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

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
	} catch (err) {
		console.error("[ImageSourcesView] Failed to load gallery:", err);
	}
}

function getClipName(clip: Clip): string {
	return clip.name || clip.project_name || "Untitled Clip";
}

// Upload image files
async function handleUpload() {
	if (!activeProject.value) return;
	try {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const selected = await open({
			multiple: true,
			filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"] }],
		});
		if (!selected) return;

		const paths = Array.isArray(selected) ? selected : [selected];
		isProcessing.value = true;

		for (const filePath of paths) {
			const name = filePath.split(/[\\/]/).pop() || "image";
			// Create a File-like object for processMediaAssets
			const dataUrl = await invoke<string>("read_file_as_data_url", { filePath });
			const response = await fetch(dataUrl);
			const blob = await response.blob();
			const file = new File([blob], name, { type: blob.type });

			const dt = new DataTransfer();
			dt.items.add(file);

			const processedAssets = await processMediaAssets({
				files: dt.files,
				onProgress: () => {},
			});

			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.value!.metadata.id,
					asset,
				});
			}
		}
	} catch (err) {
		console.error("[ImageSourcesView] Upload failed:", err);
	} finally {
		isProcessing.value = false;
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
	<div class="flex h-full flex-col">
		<!-- Sub-tabs -->
		<div class="flex items-center border-b border-white/10">
			<button
				v-for="tab in ([
					{ key: 'upload', label: 'Upload', icon: Upload },
					{ key: 'clips', label: 'From Clips', icon: Film },
					{ key: 'gallery', label: 'Gallery', icon: Image },
				] as const)"
				:key="tab.key"
				type="button"
				:class="[
					'flex items-center gap-1 px-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2',
					activeSubTab === tab.key
						? 'border-purple-500 text-purple-400'
						: 'border-transparent text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeSubTab = tab.key"
			>
				<component :is="tab.icon" class="size-3.5" />
				{{ tab.label }}
			</button>
		</div>

		<!-- Upload tab -->
		<div v-if="activeSubTab === 'upload'" class="flex-1 overflow-y-auto p-3">
			<div
				class="flex h-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 p-8 text-center cursor-pointer hover:border-purple-500/40 transition-colors"
				@click="handleUpload"
			>
				<Upload class="text-zinc-500 size-8" />
				<p class="text-zinc-500 text-sm">
					{{ isProcessing ? 'Processing...' : 'Click to upload images' }}
				</p>
				<p class="text-zinc-600 text-xs">PNG, JPG, WebP, SVG, GIF</p>
			</div>
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
					class="flex items-center justify-center gap-1 rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-500 transition-colors"
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
							class="rounded bg-purple-600/80 px-1.5 py-0.5 text-[10px] text-white hover:bg-purple-500"
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
						class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10 hover:border-purple-500/50 transition-colors"
						@dblclick="addGalleryImage(img)"
					>
						<div class="aspect-square bg-zinc-800">
							<Image class="size-full p-4 text-zinc-700" />
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
