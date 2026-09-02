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
	Pencil,
	Download,
	Upload,
	Check,
	X,
} from "lucide-vue-next";
import PageLayout from "@/components/PageLayout.vue";
import CustomDropdown from "@/components/CustomDropdown.vue";

const router = useRouter();

const images = ref<ImageAsset[]>([]);
const isLoading = ref(true);
const viewMode = ref<"grid" | "list">("grid");
const searchQuery = ref("");
const filterType = ref("all");
const thumbnailCache = ref<Map<string, string>>(new Map());
const selectedIds = ref<Set<string>>(new Set());
const isUploading = ref(false);
const isBatchExporting = ref(false);

const filterOptions = [
	{ value: "all", label: "All Types" },
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
		const { invoke } = await import("@tauri-apps/api/core");
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

function clearSelection() {
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

async function deleteOne(id: string) {
	selectedIds.value = new Set([id]);
	await deleteSelected();
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
	<div class="projects">
		<PageLayout
			title="Image Library"
			description="Manage your uploaded images and design exports"
			:show-header="true"
			:icon="ImageIcon"
		>
			<template #actions>
				<div class="projects-header-actions">
					<template v-if="hasSelection">
						<div class="projects-bulk-actions">
							<span class="projects-bulk-actions__count">{{ selectedIds.size }} selected</span>
							<button type="button" class="projects-bulk-actions__btn" :disabled="isBatchExporting" @click="batchExport">
								<Download :size="16" />
								{{ isBatchExporting ? "Exporting..." : "Export" }}
							</button>
							<button type="button" class="projects-bulk-actions__btn projects-bulk-actions__btn--danger" @click="deleteSelected">
								<Trash2 :size="16" />
								Delete
							</button>
							<button type="button" class="projects-bulk-actions__btn" @click="clearSelection">
								<X :size="16" />
								Clear
							</button>
						</div>
					</template>
					<template v-else>
						<div class="projects-header__search">
							<Search class="projects-header__search-icon" />
							<input
								v-model="searchQuery"
								type="text"
								placeholder="Search images..."
								class="projects-header__search-input"
							/>
						</div>

						<CustomDropdown
							v-model="filterType"
							:options="filterOptions"
							placeholder="Type"
							class="projects-header__filter"
							trigger-class="projects-header__dropdown-trigger"
						/>

						<div class="projects-header__view-toggle">
							<button
								type="button"
								class="projects-header__view-btn"
								:class="{ 'projects-header__view-btn--active': viewMode === 'grid' }"
								title="Grid View"
								@click="viewMode = 'grid'"
							>
								<Grid class="projects-header__view-icon" />
							</button>
							<button
								type="button"
								class="projects-header__view-btn"
								:class="{ 'projects-header__view-btn--active': viewMode === 'list' }"
								title="List View"
								@click="viewMode = 'list'"
							>
								<List class="projects-header__view-icon" />
							</button>
						</div>

						<button
							v-if="filteredImages.length > 0"
							type="button"
							class="projects-bulk-actions__btn"
							@click="selectAll"
						>
							<Check :size="16" />
							Select All
						</button>

						<button type="button" class="projects-create-btn" :disabled="isUploading" @click="uploadImages">
							<Upload class="projects-create-btn__icon" />
							{{ isUploading ? "Uploading..." : "Upload" }}
						</button>

						<button type="button" class="projects-create-btn" @click="createNew">
							<Plus class="projects-create-btn__icon" />
							New Design
						</button>
					</template>
				</div>
			</template>

			<div
				class="projects__content"
				:class="{ 'projects__content--empty': !isLoading && filteredImages.length === 0 }"
			>
				<div v-if="images.length > 0 || isLoading" class="projects__heading">
					<h1 class="projects__title">Image Library</h1>
					<p class="projects__subtitle">Manage your uploaded images and design exports</p>
				</div>

				<div v-if="isLoading" class="projects__loading">
					<div class="projects__grid">
						<div v-for="i in 6" :key="`skeleton-${i}`" class="project-card project-card--skeleton">
							<div class="project-card__skeleton-bg"></div>
							<div class="project-card__bottom">
								<div class="projects-skeleton__card-title"></div>
								<div class="projects-skeleton__card-meta"></div>
							</div>
						</div>
					</div>
				</div>

				<div v-else-if="filteredImages.length > 0" class="projects__main">
					<div v-if="viewMode === 'grid'" class="projects__grid">
						<div
							v-for="img in filteredImages"
							:key="img.id"
							class="project-card"
							:class="{ 'project-card--selected': selectedIds.has(img.id) }"
							@click="openInEditor(img)"
						>
							<div
								class="project-card__checkbox"
								:class="{ 'project-card__checkbox--visible': selectedIds.has(img.id) }"
								@click.stop="toggleSelect(img.id)"
							>
								<div
									class="project-card__checkbox-inner"
									:class="{ 'project-card__checkbox-inner--checked': selectedIds.has(img.id) }"
								>
									<Check v-if="selectedIds.has(img.id)" class="project-card__checkbox-icon" />
								</div>
							</div>

							<div
								v-if="thumbnailCache.get(img.id)"
								class="project-card__thumbnail"
								:style="{ backgroundImage: `url(${thumbnailCache.get(img.id)})` }"
							></div>
							<div v-else class="project-card__thumbnail project-card__thumbnail--empty">
								<div class="project-card__empty-icon">
									<ImageIcon class="project-card__folder-icon" />
								</div>
							</div>
							<div class="project-card__thumbnail-gradient"></div>

							<div class="project-card__bottom">
								<h3 class="project-card__title">{{ img.name }}</h3>
								<div class="project-card__meta">
									<span v-if="img.image_type" class="project-card__info">{{ img.image_type }}</span>
									<span v-if="img.image_type" class="project-card__dot"></span>
									<span class="project-card__info">{{ formatDimensions(img.width, img.height) }}</span>
									<span class="project-card__dot"></span>
									<span class="project-card__info">{{ formatDate(img.created_at) }}</span>
								</div>
							</div>

							<div class="project-card__hover-actions">
								<button
									type="button"
									class="project-card__action-btn"
									title="Edit"
									@click.stop="openInEditor(img)"
								>
									<Pencil class="project-card__action-icon" />
								</button>
								<button
									type="button"
									class="project-card__action-btn project-card__action-btn--danger"
									title="Delete"
									@click.stop="deleteOne(img.id)"
								>
									<Trash2 class="project-card__action-icon" />
								</button>
							</div>
						</div>
					</div>

					<div v-else class="image-list">
						<div
							v-for="img in filteredImages"
							:key="img.id"
							class="image-list__row"
							:class="{ 'image-list__row--selected': selectedIds.has(img.id) }"
							@click="openInEditor(img)"
						>
							<div class="image-list__check" @click.stop="toggleSelect(img.id)">
								<div
									class="project-card__checkbox-inner"
									:class="{ 'project-card__checkbox-inner--checked': selectedIds.has(img.id) }"
								>
									<Check v-if="selectedIds.has(img.id)" class="project-card__checkbox-icon" />
								</div>
							</div>

							<div class="image-list__thumb">
								<img
									v-if="thumbnailCache.get(img.id)"
									:src="thumbnailCache.get(img.id)"
									:alt="img.name"
								/>
								<ImageIcon v-else class="image-list__thumb-icon" />
							</div>

							<div class="image-list__info">
								<div class="image-list__name">{{ img.name }}</div>
								<div class="image-list__meta">
									<span v-if="img.image_type">{{ img.image_type }}</span>
									<span>{{ formatDimensions(img.width, img.height) }}</span>
									<span>{{ formatSize(img.file_size) }}</span>
									<span>{{ formatDate(img.created_at) }}</span>
								</div>
							</div>

							<div class="image-list__actions">
								<button type="button" class="image-list__action" title="Edit" @click.stop="openInEditor(img)">
									<Pencil :size="14" />
								</button>
								<button
									type="button"
									class="image-list__action image-list__action--danger"
									title="Delete"
									@click.stop="deleteOne(img.id)"
								>
									<Trash2 :size="14" />
								</button>
							</div>
						</div>
					</div>
				</div>

				<div v-else class="projects__empty">
					<div class="projects__empty-icon-wrapper">
						<ImageIcon class="projects__empty-icon" />
					</div>
					<h3 class="projects__empty-title">No images yet</h3>
					<p class="projects__empty-description">Upload images or export from the Image Editor</p>
					<button type="button" class="projects-create-btn" @click="createNew">
						<Plus class="projects-create-btn__icon" />
						Create Design
					</button>
				</div>
			</div>
		</PageLayout>
	</div>
</template>

<style scoped>
.projects {
	display: flex;
	flex-direction: column;
	height: 100%;
	width: 100%;
	overflow: hidden;
}

.projects-header-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.projects-header__search {
	position: relative;
	width: 200px;
}

.projects-header__search-icon {
	position: absolute;
	left: 0.625rem;
	top: 50%;
	transform: translateY(-50%);
	width: 14px;
	height: 14px;
	color: var(--sidebar-text-muted);
	pointer-events: none;
}

.projects-header__search-input {
	width: 100%;
	padding-left: 2rem;
	height: 32px;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 6px;
	font-size: 0.75rem;
	color: var(--sidebar-text);
}

.projects-header__search-input:focus {
	border-color: var(--sidebar-accent);
	outline: none;
}

.projects-header__filter {
	width: 140px;
}

:deep(.projects-header__dropdown-trigger) {
	height: 32px;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 6px;
	font-size: 0.75rem;
}

.projects-header__view-toggle {
	display: flex;
	align-items: center;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 6px;
	overflow: hidden;
}

.projects-header__view-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 30px;
	background: transparent;
	border: none;
	color: var(--sidebar-text-muted);
	cursor: pointer;
}

.projects-header__view-btn:hover {
	color: var(--sidebar-text);
}

.projects-header__view-btn--active {
	background-color: var(--sidebar-hover);
	color: var(--sidebar-accent);
}

.projects-header__view-icon {
	width: 14px;
	height: 14px;
}

.projects-create-btn {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	height: 32px;
	padding: 0 0.875rem;
	background-color: var(--sidebar-accent);
	color: var(--sidebar-bg);
	border: none;
	border-radius: 6px;
	font-size: 0.75rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 150ms ease;
}

.projects-create-btn:hover:not(:disabled) {
	opacity: 0.9;
}

.projects-create-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.projects-create-btn__icon {
	width: 14px;
	height: 14px;
}

.projects-bulk-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.projects-bulk-actions__count {
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin-right: 0.25rem;
}

.projects-bulk-actions__btn {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	height: 32px;
	padding: 0 0.75rem;
	background: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 6px;
	color: var(--sidebar-text);
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 150ms ease;
}

.projects-bulk-actions__btn:hover:not(:disabled) {
	border-color: var(--sidebar-accent);
	color: var(--sidebar-accent);
}

.projects-bulk-actions__btn--danger:hover:not(:disabled) {
	border-color: #ef4444;
	color: #ef4444;
}

.projects-bulk-actions__btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.projects__content {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	padding: 1.5rem;
	width: 100%;
	flex: 1;
}

.projects__content--empty {
	justify-content: center;
	align-items: center;
}

.projects__heading {
	margin-bottom: 0.5rem;
}

.projects__title {
	font-size: 1.5rem;
	font-weight: 700;
	color: var(--sidebar-text);
	margin: 0 0 0.2rem;
	letter-spacing: -0.02em;
}

.projects__subtitle {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	line-height: 1.5;
}

.projects__main {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	padding-bottom: 2rem;
}

.projects__loading {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.projects__grid {
	display: grid;
	grid-template-columns: repeat(1, 1fr);
	gap: 1.25rem;
}

@media (min-width: 1024px) {
	.projects__grid {
		grid-template-columns: repeat(2, 1fr);
	}
}

@media (min-width: 1400px) {
	.projects__grid {
		grid-template-columns: repeat(3, 1fr);
	}
}

@media (min-width: 2200px) {
	.projects__grid {
		grid-template-columns: repeat(5, 1fr);
	}
}

.project-card {
	position: relative;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 10px;
	overflow: hidden;
	cursor: pointer;
	transition: all 200ms ease;
	aspect-ratio: 16 / 9;
}

.project-card:hover {
	border-color: rgba(255, 255, 255, 0.15);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
	transform: scale(1.02);
}

.project-card--selected {
	border-color: var(--sidebar-accent);
	box-shadow: 0 0 0 1px var(--sidebar-accent);
}

.project-card--skeleton {
	pointer-events: none;
}

.project-card__skeleton-bg {
	position: absolute;
	inset: 0;
	background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-surface) 50%, var(--sidebar-hover) 75%);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
}

.projects-skeleton__card-title,
.projects-skeleton__card-meta {
	height: 12px;
	border-radius: 4px;
	background: rgba(255, 255, 255, 0.08);
}

.projects-skeleton__card-title {
	width: 60%;
	margin-bottom: 0.5rem;
}

.projects-skeleton__card-meta {
	width: 40%;
	height: 10px;
}

@keyframes shimmer {
	0% {
		background-position: 200% 0;
	}
	100% {
		background-position: -200% 0;
	}
}

.project-card__thumbnail {
	position: absolute;
	inset: 0;
	z-index: 0;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}

.project-card__thumbnail--empty {
	background-color: var(--sidebar-hover);
}

.project-card__thumbnail-gradient {
	position: absolute;
	inset: 0;
	background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.35) 45%, transparent 70%);
	z-index: 1;
	pointer-events: none;
}

