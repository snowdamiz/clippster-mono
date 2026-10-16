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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import PanelHeader from "../../chrome/PanelHeader.vue";
import { AssetGrid, AssetListRow, AssetTile, InspectorField, SliderField } from "../shared";
import PanelSearchBar from "./PanelSearchBar.vue";
import {
	Upload,
	Image,
	Film,
	Loader2,
	Plus,
	X,
	Camera,
	SearchX,
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
const subTabs: SegmentedOption<"upload" | "clips" | "gallery" | "url" | "paste">[] = [
	{ value: "upload", label: "Upload", title: "Upload from your computer" },
	{ value: "url", label: "URL", title: "Import from a URL" },
	{ value: "paste", label: "Paste", title: "Paste from the clipboard" },
	{ value: "clips", label: "Clips", title: "Frames from built clips" },
	{ value: "gallery", label: "Gallery", title: "Saved images" },
];
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
	<div class="flex h-full flex-col">
		<input
			ref="fileInputRef"
			type="file"
			class="hidden"
			accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
			multiple
			@change="onLocalFileInputChange"
		/>

		<PanelHeader class="px-1.5">
			<SegmentedControl
				v-model="activeSubTab"
				:options="subTabs"
				size="sm"
				block
				class="[&>button]:min-w-0 [&>button]:px-1"
			/>
		</PanelHeader>

		<!-- Upload tab -->
		<div
			v-if="activeSubTab === 'upload'"
			class="flex flex-1 flex-col overflow-y-auto p-3"
			@dragenter="onPanelDragEnter"
			@dragover="onPanelDragOver"
			@dragleave="onPanelDragLeave"
			@drop="onPanelDrop"
		>
			<button
				type="button"
				:disabled="isProcessing"
				:class="[
					'flex w-full shrink-0 flex-col items-center justify-center rounded-lg border border-dashed transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
					isDragOver ? 'border-brand-line bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface-hover',
					isProcessing ? 'cursor-wait opacity-60' : 'cursor-pointer',
					uploadedImages.length === 0 && 'flex-1',
				]"
				@click="handleUpload"
			>
				<EmptyState
					size="sm"
					:icon="isProcessing ? Loader2 : Upload"
					:tone="isDragOver ? 'brand' : 'neutral'"
					:title="isProcessing ? 'Uploading…' : isDragOver ? 'Drop images here' : 'Upload from your computer'"
					:description="isProcessing ? undefined : 'PNG, JPG, WebP, GIF · or drag files here'"
					:class="['py-6', isProcessing && '[&_svg]:animate-spin']"
				/>
			</button>

			<template v-if="uploadedImages.length > 0">
				<p class="mb-2 mt-3 text-2xs text-fg-subtle">Project images · click to add again</p>
				<AssetGrid :min="72">
					<AssetTile
						v-for="item in uploadedImages"
						:key="item.id"
						as="div"
						aspect="1"
						:label="item.name"
						class="cursor-pointer"
						role="button"
						tabindex="0"
						:title="`${item.name} — click to add to canvas`"
						@click="addAssetToCanvas(item.id)"
						@keydown.enter="addAssetToCanvas(item.id)"
					>
						<img
							v-if="item.url || item.thumbnailUrl"
							:src="item.url || item.thumbnailUrl"
							:alt="item.name"
							class="size-full object-cover"
							draggable="false"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<Image class="size-6 text-fg-subtle" />
						</div>
						<template #actions>
							<button
								type="button"
								class="grid size-5 place-items-center rounded bg-black/60 text-white/85 transition-colors hover:bg-danger-solid hover:text-white"
								:title="`Remove ${item.name}`"
								:aria-label="`Remove ${item.name}`"
								@click.stop="removeUploadedAsset(item.id)"
							>
								<X class="size-3" />
							</button>
						</template>
					</AssetTile>
				</AssetGrid>
			</template>
		</div>

		<!-- URL tab -->
		<div v-else-if="activeSubTab === 'url'" class="flex-1 space-y-3 overflow-y-auto p-3">
			<InspectorField label="Image URL" for="image-source-url">
				<Input
					id="image-source-url"
					v-model="urlInput"
					type="url"
					placeholder="https://example.com/image.jpg"
					class="h-7 px-2 text-xs"
					:aria-invalid="urlError ? true : undefined"
					@keydown.enter="handleUrlImport"
				/>
				<p v-if="urlError" class="text-2xs text-danger">{{ urlError }}</p>
				<p v-else class="text-2xs text-fg-subtle">Fetch an image from a public URL.</p>
			</InspectorField>
			<Button
				variant="primary"
				size="sm"
				block
				:disabled="isProcessing || !urlInput.trim()"
				@click="handleUrlImport"
			>
				<Loader2 v-if="isProcessing" class="animate-spin" />
				<Plus v-else />
				{{ isProcessing ? 'Importing…' : 'Add to canvas' }}
			</Button>
		</div>

		<!-- Paste tab -->
		<div v-else-if="activeSubTab === 'paste'" class="flex flex-1 flex-col p-3">
			<div
				class="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line outline-none transition-colors hover:border-line-strong focus:border-brand-line focus:bg-brand-soft"
				tabindex="0"
				@paste="handlePaste"
				@click="($event.currentTarget as HTMLElement).focus()"
			>
				<EmptyState
					size="sm"
					:icon="ClipboardPaste"
					:title="pasteHint"
					description="Supports clipboard images and image URLs."
				/>
			</div>
		</div>

		<!-- Clips tab -->
		<div v-else-if="activeSubTab === 'clips'" class="flex flex-1 flex-col overflow-hidden">
			<PanelSearchBar v-model="searchQuery" placeholder="Search clips…" />

			<div class="flex-1 overflow-y-auto">
				<!-- Frame extractor -->
				<div v-if="selectedClipForFrame" class="space-y-2.5 border-b border-line-subtle p-3">
					<div class="flex items-center gap-2">
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-semibold text-fg">Extract frame</p>
							<p class="truncate text-2xs text-fg-subtle">{{ getClipName(selectedClipForFrame) }}</p>
						</div>
						<Button
							variant="ghost"
							size="icon-xs"
							title="Close"
							aria-label="Close frame extractor"
							@click="selectedClipForFrame = null"
						>
							<X />
						</Button>
					</div>
					<div class="aspect-video w-full overflow-hidden rounded-md bg-surface-sunken">
						<img v-if="framePreviewUrl" :src="framePreviewUrl" alt="Frame preview" class="size-full object-contain" />
						<div v-else class="flex size-full items-center justify-center">
							<Loader2 v-if="isExtracting" class="size-4 animate-spin text-fg-subtle" />
							<Film v-else class="size-5 text-fg-subtle" />
						</div>
					</div>
					<SliderField
						label="Timestamp"
						:model-value="frameTimestamp"
						:min="0"
						:max="selectedClipForFrame.built_duration || 60"
						:step="0.1"
						:readout="`${frameTimestamp.toFixed(1)}s`"
						@update:model-value="(v) => (frameTimestamp = v)"
						@change="updateFramePreview"
					/>
					<Button variant="primary" size="sm" block :disabled="isExtracting" @click="addExtractedFrame">
						<Loader2 v-if="isExtracting" class="animate-spin" />
						<Plus v-else />
						Add to canvas
					</Button>
				</div>

				<!-- Clip list -->
				<div class="p-3">
					<EmptyState
						v-if="filteredClips.length === 0"
						size="sm"
						:icon="searchQuery.trim() ? SearchX : Film"
						title="No built clips found"
						:description="searchQuery.trim() ? 'Try a different search term.' : 'Built clips appear here so you can grab frames.'"
					/>
					<div v-else class="-mx-1 space-y-px">
						<AssetListRow
							v-for="clip in filteredClips"
							:key="clip.id"
							:title="getClipName(clip)"
							:meta="formatDuration(clip.built_duration)"
							:selected="selectedClipForFrame?.id === clip.id"
						>
							<template #leading>
								<div class="size-8 overflow-hidden rounded-md bg-surface-sunken">
									<img
										v-if="thumbnailCache.get(clip.id)"
										:src="thumbnailCache.get(clip.id)"
										:alt="getClipName(clip)"
										class="size-full object-cover"
									/>
									<div v-else class="flex size-full items-center justify-center">
										<Film class="size-4 text-fg-subtle" />
									</div>
								</div>
							</template>
							<template #trailing>
								<Button
									v-if="clip.built_thumbnail_path"
									variant="ghost"
									size="icon-xs"
									title="Use thumbnail"
									aria-label="Add the clip thumbnail to the canvas"
									@click.stop="addClipThumbnail(clip)"
								>
									<Image />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									title="Extract frame"
									aria-label="Extract a frame from this clip"
									@click.stop="openFrameExtractor(clip)"
								>
									<Camera />
								</Button>
							</template>
						</AssetListRow>
					</div>
				</div>
			</div>
		</div>

		<!-- Gallery tab -->
		<div v-else-if="activeSubTab === 'gallery'" class="flex flex-1 flex-col overflow-hidden">
			<PanelSearchBar v-model="searchQuery" placeholder="Search images…" />

			<div class="flex-1 overflow-y-auto p-3">
				<EmptyState
					v-if="filteredGallery.length === 0"
					size="sm"
					:icon="searchQuery.trim() ? SearchX : Image"
					:title="searchQuery.trim() ? 'No images found' : 'No saved images yet'"
					:description="searchQuery.trim() ? 'Try a different search term.' : undefined"
				/>
				<AssetGrid v-else :min="80">
					<AssetTile
						v-for="img in filteredGallery"
						:key="img.id"
						aspect="1"
						:label="img.name"
						:title="`Add ${img.name} to canvas`"
						@click="addGalleryImage(img)"
					>
						<img
							v-if="thumbnailCache.get(img.id)"
							:src="thumbnailCache.get(img.id)"
							:alt="img.name"
							class="size-full object-cover"
							draggable="false"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<Image class="size-6 text-fg-subtle" />
						</div>
					</AssetTile>
				</AssetGrid>
			</div>
		</div>
	</div>
</template>
