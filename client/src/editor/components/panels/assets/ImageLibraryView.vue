<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { getAllImageAssets } from "@/services/database/image-assets";
import { listProjects, type ProjectSummary } from "@/services/imageEditorApi";
import type { ImageAsset } from "@/services/database/types";
import { useEditor } from "../../../composables/useEditor";
import { processMediaAssets } from "../../../lib/media/processing";
import { buildImageElement } from "../../../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { Image as ImageIcon, Loader2, Pencil, FolderOpen, SearchX } from "lucide-vue-next";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import AssetGrid from "../shared/AssetGrid.vue";
import ImportMediaTile from "./ImportMediaTile.vue";

const router = useRouter();

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

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const subTab = ref<"library" | "projects">("library");
const subTabs = computed<SegmentedOption<"library" | "projects">[]>(() => [
	{ value: "library", label: "Library", icon: ImageIcon, count: isLoading.value ? undefined : images.value.length },
	{ value: "projects", label: "Design Studio", icon: FolderOpen, count: isLoading.value ? undefined : projects.value.length },
]);
const images = ref<ImageAsset[]>([]);
const projects = ref<ProjectSummary[]>([]);
const searchQuery = ref("");
const isLoading = ref(true);
const thumbnailCache = ref<Map<string, string>>(new Map());
const addingIds = ref<Set<string>>(new Set());

const filteredImages = computed(() => {
	if (!searchQuery.value.trim()) return images.value;
	const q = searchQuery.value.toLowerCase();
	return images.value.filter((img) => img.name.toLowerCase().includes(q));
});

const filteredProjects = computed(() => {
	if (!searchQuery.value.trim()) return projects.value;
	const q = searchQuery.value.toLowerCase();
	return projects.value.filter((p) => p.name.toLowerCase().includes(q));
});

/** Latest library export for an Image Editor project (by updated_at). */
function latestExportForProject(projectId: number): ImageAsset | undefined {
	const key = String(projectId);
	const matches = images.value.filter((img) => img.source_project_id === key);
	if (matches.length === 0) return undefined;
	return matches.reduce((best, img) => (img.updated_at > best.updated_at ? img : best));
}

onMounted(() => {
	loadAll();
});

async function loadAll() {
	isLoading.value = true;
	try {
		const [imgs, projs] = await Promise.all([
			getAllImageAssets(),
			listProjects().catch((err) => {
				console.error("[ImageLibraryView] Failed to load editor projects:", err);
				return [] as ProjectSummary[];
			}),
		]);
		images.value = imgs;
		projects.value = projs;
		await loadThumbnails(imgs);
	} catch (err) {
		console.error("[ImageLibraryView] Failed to load images:", err);
	} finally {
		isLoading.value = false;
	}
}

async function loadThumbnails(imgs: ImageAsset[]) {
	for (const img of imgs) {
		if (!img.file_path || thumbnailCache.value.has(img.id)) continue;
		try {
			const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: img.file_path });
			thumbnailCache.value.set(img.id, dataUrl);
		} catch {
			try {
				thumbnailCache.value.set(img.id, convertFileSrc(img.file_path));
			} catch {
				/* skip broken files */
			}
		}
	}
}

function projectThumbSrc(project: ProjectSummary): string | undefined {
	const exportImg = latestExportForProject(project.id);
	if (exportImg && thumbnailCache.value.has(exportImg.id)) {
		return thumbnailCache.value.get(exportImg.id);
	}
	if (project.thumbnail_url) {
		if (project.thumbnail_url.startsWith("http") || project.thumbnail_url.startsWith("data:")) {
			return project.thumbnail_url;
		}
		try {
			return convertFileSrc(project.thumbnail_url);
		} catch {
			return project.thumbnail_url;
		}
	}
	return undefined;
}

