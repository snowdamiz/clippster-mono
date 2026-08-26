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
import { Image as ImageIcon, Search, Plus, Loader2, Pencil, FolderOpen } from "lucide-vue-next";

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
	router.push({ path: "/design-studio", query: { projectId: String(project.id) } });
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
	<div class="flex h-full flex-col bg-transparent">
		<!-- Sub-tabs -->
		<div class="flex items-center border-b border-white/10 px-4 shrink-0">
			<button
				v-for="tab in ([
					{ key: 'library', label: 'Image Library', icon: ImageIcon },
					{ key: 'projects', label: 'Image Editor projects', icon: FolderOpen },
				] as const)"
				:key="tab.key"
				type="button"
				:class="[
					'flex items-center gap-1 px-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2',
					subTab === tab.key
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-zinc-500 hover:text-zinc-300',
				]"
				@click="subTab = tab.key"
			>
				<component :is="tab.icon" class="size-3.5" />
				{{ tab.label }}
			</button>
		</div>

		<!-- Search -->
		<div class="flex items-center gap-2 border-b border-white/10 px-4 py-2 shrink-0">
			<div class="relative flex-1">
				<Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					:placeholder="subTab === 'library' ? 'Search images...' : 'Search projects...'"
					class="w-full h-7 pl-8 pr-3 bg-zinc-800/50 border border-white/10 rounded text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
				/>
			</div>
		</div>

		<!-- Loading -->
		<div v-if="isLoading" class="flex-1 flex items-center justify-center">
			<Loader2 class="size-5 animate-spin text-blue-400" />
		</div>

		<!-- Image Library -->
		<template v-else-if="subTab === 'library'">
			<div
				v-if="filteredImages.length === 0"
				class="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center"
			>
				<ImageIcon class="size-8 text-zinc-500" />
				<p class="text-sm text-zinc-400">No images found</p>
				<p class="text-xs text-zinc-500">
					Export from Design Studio or upload in Image Library
				</p>
			</div>

			<div v-else class="flex-1 overflow-y-auto p-4">
				<p class="mb-2 text-[10px] text-zinc-500">Click to add to the timeline at the playhead</p>
				<div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))">
					<div
						v-for="img in filteredImages"
						:key="img.id"
						:title="img.name"
						:class="[
							'group relative overflow-hidden rounded-lg border border-white/10 transition-colors',
							isAdding(img.id)
								? 'cursor-wait opacity-60'
								: 'cursor-pointer hover:border-blue-500/50',
						]"
						@click="addImageToTimeline(img)"
					>
						<div class="relative aspect-video bg-zinc-800">
							<img
								v-if="thumbnailCache.get(img.id)"
								:src="thumbnailCache.get(img.id)"
								:alt="img.name"
								class="size-full object-cover"
								draggable="false"
							/>
							<div v-else class="flex size-full items-center justify-center">
								<ImageIcon class="size-8 text-zinc-600" />
							</div>
							<div
								v-if="isAdding(img.id)"
								class="absolute inset-0 flex items-center justify-center bg-black/40"
							>
								<Loader2 class="size-5 animate-spin text-blue-400" />
							</div>
							<div
								v-else
								class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
							>
								<div class="rounded-full bg-blue-500 p-2">
									<Plus class="size-4 text-white" />
								</div>
							</div>
						</div>
						<div class="px-2 py-1.5 bg-zinc-900/90">
							<h3 class="text-xs font-medium text-zinc-200 truncate" :title="img.name">
								{{ img.name }}
							</h3>
							<div class="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-500">
								<span v-if="img.image_type">{{ img.image_type }}</span>
								<span
									v-if="img.image_type && img.width && img.height"
									class="text-zinc-700"
								>•</span>
								<span v-if="img.width && img.height">{{ formatDimensions(img.width, img.height) }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>

		<!-- Image Editor projects -->
		<template v-else>
			<div
				v-if="filteredProjects.length === 0"
				class="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center"
			>
				<FolderOpen class="size-8 text-zinc-500" />
				<p class="text-sm text-zinc-400">No Image Editor projects</p>
				<p class="text-xs text-zinc-500">Create projects in Design Studio</p>
			</div>

			<div v-else class="flex-1 overflow-y-auto p-4">
				<p class="mb-2 text-[10px] text-zinc-500">
					Click to insert latest export · pencil opens Design Studio
				</p>
				<div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
					<div
						v-for="project in filteredProjects"
						:key="project.id"
						:title="project.name"
						:class="[
							'group relative overflow-hidden rounded-lg border border-white/10 transition-colors',
							isAdding(`project-${project.id}`)
								? 'cursor-wait opacity-60'
								: 'cursor-pointer hover:border-blue-500/50',
						]"
						@click="addProjectToTimeline(project)"
					>
						<div class="relative aspect-video bg-zinc-800">
							<img
								v-if="projectThumbSrc(project)"
								:src="projectThumbSrc(project)"
								:alt="project.name"
								class="size-full object-cover"
								draggable="false"
							/>
							<div v-else class="flex size-full items-center justify-center">
								<FolderOpen class="size-8 text-zinc-600" />
							</div>
							<div
								v-if="isAdding(`project-${project.id}`)"
								class="absolute inset-0 flex items-center justify-center bg-black/40"
							>
								<Loader2 class="size-5 animate-spin text-blue-400" />
							</div>
							<div
								v-else
								class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
							>
								<div class="rounded-full bg-blue-500 p-2">
									<Plus class="size-4 text-white" />
								</div>
							</div>
							<button
								type="button"
								class="absolute top-1 right-1 hidden rounded bg-black/60 p-1 text-zinc-300 hover:text-white group-hover:block"
								title="Open in Design Studio"
								aria-label="Open in Design Studio"
								@click.stop="openProjectInEditor(project)"
							>
								<Pencil class="size-3" />
							</button>
						</div>
						<div class="px-2 py-1.5 bg-zinc-900/90">
							<h3 class="text-xs font-medium text-zinc-200 truncate" :title="project.name">
								{{ project.name }}
							</h3>
							<div class="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-500">
								<span v-if="latestExportForProject(project.id)">Has export</span>
								<span v-else-if="project.thumbnail_url">Preview only</span>
								<span v-else>No export yet</span>
								<span
									v-if="project.canvas_width && project.canvas_height"
									class="text-zinc-700"
								>•</span>
								<span v-if="project.canvas_width && project.canvas_height">
									{{ formatDimensions(project.canvas_width, project.canvas_height) }}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