.project-card__empty-icon {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0.2;
}

.project-card__folder-icon {
	width: 64px;
	height: 64px;
	color: var(--sidebar-text);
}

.project-card__bottom {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 5;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.project-card__title {
	font-size: 1rem;
	font-weight: 700;
	color: white;
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	line-height: 1.3;
}

.project-card__meta {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.75rem;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.7);
	flex-wrap: wrap;
}

.project-card__info {
	color: rgba(255, 255, 255, 0.7);
}

.project-card__dot {
	width: 3px;
	height: 3px;
	border-radius: 50%;
	background-color: rgba(255, 255, 255, 0.4);
	flex-shrink: 0;
}

.project-card__checkbox {
	position: absolute;
	top: 1rem;
	right: 1rem;
	z-index: 30;
	opacity: 0;
	transition: opacity 150ms ease;
}

.project-card:hover .project-card__checkbox,
.project-card__checkbox--visible {
	opacity: 1;
}

.project-card__checkbox-inner {
	width: 24px;
	height: 24px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: rgba(0, 0, 0, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.45);
	color: white;
	cursor: pointer;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	transition: all 150ms ease;
}

.project-card__checkbox-inner--checked {
	background-color: var(--sidebar-accent);
	border-color: var(--sidebar-accent);
	color: var(--sidebar-bg);
}

