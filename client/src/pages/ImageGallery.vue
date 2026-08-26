<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { getAllImageAssets, deleteImageAsset } from "@/services/database/image-assets";
import type { ImageAsset } from "@/services/database/types";
import {
	Image as ImageIcon,
	Plus,
	Trash2,
	Search,
	Grid,
	List,
	Loader2,
	FolderOpen,
	Pencil,
	Download,
	Filter,
	Upload,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const router = useRouter();

const images = ref<ImageAsset[]>([]);
const isLoading = ref(true);
const viewMode = ref<"grid" | "list">("grid");
const searchQuery = ref("");
const filterType = ref<string>("all");
const thumbnailCache = ref<Map<string, string>>(new Map());
const selectedIds = ref<Set<string>>(new Set());

const filterOptions = [
	{ value: "all", label: "All" },
	{ value: "thumbnail", label: "Thumbnails" },
	{ value: "cover", label: "Covers" },
	{ value: "watermark", label: "Watermarks" },
	{ value: "logo", label: "Logos" },
	{ value: "overlay", label: "Overlays" },
	{ value: "social", label: "Social" },
	{ value: "custom", label: "Custom" },
	{ value: "source:ai_generated", label: "AI Generated" },
	{ value: "source:upload", label: "Uploads" },
	{ value: "source:editor", label: "Editor Exports" },
];

const filteredImages = computed(() => {
	let result = images.value;
	if (filterType.value.startsWith("source:")) {
		const source = filterType.value.slice("source:".length);
		result = result.filter((img) => img.source_type === source);
	} else if (filterType.value !== "all") {
		result = result.filter((img) => img.image_type === filterType.value);
	}
	if (searchQuery.value.trim()) {
		const q = searchQuery.value.toLowerCase();
		result = result.filter((img) => img.name.toLowerCase().includes(q));
	}
	return result;
});

const hasSelection = computed(() => selectedIds.value.size > 0);

onMounted(async () => {
	await loadImages();
});

async function loadImages() {
	isLoading.value = true;
	try {
		images.value = await getAllImageAssets();
		// Load thumbnails
		for (const img of images.value) {
			if (img.file_path && !thumbnailCache.value.has(img.id)) {
				try {
					const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: img.file_path });
					thumbnailCache.value.set(img.id, dataUrl);
				} catch {
					/* skip broken files */
				}
			}
		}
	} catch (err) {
		console.error("[ImageGallery] Failed to load images:", err);
	} finally {
		isLoading.value = false;
	}
}

function openInEditor(image: ImageAsset) {
	try {
		const meta = image.editor_project_json ? JSON.parse(image.editor_project_json) : null;
		const backendId = meta?.backendProjectId ?? (image.source_project_id ? Number(image.source_project_id) : NaN);
		if (Number.isFinite(backendId)) {
			router.push({ path: "/design-studio", query: { projectId: String(backendId) } });
			return;
		}
	} catch {
		/* fall through */
	}
	router.push({ path: "/design-studio" });
}

function createNew() {
	router.push({ path: "/design-studio" });
}

const isUploading = ref(false);

