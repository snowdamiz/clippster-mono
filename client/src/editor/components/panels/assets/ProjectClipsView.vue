<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { formatUnixDate } from "@/utils/dateTimeUtils";
import { appDataDir } from "@tauri-apps/api/path";
import { useEditor } from "../../../composables/useEditor";
import { getAllProjects, getChildProjects } from "@/services/database/projects";
import { getClipsByProjectId } from "@/services/database/clips";
import { getRawVideosByProjectId } from "@/services/database/raw-videos";
import type { Project, Clip } from "@/services/database/types";
import type { MediaAsset } from "../../../types/assets";
import {
	FolderOpen,
	Film,
	ArrowLeft,
	Loader2,
	Check,
	Search,
	ChevronRight,
	Plus,
} from "lucide-vue-next";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { buildVideoElement } from "../../../lib/timeline/element-utils";
import { setDragData } from "../../../lib/drag-data";
import type { CreateTimelineElement } from "../../../types/timeline";

const { editor, version } = useEditor();

const projects = ref<Project[]>([]);
const selectedProject = ref<Project | null>(null);
const projectClips = ref<Clip[]>([]);
const loading = ref(false);
const loadingClips = ref(false);
const addingIds = ref<Set<string>>(new Set());
const addedIds = ref<Set<string>>(new Set());
const extractionStatus = ref<Map<string, string>>(new Map());
const searchQuery = ref("");
const thumbnailCache = ref<Map<string, string>>(new Map());
const addedMediaIds = ref<Map<string, string>>(new Map()); // clipId → mediaAssetId

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const existingMediaNames = computed(() => {
	void version.value;
	const assets = editor.media.getAssets();
	return new Set(assets.map((a) => a.name));
});

// Show only unbuilt clips — built clips live in the Built Clips tab
const unbuiltClips = computed(() => {
	return projectClips.value.filter(
		(c) => !c.built_file_path || c.build_status !== "completed",
	);
});

const filteredProjects = computed(() => {
	if (!searchQuery.value.trim()) return projects.value;
	const q = searchQuery.value.toLowerCase();
	return projects.value.filter((p) => p.name.toLowerCase().includes(q));
});

const filteredClips = computed(() => {
	if (!searchQuery.value.trim()) return unbuiltClips.value;
	const q = searchQuery.value.toLowerCase();
	return unbuiltClips.value.filter((c) => {
		const name = c.name || "";
		return name.toLowerCase().includes(q);
	});
});

function getClipName(clip: Clip): string {
	return clip.name || "Untitled Clip";
}

