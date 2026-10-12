<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { formatUnixDate } from "@/utils/dateTimeUtils";
import { useEditor } from "../../../composables/useEditor";
import { getAllProjects, getChildProjects } from "@/services/database/projects";
import { getClipsWithVersionsByProjectId } from "@/services/database/clip-detection";
import type { Project, Clip, ClipWithVersion } from "@/services/database/types";
import {
	extractUnbuiltClipSegmentToPath,
	resolveClipTimeRangeForExtraction,
} from "@/services/clip-vod-extract";
import type { MediaAsset } from "../../../types/assets";
import { FolderOpen, Film, ArrowLeft, Loader2, SearchX, ChevronRight, Clapperboard } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { SectionHeader } from "@/components/ui/section-header";
import { PlatformLogo } from "@/components/ui/platform-logo";
import AssetGrid from "../shared/AssetGrid.vue";
import ImportMediaTile from "./ImportMediaTile.vue";
import {
	pickPrimaryRawVideo,
	resolveRawVideosForProject,
} from "@/services/project-raw-video-resolve";
import type { RawVideo } from "@/services/database/types";
import { utf8ToBase64Url } from "@/utils/encoding";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { buildVideoElement } from "../../../lib/timeline/element-utils";
import { hydrateVideoFileFromLocalUrl } from "../../../lib/media/hydrate-video-file-from-url";
import { usePointerDrag } from "../../../composables/usePointerDrag";
import type { CreateTimelineElement } from "../../../types/timeline";

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
const { startDrag, wasDragCompleted } = usePointerDrag();

const projects = ref<Project[]>([]);
const selectedProject = ref<Project | null>(null);
const projectClips = ref<ClipWithVersion[]>([]);
const loading = ref(false);
const loadingClips = ref(false);
const addingIds = ref<Set<string>>(new Set());
const addedIds = ref<Set<string>>(new Set());
const extractionStatus = ref<Map<string, string>>(new Map());
const searchQuery = ref("");
const thumbnailCache = ref<Map<string, string>>(new Map());
const projectThumbnailCache = ref<Map<string, string>>(new Map());
const addedMediaIds = ref<Map<string, string>>(new Map()); // clipId → mediaAssetId
const primaryRawVideo = ref<RawVideo | null>(null);
const isAddingFullProject = ref(false);
const fullProjectAdded = ref(false);
const fullProjectMediaId = ref<string | null>(null);

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

async function loadProjectThumbnails() {
	const projectsNeedingThumbs = projects.value.filter(
		(p) => p.thumbnail_path && !projectThumbnailCache.value.has(p.id),
	);
	if (projectsNeedingThumbs.length === 0) return;

	let hasNew = false;
	await Promise.all(
		projectsNeedingThumbs.map(async (project) => {
			try {
				const dataUrl = await invoke<string>("read_file_as_data_url", {
					filePath: project.thumbnail_path,
				});
				projectThumbnailCache.value.set(project.id, dataUrl);
				hasNew = true;
			} catch (err) {
				console.warn(`[ProjectClipsView] Failed to load thumbnail for project ${project.id}:`, err);
			}
		}),
	);
	if (hasNew) {
		projectThumbnailCache.value = new Map(projectThumbnailCache.value);
	}
}

async function loadProjects() {
	loading.value = true;
	try {
		const all = await getAllProjects();
		// Only show parent projects — child segments are aggregated when selected
		projects.value = all.filter((p) => !p.parent_id);
		await loadProjectThumbnails();
	} catch (error) {
		console.error("[ProjectClipsView] Failed to load projects:", error);
	} finally {
		loading.value = false;
	}
}

async function loadPrimaryRawVideo(project: Project) {
	try {
		const rawVideos = await resolveRawVideosForProject(project.id, project.parent_id);
		primaryRawVideo.value = pickPrimaryRawVideo(rawVideos);
		fullProjectAdded.value = false;
		fullProjectMediaId.value = null;

		if (primaryRawVideo.value) {
			const assetName = `${project.name} (Full Video)`;
			const existing = editor.media.getAssets().find((a) => a.name === assetName);
			if (existing) {
				fullProjectAdded.value = true;
				fullProjectMediaId.value = existing.id;
			}
		}
	} catch (error) {
		console.warn("[ProjectClipsView] Failed to resolve raw video for project:", error);
		primaryRawVideo.value = null;
	}
}

