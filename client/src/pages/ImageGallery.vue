<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
	getAllImageAssets,
	deleteImageAsset,
	markImageAsPublished,
} from "@/services/database/image-assets";
import type { ImageAsset } from "@/services/database/types";
import {
	Image as ImageIcon,
	ImageOff,
	Plus,
	Trash2,
	LayoutGrid,
	List,
	Pencil,
	Download,
	Upload,
	Check,
	Share2,
} from "lucide-vue-next";
import PageLayout from "@/components/PageLayout.vue";
import CustomDropdown from "@/components/CustomDropdown.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import SimplifiedPublishDialog from "@/components/SimplifiedPublishDialog.vue";
import { MediaTile } from "@/components/ui/media-tile";
import { SelectionBar } from "@/components/ui/selection-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { formatDate } from "@/utils/dateTimeUtils";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const { showToast } = useToast();

const images = ref<ImageAsset[]>([]);
const isLoading = ref(true);
const viewMode = ref<"grid" | "list">("grid");
const searchQuery = ref("");
const filterType = ref("all");
const sortBy = ref("created-desc");
const thumbnailCache = ref<Map<string, string>>(new Map());
const selectedIds = ref<Set<string>>(new Set());
const isUploading = ref(false);
const isBatchExporting = ref(false);

const showDeleteDialog = ref(false);
const showBulkDeleteDialog = ref(false);
const imageToDelete = ref<ImageAsset | null>(null);

const showPublishDialog = ref(false);
const publishingImage = ref<ImageAsset | null>(null);

const filterOptions = [
	{ value: "all", label: "All types" },
	{ value: "thumbnail", label: "Thumbnails" },
	{ value: "cover", label: "Covers" },
	{ value: "watermark", label: "Watermarks" },
	{ value: "logo", label: "Logos" },
	{ value: "overlay", label: "Overlays" },
	{ value: "social", label: "Social" },
	{ value: "custom", label: "Custom" },
	{ value: "source:ai_generated", label: "AI generated" },
	{ value: "source:upload", label: "Uploads" },
	{ value: "source:editor", label: "Editor exports" },
];

const viewOptions: SegmentedOption<"grid" | "list">[] = [
	{ value: "grid", icon: LayoutGrid, title: "Grid view" },
	{ value: "list", icon: List, title: "List view" },
];

const sortOptions = [
	{ label: "Newest first", value: "created-desc" },
	{ label: "Oldest first", value: "created-asc" },
	{ label: "Name A–Z", value: "name-asc" },
	{ label: "Name Z–A", value: "name-desc" },
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

	const sorted = [...result];
	switch (sortBy.value) {
		case "created-asc":
			sorted.sort((a, b) => a.created_at - b.created_at);
			break;
		case "name-asc":
			sorted.sort((a, b) => a.name.localeCompare(b.name));
			break;
		case "name-desc":
			sorted.sort((a, b) => b.name.localeCompare(a.name));
			break;
		case "created-desc":
		default:
			sorted.sort((a, b) => b.created_at - a.created_at);
			break;
	}
	return sorted;
});

const groupedImages = computed(() => {
	const items = filteredImages.value;
	if (sortBy.value.startsWith("name")) {
		return [{ dateLabel: "Images", images: items }];
	}

	const groups: { dateLabel: string; images: ImageAsset[] }[] = [];
	let currentLabel = "";
	let currentImages: ImageAsset[] = [];

	for (const img of items) {
		const label = getDateLabel(img.created_at);
		if (label !== currentLabel) {
			if (currentLabel) {
				groups.push({ dateLabel: currentLabel, images: currentImages });
			}
			currentLabel = label;
			currentImages = [img];
		} else {
			currentImages.push(img);
		}
	}

	if (currentLabel) {
		groups.push({ dateLabel: currentLabel, images: currentImages });
	} else if (items.length > 0) {
		groups.push({ dateLabel: "Images", images: items });
	}

	return groups;
});

const hasSelection = computed(() => selectedIds.value.size > 0);

const publishingAspectRatio = computed(() => {
	if (!publishingImage.value) return "1:1";
	return aspectRatioFromDimensions(publishingImage.value.width, publishingImage.value.height);
});

onMounted(async () => {
	await loadImages();
});