async function uploadImages() {
	if (isUploading.value) return;
	isUploading.value = true;
	try {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const { copyFile, mkdir, exists, stat } = await import("@tauri-apps/plugin-fs");
		const { appDataDir } = await import("@tauri-apps/api/path");
		const { createImageAsset } = await import("@/services/database/image-assets");

		const selected = await open({
			multiple: true,
			filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
		});
		if (!selected) return;

		const paths = Array.isArray(selected) ? selected : [selected];
		const appData = await appDataDir();
		const destDir = `${appData}/image-library`;
		if (!(await exists(destDir))) {
			await mkdir(destDir, { recursive: true });
		}

		for (const src of paths) {
			const base = src.split(/[/\\]/).pop() || `upload-${Date.now()}.png`;
			const dest = `${destDir}/${Date.now()}_${base}`;
			await copyFile(src, dest);
			let fileSize: number | undefined;
			try {
				const s = await stat(dest);
				fileSize = Number(s.size);
			} catch {
				/* optional */
			}
			const ext = base.split(".").pop()?.toLowerCase();
			const mime =
				ext === "jpg" || ext === "jpeg"
					? "image/jpeg"
					: ext === "webp"
						? "image/webp"
						: ext === "gif"
							? "image/gif"
							: "image/png";
			await createImageAsset({
				name: base.replace(/\.[^.]+$/, ""),
				filePath: dest,
				fileSize,
				mimeType: mime,
				imageType: "custom",
				sourceType: "upload",
				exportFormat: ext === "jpg" || ext === "jpeg" ? "jpg" : (ext as any) || "png",
			});
		}
		await loadImages();
	} catch (err) {
		console.error("[ImageGallery] Upload failed:", err);
	} finally {
		isUploading.value = false;
	}
}

function toggleSelect(id: string) {
	const s = new Set(selectedIds.value);
	if (s.has(id)) {
		s.delete(id);
	} else {
		s.add(id);
	}
	selectedIds.value = s;
}

function selectAll() {
	selectedIds.value = new Set(filteredImages.value.map((img) => img.id));
}

function deselectAll() {
	selectedIds.value = new Set();
}

async function deleteSelected() {
	const ids = Array.from(selectedIds.value);
	for (const id of ids) {
		try {
			await deleteImageAsset(id);
		} catch (err) {
			console.error("[ImageGallery] Failed to delete image:", id, err);
		}
	}
	selectedIds.value = new Set();
	await loadImages();
}

const isBatchExporting = ref(false);