function formatDuration(seconds: number | null): string {
	if (!seconds) return "";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatDate(ts: number): string {
	return formatUnixDate(ts);
}

function getCachedThumbnail(clipId: string): string | undefined {
	return thumbnailCache.value.get(clipId);
}

function isAlreadyAdded(clip: Clip): boolean {
	const name = getClipName(clip);
	return existingMediaNames.value.has(name) || addedIds.value.has(clip.id);
}

function getClipDuration(clip: Clip): number | null {
	if (clip.duration) return clip.duration;
	if (clip.start_time != null && clip.end_time != null) {
		return clip.end_time - clip.start_time;
	}
	return null;
}

async function loadProjects() {
	loading.value = true;
	try {
		const all = await getAllProjects();
		// Only show parent projects — child segments are aggregated when selected
		projects.value = all.filter((p) => !p.parent_id);
	} catch (error) {
		console.error("[ProjectClipsView] Failed to load projects:", error);
	} finally {
		loading.value = false;
	}
}

async function selectProject(project: Project) {
	selectedProject.value = project;
	searchQuery.value = "";
	loadingClips.value = true;
	try {
		// Fetch clips from the parent project and all child segment projects
		const parentClips = await getClipsByProjectId(project.id);
		const children = await getChildProjects(project.id);
		const childClipArrays = await Promise.all(
			children.map((child) => getClipsByProjectId(child.id)),
		);
		projectClips.value = [...parentClips, ...childClipArrays.flat()];
		await loadThumbnails();
	} catch (error) {
		console.error("[ProjectClipsView] Failed to load clips:", error);
		projectClips.value = [];
	} finally {
		loadingClips.value = false;
	}
}

async function loadThumbnails() {
	const clipsNeedingThumbs = unbuiltClips.value.filter(
		(c) => c.built_thumbnail_path && !thumbnailCache.value.has(c.id),
	);
	if (clipsNeedingThumbs.length === 0) return;

	let hasNew = false;
	const batchSize = 5;
	for (let i = 0; i < clipsNeedingThumbs.length; i += batchSize) {
		const batch = clipsNeedingThumbs.slice(i, i + batchSize);
		await Promise.all(
			batch.map(async (clip) => {
				try {
					const dataUrl = await invoke<string>("read_file_as_data_url", {
						filePath: clip.built_thumbnail_path,
					});
					thumbnailCache.value.set(clip.id, dataUrl);
					hasNew = true;
				} catch (err) {
					console.warn(`[ProjectClipsView] Failed to load thumbnail for ${clip.id}:`, err);
				}
			}),
		);
	}
	if (hasNew) {
		thumbnailCache.value = new Map(thumbnailCache.value);
	}
}

function goBack() {
	selectedProject.value = null;
	projectClips.value = [];
	searchQuery.value = "";
}

function getMediaAssetId(clip: Clip): string | undefined {
	const mapped = addedMediaIds.value.get(clip.id);
	if (mapped) return mapped;
	const name = getClipName(clip);
	const asset = editor.media.getAssets().find((a) => a.name === name);
	return asset?.id;
}

function addToTimeline(clip: Clip) {
	const mediaId = getMediaAssetId(clip);
	if (!mediaId) return;
	const asset = editor.media.getAssets().find((a) => a.id === mediaId);
	if (!asset) return;
	const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
	const startTime = editor.playback.getCurrentTime();
	const element: CreateTimelineElement = buildVideoElement({ mediaId, name: asset.name, duration, startTime });
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

function handleClipClick(clip: Clip) {
	if (isAlreadyAdded(clip)) {
		addToTimeline(clip);
	} else {
		addClipToEditor(clip);
	}
}

function handleDragStart(e: DragEvent, clip: Clip) {
	const mediaId = getMediaAssetId(clip);
	if (!mediaId || !e.dataTransfer) return;
	setDragData({
		dataTransfer: e.dataTransfer,
		dragData: { id: mediaId, type: "media", mediaType: "video", name: getClipName(clip) },
	});
}

/**
 * Add an unbuilt clip to the editor.
 * This extracts the clip segment from the VOD (just like "Edit Clip" does
 * in ProjectWorkspaceDialog) so the editor works with a short extracted file
 * rather than seeking through the entire VOD.
 */
async function addClipToEditor(clip: Clip) {
	if (!activeProject.value) return;
	if (addingIds.value.has(clip.id) || isAlreadyAdded(clip)) return;

	addingIds.value = new Set([...addingIds.value, clip.id]);
	extractionStatus.value.set(clip.id, "Extracting clip...");

	try {
		let videoServerPort: number;
		try {
			videoServerPort = await invoke<number>("get_video_server_port");
		} catch {
			videoServerPort = 8642;
		}

		// Determine clip time range
		const clipStartTime = clip.start_time ?? 0;
		const clipEndTime = clip.end_time ?? (clipStartTime + (clip.duration ?? 0));
		const clipDuration = clipEndTime - clipStartTime;

		if (clipDuration <= 0) {
			throw new Error("Clip has no valid time range");
		}

		// Find the VOD file path from the clip's project
		let vodPath = "";
		const projectId = clip.project_id || selectedProject.value?.id;
		if (projectId) {
			const rawVideos = await getRawVideosByProjectId(projectId);
			if (rawVideos.length > 0) {
				vodPath = rawVideos[0].file_path;
			}
		}

		// Fallback: use the clip's own file_path (it references the source video)
		if (!vodPath && clip.file_path) {
			vodPath = clip.file_path;
		}

		if (!vodPath) {
			throw new Error("Cannot find source video file for clip extraction");
		}

		// Extract the clip segment from the VOD via FFmpeg
		extractionStatus.value.set(clip.id, "Extracting video...");
		const baseDir = await appDataDir();
		const editorProjectId = activeProject.value.metadata.id;
		const outputDir = `${baseDir}editor-media/${editorProjectId}`;
		const outputPath = `${outputDir}/clip_${clip.id}.mp4`;

		console.log("[ProjectClipsView] Extracting clip segment:", {
			vodPath: vodPath.split(/[\\/]/).pop(),
			startTime: clipStartTime,
			endTime: clipEndTime,
			duration: clipDuration,
			outputPath,
		});

		await invoke("extract_clip", {
			sourcePath: vodPath,
			outputPath,
			startTime: clipStartTime,
			endTime: clipEndTime,
		});

		console.log("[ProjectClipsView] Clip extracted successfully:", outputPath);

		// Build the media asset from the extracted file
		extractionStatus.value.set(clip.id, "Adding to editor...");
		const encodedPath = btoa(outputPath);
		const url = `http://localhost:${videoServerPort}/video/${encodedPath}`;

		const file = new File([], getClipName(clip), { type: "video/mp4" });
		(file as File & { path?: string }).path = outputPath;

		const asset: Omit<MediaAsset, "id"> = {
			name: getClipName(clip),
			type: "video",
			file,
			url,
			duration: clipDuration,
			thumbnailUrl: undefined,
			ephemeral: false,
		};

		// Use cached data URL thumbnail if available
		const cachedThumb = getCachedThumbnail(clip.id);
		if (cachedThumb) {
			asset.thumbnailUrl = cachedThumb;
		}

		await editor.media.addMediaAsset({
			projectId: editorProjectId,
			asset,
		});

		// Track the mapping from clip ID to the newly added media asset ID
		const addedAsset = editor.media.getAssets().find((a) => a.name === getClipName(clip));
		if (addedAsset) {
			addedMediaIds.value = new Map([...addedMediaIds.value, [clip.id, addedAsset.id]]);
		}

		addedIds.value = new Set([...addedIds.value, clip.id]);
		extractionStatus.value.delete(clip.id);
	} catch (error) {
		console.error("[ProjectClipsView] Failed to add clip:", error);
		extractionStatus.value.set(
			clip.id,
			`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		// Clear error status after 3 seconds
		setTimeout(() => {
			extractionStatus.value.delete(clip.id);
		}, 3000);
	} finally {
		const next = new Set(addingIds.value);
		next.delete(clip.id);
		addingIds.value = next;
	}
}

onMounted(loadProjects);
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Header with back button when in project -->
		<div class="border-b border-white/10 px-3 py-2">
			<div v-if="selectedProject" class="flex items-center gap-2">
				<button
					type="button"
					class="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
					@click="goBack"
				>
					<ArrowLeft class="size-3.5" />
					Back
				</button>
				<span class="truncate text-xs font-medium text-zinc-200">
					{{ selectedProject.name }}
				</span>
			</div>
			<!-- Search -->
			<div :class="selectedProject ? 'mt-2' : ''">
				<div class="relative">
					<Search class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
					<input
						v-model="searchQuery"
						type="text"
						:placeholder="selectedProject ? 'Search clips...' : 'Search projects...'"
						class="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-7 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500/50"
					/>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			<!-- Loading -->
			<div v-if="loading || loadingClips" class="flex h-full items-center justify-center">
				<Loader2 class="size-6 animate-spin text-zinc-500" />
			</div>

			<!-- Project List View -->
			<template v-else-if="!selectedProject">
				<div
					v-if="filteredProjects.length === 0"
					class="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
				>
					<FolderOpen class="size-8 text-zinc-600" />
					<p class="text-sm text-zinc-500">
						{{ searchQuery ? "No matching projects" : "No projects yet" }}
					</p>
				</div>

				<div v-else class="space-y-0.5 p-2">
					<button
						v-for="project in filteredProjects"
						:key="project.id"
						type="button"
						class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
						@click="selectProject(project)"
					>
						<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
							<FolderOpen class="size-4 text-zinc-400" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-xs font-medium text-zinc-200">
								{{ project.name }}
							</div>
							<div class="text-[10px] text-zinc-500">
								{{ formatDate(project.created_at) }}
								<span v-if="project.platform" class="ml-1 text-zinc-600">
									· {{ project.platform }}
								</span>
							</div>
						</div>
						<ChevronRight class="size-3.5 shrink-0 text-zinc-600" />
					</button>
				</div>
			</template>

			<!-- Clip List View (within selected project) -->
			<template v-else>
				<div
					v-if="filteredClips.length === 0"
					class="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
				>
					<Film class="size-8 text-zinc-600" />
					<p class="text-sm text-zinc-500">
						{{ searchQuery ? "No matching clips" : "No unbuilt clips in this project" }}
					</p>
					<p class="text-xs text-zinc-600">
						Built clips appear in the Built Clips tab
					</p>
				</div>

				<div
					v-else
					class="grid gap-2 p-3"
					style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr))"
				>
					<div
						v-for="clip in filteredClips"
						:key="clip.id"
						class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-white/20"
						:class="{
							'ring-1 ring-green-500/30': isAlreadyAdded(clip),
							'pointer-events-none': addingIds.has(clip.id),
						}"
						:draggable="isAlreadyAdded(clip)"
						@click="handleClipClick(clip)"
						@dblclick="addToTimeline(clip)"
						@dragstart="(e: DragEvent) => handleDragStart(e, clip)"
					>
						<!-- Thumbnail -->
						<div class="relative aspect-video bg-zinc-800">
							<img
								v-if="getCachedThumbnail(clip.id)"
								:src="getCachedThumbnail(clip.id)"
								:alt="getClipName(clip)"
								class="size-full object-cover"
								@error="($event.target as HTMLImageElement).style.display = 'none'"
							/>
							<div v-else class="flex size-full items-center justify-center">
								<Film class="size-6 text-zinc-500" />
							</div>
							<!-- Duration badge -->
							<div
								v-if="getClipDuration(clip)"
								class="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white"
							>
								{{ formatDuration(getClipDuration(clip)) }}
							</div>
							<!-- Extraction progress overlay -->
							<div
								v-if="addingIds.has(clip.id)"
								class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60"
							>
								<Loader2 class="size-4 animate-spin text-white" />
								<span class="px-1 text-center text-[9px] text-white/80">
									{{ extractionStatus.get(clip.id) || "Processing..." }}
								</span>
							</div>
							<!-- Error overlay -->
							<div
								v-else-if="extractionStatus.has(clip.id)"
								class="absolute inset-0 flex items-center justify-center bg-red-900/40"
							>
								<span class="px-1 text-center text-[9px] text-red-300">
									{{ extractionStatus.get(clip.id) }}
								</span>
							</div>
							<!-- Already added overlay -->
							<div
								v-else-if="isAlreadyAdded(clip)"
								class="absolute inset-0 flex items-center justify-center bg-black/50"
							>
								<Check class="size-4 text-green-400" />
							</div>
							<!-- Add button on hover -->
							<div
								v-else
								class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"
							>
								<Plus class="size-5 text-white" />
							</div>
						</div>
						<!-- Name -->
						<div class="truncate px-2 py-1 text-xs text-zinc-300">
							{{ getClipName(clip) }}
						</div>
						<!-- Time range -->
						<div
							v-if="clip.start_time != null && clip.end_time != null"
							class="truncate px-2 pb-1 text-[10px] text-zinc-500"
						>
							{{ formatDuration(clip.start_time) }} - {{ formatDuration(clip.end_time) }}
						</div>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>