async function addFilePathToTimeline(filePath: string, name: string, mimeType?: string | null) {
	if (!activeProject.value) return;

	const dataUrl = await invoke<string>("read_file_as_data_url", { filePath });
	const response = await fetch(dataUrl);
	const blob = await response.blob();
	const file = new File([blob], name, { type: mimeType || blob.type || "image/png" });

	const dt = new DataTransfer();
	dt.items.add(file);

	const processedAssets = await processMediaAssets({
		files: dt.files,
		onProgress: () => {},
	});

	for (const asset of processedAssets) {
		const mediaId = await editor.media.addMediaAsset({
			projectId: activeProject.value.metadata.id,
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
}

async function addRemoteOrDataUrlToTimeline(url: string, name: string) {
	if (!activeProject.value) return;

	const response = await fetch(url);
	const blob = await response.blob();
	const ext = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "jpg" : "png";
	const file = new File([blob], name.endsWith(`.${ext}`) ? name : `${name}.${ext}`, {
		type: blob.type || "image/png",
	});

	const dt = new DataTransfer();
	dt.items.add(file);

	const processedAssets = await processMediaAssets({
		files: dt.files,
		onProgress: () => {},
	});

	for (const asset of processedAssets) {
		const mediaId = await editor.media.addMediaAsset({
			projectId: activeProject.value.metadata.id,
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
}

async function addImageToTimeline(img: ImageAsset) {
	if (!activeProject.value || !img.file_path) return;
	if (addingIds.value.has(img.id)) return;

	addingIds.value = new Set([...addingIds.value, img.id]);
	try {
		await addFilePathToTimeline(img.file_path, img.name, img.mime_type);
	} catch (err) {
		console.error("[ImageLibraryView] Failed to add image:", err);
	} finally {
		const next = new Set(addingIds.value);
		next.delete(img.id);
		addingIds.value = next;
	}
}

async function addProjectToTimeline(project: ProjectSummary) {
	const key = `project-${project.id}`;
	if (addingIds.value.has(key)) return;

	addingIds.value = new Set([...addingIds.value, key]);
	try {
		const exportImg = latestExportForProject(project.id);
		if (exportImg?.file_path) {
			await addFilePathToTimeline(exportImg.file_path, exportImg.name, exportImg.mime_type);
			return;
		}

		if (project.thumbnail_url) {
			if (project.thumbnail_url.startsWith("http") || project.thumbnail_url.startsWith("data:")) {
				await addRemoteOrDataUrlToTimeline(project.thumbnail_url, project.name);
			} else {
				await addFilePathToTimeline(project.thumbnail_url, project.name);
			}
			return;
		}

		// No library export or thumbnail — open Design Studio so the user can export
		openProjectInEditor(project);
	} catch (err) {
		console.error("[ImageLibraryView] Failed to add project image:", err);
	} finally {
		const next = new Set(addingIds.value);
		next.delete(key);
		addingIds.value = next;
	}
}

function openProjectInEditor(project: ProjectSummary) {
	router.push({ path: "/design-studio/edit", query: { projectId: String(project.id) } });
}

function formatDimensions(width: number | null, height: number | null): string {
	if (!width || !height) return "";
	return `${width}×${height}`;
}

function isAdding(id: string): boolean {
	return addingIds.value.has(id);
}
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Toolbar: library / Design Studio switch + search -->
		<div class="flex h-12 shrink-0 items-center gap-3 px-5">
			<SegmentedControl v-model="subTab" :options="subTabs" size="sm" />
			<div class="flex-1" />
			<SearchField
				v-model="searchQuery"
				size="sm"
				input-class="text-xs"
				:placeholder="subTab === 'library' ? 'Search images…' : 'Search projects…'"
				class="w-64"
			/>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			<!-- Loading -->
			<div v-if="isLoading" class="flex h-full items-center justify-center">
				<Loader2 class="size-5 animate-spin text-fg-subtle" />
			</div>

			<!-- Image library -->
			<template v-else-if="subTab === 'library'">
				<EmptyState
					v-if="filteredImages.length === 0"
					size="sm"
					class="h-full"
					:icon="searchQuery ? SearchX : ImageIcon"
					:title="searchQuery ? 'No matching images' : 'No images found'"
					:description="
						searchQuery ? 'Try a different search term.' : 'Export from Design Studio or upload in Image Library.'
					"
				/>

				<AssetGrid v-else :min="176">
					<ImportMediaTile
						v-for="img in filteredImages"
						:key="img.id"
						:label="img.name"
						:sublabel="[img.image_type, formatDimensions(img.width, img.height)].filter(Boolean).join(' · ') || undefined"
						:src="thumbnailCache.get(img.id)"
						:icon="ImageIcon"
						:busy="isAdding(img.id)"
						action="Add to timeline"
						:title="img.name"
						@click="addImageToTimeline(img)"
						@keydown.enter="addImageToTimeline(img)"
					/>
				</AssetGrid>
			</template>

			<!-- Design Studio (Image Editor) projects -->
			<template v-else>
				<EmptyState
					v-if="filteredProjects.length === 0"
					size="sm"
					class="h-full"
					:icon="searchQuery ? SearchX : FolderOpen"
					:title="searchQuery ? 'No matching projects' : 'No Design Studio projects'"
					:description="searchQuery ? 'Try a different search term.' : 'Create projects in Design Studio.'"
				/>

				<AssetGrid v-else :min="176">
					<ImportMediaTile
						v-for="project in filteredProjects"
						:key="project.id"
						:label="project.name"
						:sublabel="
							[
								latestExportForProject(project.id)
									? 'Has export'
									: project.thumbnail_url
										? 'Preview only'
										: 'No export yet',
								formatDimensions(project.canvas_width ?? null, project.canvas_height ?? null),
							]
								.filter(Boolean)
								.join(' · ')
						"
						:src="projectThumbSrc(project)"
						:icon="FolderOpen"
						:busy="isAdding(`project-${project.id}`)"
						:action="
							latestExportForProject(project.id) || project.thumbnail_url
								? 'Add to timeline'
								: 'Open in Design Studio'
						"
						:action-icon="latestExportForProject(project.id) || project.thumbnail_url ? undefined : Pencil"
						:title="project.name"
						@click="addProjectToTimeline(project)"
						@keydown.enter="addProjectToTimeline(project)"
					>
						<template #actions>
							<button
								type="button"
								class="grid size-6 place-items-center rounded bg-black/60 text-white/85 transition-colors hover:bg-black/80 hover:text-white"
								title="Open in Design Studio"
								aria-label="Open in Design Studio"
								@keydown.enter.stop
								@click.stop="openProjectInEditor(project)"
							>
								<Pencil class="size-3" />
							</button>
						</template>
					</ImportMediaTile>
				</AssetGrid>
			</template>
		</div>
	</div>
</template>