async function batchExport() {
	if (isBatchExporting.value || selectedIds.value.size === 0) return;
	isBatchExporting.value = true;

	try {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const { copyFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

		const destDir = await open({ directory: true, title: "Select export folder" });
		if (!destDir) {
			isBatchExporting.value = false;
			return;
		}

		const selectedImages = images.value.filter((img) => selectedIds.value.has(img.id));
		let exported = 0;

		for (const img of selectedImages) {
			if (!img.file_path) continue;
			try {
				const ext = img.file_path.split(".").pop() || "png";
				const safeName = img.name.replace(/[^a-zA-Z0-9_-]/g, "_");
				const destPath = `${destDir}/${safeName}_${img.id.slice(0, 8)}.${ext}`;
				await copyFile(img.file_path, destPath);
				exported++;
			} catch (err) {
				console.warn("[ImageGallery] Failed to export image:", img.id, err);
			}
		}

		console.log(`[ImageGallery] Exported ${exported}/${selectedImages.length} images`);
	} catch (err) {
		console.error("[ImageGallery] Batch export failed:", err);
	} finally {
		isBatchExporting.value = false;
	}
}

function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatSize(bytes: number | null): string {
	if (!bytes) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(w: number | null, h: number | null): string {
	if (!w || !h) return "—";
	return `${w}×${h}`;
}
</script>

<template>
	<div class="flex h-full flex-col bg-zinc-950 text-zinc-200">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
			<div>
				<h1 class="text-lg font-semibold">Image Library</h1>
				<p class="text-xs text-zinc-500">{{ filteredImages.length }} image{{ filteredImages.length !== 1 ? "s" : "" }}</p>
			</div>
			<div class="flex items-center gap-2">
				<template v-if="hasSelection">
					<button
						type="button"
						class="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
						@click="deselectAll"
					>
						Deselect All
					</button>
					<Button variant="outline" size="sm" :disabled="isBatchExporting" @click="batchExport">
						<Download class="mr-1 size-3.5" />
						{{ isBatchExporting ? 'Exporting...' : `Export (${selectedIds.size})` }}
					</Button>
					<Button variant="destructive" size="sm" @click="deleteSelected">
						<Trash2 class="mr-1 size-3.5" />
						Delete ({{ selectedIds.size }})
					</Button>
				</template>
				<button
					v-if="filteredImages.length > 0 && !hasSelection"
					type="button"
					class="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
					@click="selectAll"
				>
					Select All
				</button>
				<Button variant="outline" size="sm" :disabled="isUploading" @click="uploadImages">
					<Upload class="mr-1 size-3.5" />
					{{ isUploading ? 'Uploading...' : 'Upload' }}
				</Button>
				<Button size="sm" @click="createNew">
					<Plus class="mr-1 size-3.5" />
					New Design
				</Button>
			</div>
		</div>

		<!-- Toolbar -->
		<div class="flex items-center gap-3 border-b border-white/10 px-6 py-2">
			<!-- Search -->
			<div class="flex flex-1 items-center gap-2 rounded-md bg-white/5 px-3 py-1.5">
				<Search class="size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search images..."
					class="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
				/>
			</div>

			<!-- Filter -->
			<div class="flex items-center gap-1">
				<Filter class="size-3.5 text-zinc-500" />
				<select
					v-model="filterType"
					class="rounded bg-white/5 px-2 py-1 text-xs text-zinc-300 outline-none"
				>
					<option v-for="opt in filterOptions" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</div>

			<!-- View toggle -->
			<div class="flex items-center rounded-md bg-white/5">
				<button
					type="button"
					:class="['rounded-l-md px-2 py-1.5', viewMode === 'grid' ? 'bg-purple-600/30 text-purple-400' : 'text-zinc-500 hover:text-zinc-300']"
					@click="viewMode = 'grid'"
				>
					<Grid class="size-3.5" />
				</button>
				<button
					type="button"
					:class="['rounded-r-md px-2 py-1.5', viewMode === 'list' ? 'bg-purple-600/30 text-purple-400' : 'text-zinc-500 hover:text-zinc-300']"
					@click="viewMode = 'list'"
				>
					<List class="size-3.5" />
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			<!-- Loading -->
			<div v-if="isLoading" class="flex items-center justify-center py-20">
				<Loader2 class="size-6 animate-spin text-zinc-500" />
			</div>

			<!-- Empty state -->
			<div v-else-if="filteredImages.length === 0" class="flex flex-col items-center justify-center py-20 gap-3">
				<div class="rounded-full bg-white/5 p-4">
					<ImageIcon class="size-8 text-zinc-600" />
				</div>
				<p class="text-sm text-zinc-500">No images yet</p>
				<p class="text-xs text-zinc-600">Upload images or export from the Image Editor</p>
				<Button size="sm" class="mt-2" @click="createNew">
					<Plus class="mr-1 size-3.5" />
					Create Design
				</Button>
			</div>

			<!-- Grid view -->
			<div
				v-else-if="viewMode === 'grid'"
				class="grid gap-4"
				style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))"
			>
				<div
					v-for="img in filteredImages"
					:key="img.id"
					class="group relative overflow-hidden rounded-lg border transition-all cursor-pointer"
					:class="selectedIds.has(img.id) ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-white/10 hover:border-white/20'"
					@click="openInEditor(img)"
				>
					<!-- Checkbox -->
					<div
						class="absolute top-2 left-2 z-10"
						@click.stop="toggleSelect(img.id)"
					>
						<div
							:class="[
								'size-5 rounded border flex items-center justify-center transition-colors',
								selectedIds.has(img.id)
									? 'bg-purple-600 border-purple-600'
									: 'border-white/20 bg-black/40 opacity-0 group-hover:opacity-100',
							]"
						>
							<svg v-if="selectedIds.has(img.id)" class="size-3 text-white" viewBox="0 0 12 12" fill="none">
								<path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					</div>

					<!-- Thumbnail -->
					<div class="aspect-video bg-zinc-900 flex items-center justify-center">
						<img
							v-if="thumbnailCache.get(img.id)"
							:src="thumbnailCache.get(img.id)"
							:alt="img.name"
							class="h-full w-full object-cover"
						/>
						<ImageIcon v-else class="size-8 text-zinc-800" />
					</div>

					<!-- Info -->
					<div class="p-3">
						<div class="truncate text-sm font-medium text-zinc-200">{{ img.name }}</div>
						<div class="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
							<span v-if="img.image_type" class="rounded bg-white/5 px-1.5 py-0.5">{{ img.image_type }}</span>
							<span>{{ formatDimensions(img.width, img.height) }}</span>
							<span>{{ formatSize(img.file_size) }}</span>
						</div>
						<div class="mt-1 text-[10px] text-zinc-600">{{ formatDate(img.created_at) }}</div>
					</div>

					<!-- Hover actions -->
					<div class="absolute top-2 right-2 hidden items-center gap-1 group-hover:flex">
						<button
							type="button"
							class="rounded bg-black/60 p-1 text-zinc-400 hover:text-white"
							title="Edit"
							@click.stop="openInEditor(img)"
						>
							<Pencil class="size-3.5" />
						</button>
						<button
							type="button"
							class="rounded bg-black/60 p-1 text-zinc-400 hover:text-red-400"
							title="Delete"
							@click.stop="() => { selectedIds = new Set([img.id]); deleteSelected(); }"
						>
							<Trash2 class="size-3.5" />
						</button>
					</div>
				</div>
			</div>

			<!-- List view -->
			<div v-else class="space-y-1">
				<div
					v-for="img in filteredImages"
					:key="img.id"
					class="group flex items-center gap-3 rounded-lg border px-3 py-2 transition-all cursor-pointer"
					:class="selectedIds.has(img.id) ? 'border-purple-500 bg-purple-500/5' : 'border-white/5 hover:bg-white/5'"
					@click="openInEditor(img)"
				>
					<!-- Checkbox -->
					<div @click.stop="toggleSelect(img.id)">
						<div
							:class="[
								'size-4 rounded border flex items-center justify-center transition-colors',
								selectedIds.has(img.id)
									? 'bg-purple-600 border-purple-600'
									: 'border-white/20',
							]"
						>
							<svg v-if="selectedIds.has(img.id)" class="size-2.5 text-white" viewBox="0 0 12 12" fill="none">
								<path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					</div>

					<!-- Thumbnail -->
					<div class="size-10 shrink-0 overflow-hidden rounded bg-zinc-900 flex items-center justify-center">
						<img
							v-if="thumbnailCache.get(img.id)"
							:src="thumbnailCache.get(img.id)"
							:alt="img.name"
							class="h-full w-full object-cover"
						/>
						<ImageIcon v-else class="size-4 text-zinc-700" />
					</div>

					<!-- Info -->
					<div class="min-w-0 flex-1">
						<div class="truncate text-xs font-medium text-zinc-200">{{ img.name }}</div>
						<div class="flex items-center gap-2 text-[10px] text-zinc-500">
							<span v-if="img.image_type" class="rounded bg-white/5 px-1 py-0.5">{{ img.image_type }}</span>
							<span>{{ formatDimensions(img.width, img.height) }}</span>
						</div>
					</div>

					<div class="text-[10px] text-zinc-600">{{ formatSize(img.file_size) }}</div>
					<div class="text-[10px] text-zinc-600">{{ formatDate(img.created_at) }}</div>

					<!-- Actions -->
					<div class="hidden items-center gap-1 group-hover:flex">
						<button
							type="button"
							class="rounded p-1 text-zinc-500 hover:text-white"
							title="Edit"
							@click.stop="openInEditor(img)"
						>
							<Pencil class="size-3.5" />
						</button>
						<button
							type="button"
							class="rounded p-1 text-zinc-500 hover:text-red-400"
							title="Delete"
							@click.stop="() => { selectedIds = new Set([img.id]); deleteSelected(); }"
						>
							<Trash2 class="size-3.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