async function selectProject(project: Project) {
	selectedProject.value = project;
	searchQuery.value = "";
	loadingClips.value = true;
	try {
		await loadPrimaryRawVideo(project);
		// Fetch clips from the parent project and all child segment projects
		const parentClips = await getClipsWithVersionsByProjectId(project.id);
		const children = await getChildProjects(project.id);
		const childClipArrays = await Promise.all(
			children.map((child) => getClipsWithVersionsByProjectId(child.id)),
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
	primaryRawVideo.value = null;
	fullProjectAdded.value = false;
	fullProjectMediaId.value = null;
}

function getFullProjectAssetName(): string {
	return `${selectedProject.value?.name ?? "Project"} (Full Video)`;
}

async function addFullProjectToEditor() {
	if (!activeProject.value || !selectedProject.value || !primaryRawVideo.value) return;
	if (isAddingFullProject.value) return;

	const assetName = getFullProjectAssetName();
	if (fullProjectAdded.value && fullProjectMediaId.value) {
		addFullProjectToTimeline();
		return;
	}

	isAddingFullProject.value = true;

	try {
		let videoServerPort: number;
		try {
			videoServerPort = await invoke<number>("get_video_server_port");
		} catch {
			videoServerPort = 8642;
		}

		const filePath = primaryRawVideo.value.file_path;
		const encodedPath = utf8ToBase64Url(filePath);
		const url = `http://localhost:${videoServerPort}/video/${encodedPath}`;
		const duration = primaryRawVideo.value.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

		const file = await hydrateVideoFileFromLocalUrl({
			url,
			name: assetName,
			fallbackType: "video/mp4",
			diskPath: filePath,
		});

		const asset: Omit<MediaAsset, "id"> = {
			name: assetName,
			type: "video",
			file,
			url,
			duration,
			thumbnailUrl: projectThumbnailCache.value.get(selectedProject.value.id),
			ephemeral: false,
			diskImportPath: filePath,
		};

		await editor.media.addMediaAsset({
			projectId: activeProject.value.metadata.id,
			asset,
		});

		const addedAsset = editor.media.getAssets().find((a) => a.name === assetName);
		if (addedAsset) {
			fullProjectMediaId.value = addedAsset.id;
		}
		fullProjectAdded.value = true;
	} catch (error) {
		console.error("[ProjectClipsView] Failed to add full project:", error);
	} finally {
		isAddingFullProject.value = false;
	}
}

function addFullProjectToTimeline() {
	if (!fullProjectMediaId.value) return;
	const asset = editor.media.getAssets().find((a) => a.id === fullProjectMediaId.value);
	if (!asset) return;
	const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
	const startTime = editor.playback.getCurrentTime();
	const element: CreateTimelineElement = buildVideoElement({
		mediaId: asset.id,
		name: asset.name,
		duration,
		startTime,
	});
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

function handleFullProjectClick() {
	if (fullProjectAdded.value) {
		addFullProjectToTimeline();
	} else {
		void addFullProjectToEditor();
	}
}

function handleFullProjectPointerDown(e: PointerEvent) {
	if (!fullProjectAdded.value || !fullProjectMediaId.value) return;
	startDrag(e, {
		id: fullProjectMediaId.value,
		type: "media",
		mediaType: "video",
		name: getFullProjectAssetName(),
	});
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

function handleClipClick(clip: ClipWithVersion) {
	if (wasDragCompleted.value) return;
	if (isAlreadyAdded(clip)) {
		addToTimeline(clip);
	} else {
		addClipToEditor(clip);
	}
}

function handlePointerDown(e: PointerEvent, clip: ClipWithVersion) {
	if (!isAlreadyAdded(clip)) return;
	const mediaId = getMediaAssetId(clip);
	if (!mediaId) return;
	startDrag(e, { id: mediaId, type: "media", mediaType: "video", name: getClipName(clip) });
}

/**
 * Add an unbuilt clip to the editor.
 * This extracts the clip segment from the VOD (just like "Edit Clip" does
 * in ProjectWorkspaceDialog) so the editor works with a short extracted file
 * rather than seeking through the entire VOD.
 */
async function addClipToEditor(clip: ClipWithVersion) {
	if (!activeProject.value) return;
	if (addingIds.value.has(clip.id) || isAlreadyAdded(clip)) return;

	addingIds.value = new Set([...addingIds.value, clip.id]);
	extractionStatus.value.set(clip.id, "Extracting clip…");

	try {
		let videoServerPort: number;
		try {
			videoServerPort = await invoke<number>("get_video_server_port");
		} catch {
			videoServerPort = 8642;
		}

		const { startTime: clipStartTime, endTime: clipEndTime } = resolveClipTimeRangeForExtraction(clip);
		const clipDuration = clipEndTime - clipStartTime;

		if (clipDuration <= 0) {
			throw new Error("Clip has no valid time range (check clip version / segment bounds)");
		}

		// Same VOD resolution + FFmpeg extract as ProjectWorkspaceDialog → createVideoEditorProjectFromClip
		extractionStatus.value.set(clip.id, "Extracting video…");
		const editorProjectId = activeProject.value.metadata.id;
		const outputPath = await invoke<string>("get_editor_clip_extract_path", {
			projectId: editorProjectId,
			clipId: clip.id,
		});

		await extractUnbuiltClipSegmentToPath({
			clipId: clip.id,
			clipStartTime,
			clipEndTime,
			outputPath,
			videoSrc: null,
			// Prefer DB parent when a child/segment project is selected (same as ProjectWorkspaceDialog parent_id).
			rawVideoParentProjectId:
				selectedProject.value?.parent_id ?? selectedProject.value?.id ?? null,
		});

		console.log("[ProjectClipsView] Clip extracted successfully:", outputPath);

		// Build the media asset from the extracted file
		extractionStatus.value.set(clip.id, "Adding to editor…");
		const encodedPath = utf8ToBase64Url(outputPath);
		const url = `http://localhost:${videoServerPort}/video/${encodedPath}`;

		// Real bytes: scene-builder skips file.size===0 (no VideoNode → black preview); mediabunny /
		// AudioManager BlobSource and decodeAudioData cannot read Tauri-only `.path` on an empty File.
		const file = await hydrateVideoFileFromLocalUrl({
			url,
			name: getClipName(clip),
			fallbackType: "video/mp4",
			diskPath: outputPath,
		});

		const asset: Omit<MediaAsset, "id"> = {
			name: getClipName(clip),
			type: "video",
			file,
			url,
			duration: clipDuration,
			thumbnailUrl: undefined,
			ephemeral: false,
			diskImportPath: outputPath,
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
		<!-- Toolbar: breadcrumb when inside a project, count at the root -->
		<div class="flex h-12 shrink-0 items-center gap-3 px-5">
			<div v-if="selectedProject" class="flex min-w-0 flex-1 items-center gap-1">
				<Button variant="ghost" size="sm" class="-ml-2.5 shrink-0" @click="goBack">
					<ArrowLeft />
					Projects
				</Button>
				<ChevronRight class="size-3.5 shrink-0 text-fg-subtle" />
				<span class="truncate text-sm font-medium text-fg" :title="selectedProject.name">
					{{ selectedProject.name }}
				</span>
			</div>
			<p v-else class="tabular min-w-0 flex-1 truncate text-xs text-fg-muted">
				<template v-if="!loading">
					{{ projects.length }} {{ projects.length === 1 ? "project" : "projects" }}
				</template>
			</p>
			<SearchField
				v-model="searchQuery"
				size="sm"
				input-class="text-xs"
				:placeholder="selectedProject ? 'Search clips…' : 'Search projects…'"
				class="w-64"
			/>
		</div>

		<!-- Content -->
		<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			<div v-if="loading || loadingClips" class="flex h-full items-center justify-center">
				<Loader2 class="size-5 animate-spin text-fg-subtle" />
			</div>

			<!-- Project list -->
			<template v-else-if="!selectedProject">
				<EmptyState
					v-if="filteredProjects.length === 0"
					size="sm"
					class="h-full"
					:icon="searchQuery ? SearchX : FolderOpen"
					:title="searchQuery ? 'No matching projects' : 'No projects yet'"
					:description="
						searchQuery ? 'Try a different search term.' : 'Projects you create from VODs show up here.'
					"
				/>

				<AssetGrid v-else :min="176">
					<ImportMediaTile
						v-for="project in filteredProjects"
						:key="project.id"
						:label="project.name"
						:sublabel="formatDate(project.created_at)"
						:src="projectThumbnailCache.get(project.id)"
						:icon="FolderOpen"
						action="Open"
						:action-icon="ChevronRight"
						:title="project.name"
						@click="selectProject(project)"
						@keydown.enter="selectProject(project)"
					>
						<template v-if="project.platform" #badges>
							<PlatformLogo :platform="project.platform" size="xs" />
						</template>
					</ImportMediaTile>
				</AssetGrid>
			</template>

			<!-- Inside a project: full video + unbuilt clips -->
			<template v-else>
				<EmptyState
					v-if="filteredClips.length === 0 && !primaryRawVideo"
					size="sm"
					class="h-full"
					:icon="searchQuery ? SearchX : Film"
					:title="searchQuery ? 'No matching clips' : 'No unbuilt clips in this project'"
					description="Built clips appear in the Built clips tab."
				/>

				<div v-else class="flex flex-col gap-4">
					<section v-if="primaryRawVideo">
						<SectionHeader variant="eyebrow" title="Full video" class="mb-1" />
						<AssetGrid :min="176">
							<ImportMediaTile
								label="Entire project"
								sublabel="Full downloaded video"
								:src="selectedProject && projectThumbnailCache.get(selectedProject.id)"
								:icon="Clapperboard"
								:duration="formatDuration(primaryRawVideo.duration) || undefined"
								:added="fullProjectAdded"
								:busy="isAddingFullProject"
								:action="fullProjectAdded ? 'Add to timeline' : 'Add to media'"
								:class="{ 'pointer-events-none': isAddingFullProject }"
								:title="getFullProjectAssetName()"
								@click="handleFullProjectClick"
								@dblclick="addFullProjectToTimeline"
								@keydown.enter="handleFullProjectClick"
								@pointerdown="handleFullProjectPointerDown"
								@dragstart.prevent
							/>
						</AssetGrid>
					</section>

					<section>
						<SectionHeader
							v-if="primaryRawVideo"
							variant="eyebrow"
							title="Clips"
							:count="filteredClips.length"
							class="mb-1"
						/>
						<p v-if="filteredClips.length === 0" class="text-xs text-fg-subtle">
							{{
								searchQuery
									? "No matching clips."
									: "No unbuilt clips in this project. Built clips appear in the Built clips tab."
							}}
						</p>
						<AssetGrid v-else :min="176">
							<ImportMediaTile
								v-for="clip in filteredClips"
								:key="clip.id"
								:label="getClipName(clip)"
								:sublabel="
									clip.start_time != null && clip.end_time != null
										? `${formatDuration(clip.start_time)} – ${formatDuration(clip.end_time)}`
										: undefined
								"
								:src="getCachedThumbnail(clip.id)"
								:icon="Film"
								:duration="formatDuration(getClipDuration(clip)) || undefined"
								:added="isAlreadyAdded(clip)"
								:busy="addingIds.has(clip.id)"
								:status="extractionStatus.get(clip.id) || 'Processing…'"
								:error="!addingIds.has(clip.id) ? extractionStatus.get(clip.id) : undefined"
								:action="isAlreadyAdded(clip) ? 'Add to timeline' : 'Add to media'"
								:class="{ 'pointer-events-none': addingIds.has(clip.id) }"
								:title="getClipName(clip)"
								@click="handleClipClick(clip)"
								@dblclick="addToTimeline(clip)"
								@keydown.enter="handleClipClick(clip)"
								@pointerdown="(e: PointerEvent) => handlePointerDown(e, clip)"
								@dragstart.prevent
							/>
						</AssetGrid>
					</section>
				</div>
			</template>
		</div>
	</div>
</template>