.project-card__checkbox-icon {
	width: 16px;
	height: 16px;
}

.project-card__hover-actions {
	position: absolute;
	inset: 0;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	background-color: rgba(0, 0, 0, 0.4);
	opacity: 0;
	transition: opacity 200ms ease;
}

.project-card:hover .project-card__hover-actions {
	opacity: 1;
}

.project-card__action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.5rem;
	background-color: rgba(255, 255, 255, 0.9);
	border: none;
	border-radius: 9999px;
	color: #1f2937;
	cursor: pointer;
	transition: all 150ms ease;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.project-card__action-btn:hover {
	background-color: white;
	transform: scale(1.1);
}

.project-card__action-btn--danger:hover {
	background-color: #fecaca;
	color: #dc2626;
}

.project-card__action-icon {
	width: 20px;
	height: 20px;
}

.projects__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	gap: 0.75rem;
}

.projects__empty-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 72px;
	height: 72px;
	background-color: var(--sidebar-hover);
	border-radius: 16px;
	margin-bottom: 0.5rem;
}

.projects__empty-icon {
	width: 32px;
	height: 32px;
	color: var(--sidebar-text-muted);
}

.projects__empty-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0;
}

.projects__empty-description {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0 0 0.5rem;
}

.image-list {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.image-list__row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.625rem 0.75rem;
	border: 1px solid var(--sidebar-border);
	border-radius: 8px;
	background: var(--sidebar-surface);
	cursor: pointer;
	transition: all 150ms ease;
}

.image-list__row:hover {
	border-color: rgba(255, 255, 255, 0.15);
	background: var(--sidebar-hover);
}

.image-list__row--selected {
	border-color: var(--sidebar-accent);
	box-shadow: inset 0 0 0 1px var(--sidebar-accent);
}

.image-list__check {
	flex-shrink: 0;
}

.image-list__thumb {
	width: 48px;
	height: 48px;
	border-radius: 6px;
	overflow: hidden;
	background: var(--sidebar-hover);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.image-list__thumb img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.image-list__thumb-icon {
	width: 18px;
	height: 18px;
	color: var(--sidebar-text-muted);
	opacity: 0.5;
}

.image-list__info {
	min-width: 0;
	flex: 1;
}

.image-list__name {
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--sidebar-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.image-list__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-top: 0.2rem;
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
}

.image-list__actions {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	opacity: 0;
	transition: opacity 150ms ease;
}

.image-list__row:hover .image-list__actions {
	opacity: 1;
}

.image-list__action {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--sidebar-text-muted);
	cursor: pointer;
}

.image-list__action:hover {
	background: rgba(255, 255, 255, 0.08);
	color: var(--sidebar-text);
}

.image-list__action--danger:hover {
	color: #ef4444;
}
</style>