async function loadImages() {
	isLoading.value = true;
	try {
		images.value = await getAllImageAssets();
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

function getDateLabel(timestamp: number): string {
	const d = new Date(timestamp * 1000);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const imageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

	if (imageDate.getTime() === today.getTime()) return "Today";
	if (imageDate.getTime() === yesterday.getTime()) return "Yesterday";
	return formatDate(d);
}

function aspectRatioFromDimensions(w: number | null, h: number | null): string {
	if (!w || !h) return "1:1";
	const common: [number, number][] = [
		[16, 9],
		[9, 16],
		[4, 5],
		[5, 4],
		[1, 1],
		[4, 3],
		[3, 4],
		[21, 9],
	];
	const ratio = w / h;
	let best = "1:1";
	let bestDiff = Infinity;
	for (const [a, b] of common) {
		const diff = Math.abs(ratio - a / b);
		if (diff < bestDiff) {
			bestDiff = diff;
			best = `${a}:${b}`;
		}
	}
	return best;
}

function isPublished(img: ImageAsset): boolean {
	return Boolean(img.is_published);
}

function openInEditor(image: ImageAsset) {
	try {
		const meta = image.editor_project_json ? JSON.parse(image.editor_project_json) : null;
		const backendId = meta?.backendProjectId ?? (image.source_project_id ? Number(image.source_project_id) : NaN);
		if (Number.isFinite(backendId)) {
			router.push({ path: "/design-studio/edit", query: { projectId: String(backendId) } });
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

async function uploadImages() {
	if (isUploading.value) return;
	isUploading.value = true;
	try {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const { copyFile, mkdir, exists, stat } = await import("@tauri-apps/plugin-fs");
		const { createImageAsset } = await import("@/services/database/image-assets");

		const selected = await open({
			multiple: true,
			filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
		});
		if (!selected) return;

		const paths = Array.isArray(selected) ? selected : [selected];
		const appData = await invoke<string>("get_app_data_dir");
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
				exportFormat: ext === "jpg" || ext === "jpeg" ? "jpg" : ext === "webp" ? "webp" : "png",
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

function clearSelection() {
	selectedIds.value = new Set();
}

function confirmDeleteOne(img: ImageAsset) {
	imageToDelete.value = img;
	showDeleteDialog.value = true;
}

function confirmBulkDelete() {
	if (selectedIds.value.size === 0) return;
	showBulkDeleteDialog.value = true;
}

async function deleteOneConfirmed() {
	if (!imageToDelete.value) return;
	try {
		await deleteImageAsset(imageToDelete.value.id);
		thumbnailCache.value.delete(imageToDelete.value.id);
		selectedIds.value.delete(imageToDelete.value.id);
		selectedIds.value = new Set(selectedIds.value);
		await loadImages();
		showToast("Image deleted", "success");
	} catch (err) {
		console.error("[ImageGallery] Failed to delete image:", err);
		showToast("Failed to delete image", "error");
	} finally {
		showDeleteDialog.value = false;
		imageToDelete.value = null;
	}
}

async function bulkDeleteConfirmed() {
	const ids = Array.from(selectedIds.value);
	for (const id of ids) {
		try {
			await deleteImageAsset(id);
			thumbnailCache.value.delete(id);
		} catch (err) {
			console.error("[ImageGallery] Failed to delete image:", id, err);
		}
	}
	selectedIds.value = new Set();
	showBulkDeleteDialog.value = false;
	await loadImages();
	showToast(`Deleted ${ids.length} image${ids.length !== 1 ? "s" : ""}`, "success");
}

async function downloadImage(img: ImageAsset) {
	if (!img.file_path) {
		showToast("No file path available", "error");
		return;
	}

	try {
		const ext = img.file_path.split(".").pop() || "png";
		const safeName = img.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "image";
		const destinationPath = await save({
			title: "Save Image As",
			defaultPath: `${safeName}.${ext}`,
			filters: [
				{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
				{ name: "All Files", extensions: ["*"] },
			],
		});
		if (!destinationPath) return;

		await invoke("copy_clip_to_destination", {
			sourcePath: img.file_path,
			destinationPath,
		});
		showToast("Image saved", "success");
	} catch (err) {
		console.error("[ImageGallery] Failed to save image:", err);
		showToast("Could not save the image file", "error");
	}
}

function initiatePublish(img: ImageAsset) {
	if (!img.file_path) {
		showToast("No file path available", "error");
		return;
	}
	publishingImage.value = img;
	showPublishDialog.value = true;
}

async function onImagePublished() {
	if (publishingImage.value) {
		try {
			await markImageAsPublished(publishingImage.value.id);
		} catch (err) {
			console.error("[ImageGallery] Failed to mark image published:", err);
		}
	}
	showPublishDialog.value = false;
	publishingImage.value = null;
	await loadImages();
}

function onPublishDialogClose() {
	showPublishDialog.value = false;
	publishingImage.value = null;
}

async function batchExport() {
	if (isBatchExporting.value || selectedIds.value.size === 0) return;
	isBatchExporting.value = true;

	try {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const { copyFile } = await import("@tauri-apps/plugin-fs");

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

		showToast(`Exported ${exported}/${selectedImages.length} images`, "success");
	} catch (err) {
		console.error("[ImageGallery] Batch export failed:", err);
		showToast("Export failed", "error");
	} finally {
		isBatchExporting.value = false;
	}
}

function formatDisplayDate(ts: number): string {
	return formatDate(ts);
}

function formatSize(bytes: number | null): string {
	if (!bytes) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(type: string | null | undefined): string {
	if (!type) return "";
	return type.charAt(0).toUpperCase() + type.slice(1);
}

function tileFit(img: ImageAsset): "cover" | "contain" {
	return img.image_type === "logo" || img.image_type === "watermark" ? "contain" : "cover";
}

const isFiltered = computed(() => searchQuery.value.trim() !== "" || filterType.value !== "all");

function resetFilters() {
	searchQuery.value = "";
	filterType.value = "all";
}

function formatDimensions(w: number | null, h: number | null): string {
	if (!w || !h) return "—";
	return `${w}×${h}`;
}
</script>

<template>
	<div class="h-full">
		<PageLayout
			title="Image library"
			description="Manage your uploaded images and design exports"
			:show-header="true"
			:icon="ImageIcon"
		>
			<template #actions>
				<Button variant="secondary" :loading="isUploading" @click="uploadImages">
					<Upload v-if="!isUploading" />
					{{ isUploading ? "Uploading…" : "Upload" }}
				</Button>
				<Button variant="primary" @click="createNew"><Plus /> New design</Button>
			</template>

			<template v-if="images.length > 0" #toolbar>
				<SelectionBar
					v-if="hasSelection"
					:count="selectedIds.size"
					:total="filteredImages.length"
					@clear="clearSelection"
					@select-all="selectAll"
				>
					<Button variant="secondary" size="sm" :loading="isBatchExporting" @click="batchExport">
						<Download v-if="!isBatchExporting" />
						{{ isBatchExporting ? "Exporting…" : "Export" }}
					</Button>
					<Button variant="destructive-soft" size="sm" @click="confirmBulkDelete"><Trash2 /> Delete</Button>
				</SelectionBar>
				<template v-else>
					<SearchField v-model="searchQuery" placeholder="Search images…" class="min-w-[120px] max-w-64 flex-1" />
					<div class="w-32 shrink-0">
						<CustomDropdown v-model="filterType" :options="filterOptions" placeholder="Type" />
					</div>
					<div class="w-36 shrink-0">
						<CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
					</div>
					<SegmentedControl v-model="viewMode" :options="viewOptions" class="ml-auto" />
				</template>
			</template>

			<!-- Loading (first load only; reloads after upload/delete keep the grid) -->
			<div v-if="isLoading && !images.length" class="skeleton-group px-5 py-4" aria-busy="true">
				<div class="skeleton mb-3 h-4 w-20" />
				<div class="card-grid">
					<div v-for="i in 6" :key="`skeleton-${i}`" class="flex flex-col gap-2">
						<div class="skeleton aspect-video rounded-xl" />
						<div class="skeleton h-3.5 w-2/3" />
						<div class="skeleton h-3 w-1/2" />
					</div>
				</div>
			</div>

			<!-- Images -->
			<div v-else-if="filteredImages.length > 0" :key="viewMode" class="flex animate-enter flex-col gap-6 px-5 py-4">
				<section v-for="group in groupedImages" :key="group.dateLabel">
					<SectionHeader :title="group.dateLabel" :count="group.images.length" class="mb-3" />

					<div v-if="viewMode === 'grid'" class="card-grid">
						<MediaTile
							v-for="img in group.images"
							:key="img.id"
							:title="img.name"
							:thumbnail="thumbnailCache.get(img.id)"
							:fit="tileFit(img)"
							:meta="[typeLabel(img.image_type), formatDimensions(img.width, img.height), formatDisplayDate(img.created_at)]"
							selectable
							:selected="selectedIds.has(img.id)"
							@open="openInEditor(img)"
							@toggle-select="toggleSelect(img.id)"
						>
							<template v-if="isPublished(img)" #badges>
								<Badge variant="success" class="bg-surface-raised"><Check /> Published</Badge>
							</template>
							<template #actions>
								<Button variant="secondary" size="icon-xs" title="Edit" aria-label="Edit" @click.stop="openInEditor(img)">
									<Pencil />
								</Button>
								<Button
									variant="secondary"
									size="icon-xs"
									title="Download"
									aria-label="Download"
									@click.stop="downloadImage(img)"
								>
									<Download />
								</Button>
								<Button
									variant="secondary"
									size="icon-xs"
									title="Publish"
									aria-label="Publish"
									@click.stop="initiatePublish(img)"
								>
									<Share2 />
								</Button>
								<Button
									variant="secondary"
									size="icon-xs"
									class="hover:text-danger"
									title="Delete"
									aria-label="Delete"
									@click.stop="confirmDeleteOne(img)"
								>
									<Trash2 />
								</Button>
							</template>
						</MediaTile>
					</div>

					<div
						v-else
						class="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-surface"
					>
						<div
							v-for="img in group.images"
							:key="img.id"
							class="group flex cursor-pointer items-center gap-3 px-3 py-1.5 transition-colors hover:bg-surface-hover"
							:class="{ 'bg-brand-soft hover:bg-brand-soft': selectedIds.has(img.id) }"
							@click="openInEditor(img)"
						>
							<Checkbox
								:model-value="selectedIds.has(img.id)"
								:aria-label="`Select ${img.name}`"
								@click.stop
								@update:model-value="toggleSelect(img.id)"
							/>

							<div class="grid h-8 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken">
								<img
									v-if="thumbnailCache.get(img.id)"
									:src="thumbnailCache.get(img.id)"
									:alt="img.name"
									class="size-full"
									:class="tileFit(img) === 'contain' ? 'object-contain p-1' : 'object-cover'"
								/>
								<ImageIcon v-else class="size-4 text-fg-subtle" />
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex min-w-0 items-center gap-2">
									<span class="truncate text-sm font-medium text-fg">{{ img.name }}</span>
									<Badge v-if="isPublished(img)" variant="success"><Check /> Published</Badge>
								</div>
								<div class="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-fg-subtle">
									<template v-if="img.image_type">
										<span class="shrink-0">{{ typeLabel(img.image_type) }}</span>
										<span aria-hidden="true" class="text-fg-disabled">·</span>
									</template>
									<span class="tabular shrink-0">{{ formatDimensions(img.width, img.height) }}</span>
									<span aria-hidden="true" class="text-fg-disabled">·</span>
									<span class="tabular shrink-0">{{ formatSize(img.file_size) }}</span>
									<span aria-hidden="true" class="text-fg-disabled">·</span>
									<span class="truncate">{{ formatDisplayDate(img.created_at) }}</span>
								</div>
							</div>

							<div
								class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
							>
								<Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit" @click.stop="openInEditor(img)">
									<Pencil />
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									title="Download"
									aria-label="Download"
									@click.stop="downloadImage(img)"
								>
									<Download />
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									title="Publish"
									aria-label="Publish"
									@click.stop="initiatePublish(img)"
								>
									<Share2 />
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									class="hover:text-danger"
									title="Delete"
									aria-label="Delete"
									@click.stop="confirmDeleteOne(img)"
								>
									<Trash2 />
								</Button>
							</div>
						</div>
					</div>
				</section>
			</div>

			<!-- No matches -->
			<EmptyState
				v-else-if="images.length > 0 && isFiltered"
				:icon="ImageOff"
				title="No matching images"
				description="Try a different search or type filter."
			>
				<Button variant="secondary" @click="resetFilters">Clear filters</Button>
			</EmptyState>

			<!-- Empty -->
			<EmptyState
				v-else
				:icon="ImageIcon"
				title="No images yet"
				description="Upload images or export from the Image Editor"
			>
				<Button variant="secondary" @click="createNew"><Plus /> Create design</Button>
			</EmptyState>
		</PageLayout>

		<ConfirmationModal
			:show="showDeleteDialog"
			title="Delete image"
			message="Are you sure you want to delete"
			:item-name="imageToDelete ? imageToDelete.name : 'this image'"
			suffix="? The image file will be permanently removed."
			confirm-text="Delete image"
			variant="destructive"
			@close="showDeleteDialog = false; imageToDelete = null"
			@confirm="deleteOneConfirmed"
		/>

		<ConfirmationModal
			:show="showBulkDeleteDialog"
			:title="`Delete ${selectedIds.size} image${selectedIds.size !== 1 ? 's' : ''}`"
			:message="`Delete ${selectedIds.size} image${selectedIds.size !== 1 ? 's' : ''}? The image files will be permanently removed.`"
			suffix=""
			:confirm-text="`Delete ${selectedIds.size} image${selectedIds.size !== 1 ? 's' : ''}`"
			variant="destructive"
			@close="showBulkDeleteDialog = false"
			@confirm="bulkDeleteConfirmed"
		/>

		<SimplifiedPublishDialog
			v-if="publishingImage?.file_path"
			v-model="showPublishDialog"
			:file-path="publishingImage.file_path"
			:thumbnail-url="publishingImage.file_path"
			media-type="image"
			:title="publishingImage.name"
			:aspect-ratio="publishingAspectRatio"
			@published="onImagePublished"
			@close="onPublishDialogClose"
		/>
	</div>
</template>
