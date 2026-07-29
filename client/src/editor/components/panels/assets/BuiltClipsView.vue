<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../../composables/useEditor";
import { getCompletedBuildEntries } from "@/services/database/clip-build";
import { searchTranscriptSegmentsByClipIds } from "@/services/database";
import type { Clip, ClipBuild } from "@/services/database/types";
import type { MediaAsset } from "../../../types/assets";
import { Film, Plus, Loader2, Check, Search, Briefcase, Building2 } from "lucide-vue-next";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { buildVideoElement } from "../../../lib/timeline/element-utils";
import { hydrateVideoFileFromLocalUrl } from "../../../lib/media/hydrate-video-file-from-url";
import { usePointerDrag } from "../../../composables/usePointerDrag";
import type { CreateTimelineElement } from "../../../types/timeline";
import { useClipThumbnailStore } from "@/stores/clipThumbnails";
import { utf8ToBase64Url } from "@/utils/encoding";

// Build entry combines clip info with specific build info
interface BuildEntry {
	clip: Clip;
	build: ClipBuild;
	key: string; // Unique key for v-for
}

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
const thumbnailStore = useClipThumbnailStore();

const allBuilds = ref<BuildEntry[]>([]); // Flattened list of all builds
const loading = ref(false);
const addingIds = ref<Set<string>>(new Set());
const addedIds = ref<Set<string>>(new Set());
const searchQuery = ref("");
const clipIdsWithTranscriptMatch = ref<Set<string>>(new Set());
const transcriptSearchTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null);
const addedMediaIds = ref<Map<string, string>>(new Map()); // buildId → mediaAssetId

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const existingMediaNames = computed(() => {
	void version.value;
	const assets = editor.media.getAssets();
	return new Set(assets.map((a) => a.name));
});

const filteredBuilds = computed(() => {
	if (!searchQuery.value.trim()) return allBuilds.value;
	const q = searchQuery.value.toLowerCase();
	return allBuilds.value.filter((entry) => {
		const clipName = entry.clip.name || entry.clip.project_name || "";
		const orgName = entry.build.organization_name || "";
		const campaignName = entry.build.campaign_name || "";
		return (
			clipName.toLowerCase().includes(q) ||
			orgName.toLowerCase().includes(q) ||
			campaignName.toLowerCase().includes(q) ||
			clipIdsWithTranscriptMatch.value.has(entry.clip.id)
		);
	});
});

async function performTranscriptSearch(query: string) {
	if (!query.trim()) {
		clipIdsWithTranscriptMatch.value = new Set();
		return;
	}

	const clipIds = [...new Set(allBuilds.value.map((entry) => entry.clip.id))];
	if (clipIds.length === 0) {
		clipIdsWithTranscriptMatch.value = new Set();
		return;
	}

	try {
		const matchedClipIds = await searchTranscriptSegmentsByClipIds(query, clipIds);
		clipIdsWithTranscriptMatch.value = new Set(matchedClipIds);
	} catch (error) {
		console.error("[BuiltClipsView] Failed to search transcripts:", error);
		clipIdsWithTranscriptMatch.value = new Set();
	}
}

function debouncedTranscriptSearch(query: string) {
	if (transcriptSearchTimeoutId.value !== null) {
		clearTimeout(transcriptSearchTimeoutId.value);
	}
	transcriptSearchTimeoutId.value = setTimeout(() => {
		void performTranscriptSearch(query);
	}, 300);
}

watch(searchQuery, (query) => {
	debouncedTranscriptSearch(query);
});

function getCachedThumbnail(buildId: string, clipId: string): string | undefined {
	// Try build-specific thumbnail first, then fall back to clip thumbnail from store
	return thumbnailStore.getBuildThumbnail(buildId) || thumbnailStore.getThumbnail(clipId) || undefined;
}

function getClipName(clip: Clip): string {
	return clip.name || clip.project_name || "Untitled Clip";
}

function getBuildDisplayName(entry: BuildEntry): string {
	const clipName = getClipName(entry.clip);
	const aspectRatios = entry.build.aspect_ratios ? JSON.parse(entry.build.aspect_ratios) : [];
	const ratioStr = aspectRatios.length > 0 ? ` (${aspectRatios.join(', ')})` : '';
	return `${clipName}${ratioStr}`;
}

function getBadgeInfo(build: ClipBuild): { type: 'org' | 'campaign' | null; name: string } {
	if (build.campaign_id && build.campaign_name) {
		return { type: 'campaign', name: build.campaign_name };
	}
	if (build.organization_id && build.organization_name) {
		return { type: 'org', name: build.organization_name };
	}
	return { type: null, name: '' };
}

// Generate consistent color for organization based on ID (same palette as run colors)
function getOrgColor(orgId: number | null): string {
	if (!orgId) return '#3B82F6'; // Default blue
	
	const colors = [
		'#8B5CF6', // Purple
		'#3B82F6', // Blue
		'#10B981', // Green
		'#F59E0B', // Amber
		'#EF4444', // Red
		'#06B6D4', // Cyan
		'#84CC16', // Lime
		'#EC4899', // Pink
		'#6366F1', // Indigo
		'#14B8A6', // Teal
		'#A855F7', // Violet
		'#F97316', // Orange
	];
	
	return colors[orgId % colors.length];
}

function formatDuration(seconds: number | null): string {
	if (!seconds) return "";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function isAlreadyAdded(entry: BuildEntry): boolean {
	return addedIds.value.has(entry.build.id);
}

function getMediaAssetId(entry: BuildEntry): string | undefined {
	return addedMediaIds.value.get(entry.build.id);
}

function addToTimeline(entry: BuildEntry) {
	const mediaId = getMediaAssetId(entry);
	if (!mediaId) return;
	const asset = editor.media.getAssets().find((a) => a.id === mediaId);
	if (!asset) return;
	const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
	const startTime = editor.playback.getCurrentTime();
	const element: CreateTimelineElement = buildVideoElement({ mediaId, name: asset.name, duration, startTime });
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

function handleBuildClick(entry: BuildEntry) {
	if (wasDragCompleted.value) return;
	if (isAlreadyAdded(entry)) {
		addToTimeline(entry);
	} else {
		addBuildToEditor(entry);
	}
}

function handlePointerDown(e: PointerEvent, entry: BuildEntry) {
	if (!isAlreadyAdded(entry)) return;
	const mediaId = getMediaAssetId(entry);
	if (!mediaId) return;
	startDrag(e, { id: mediaId, type: "media", mediaType: "video", name: getBuildDisplayName(entry) });
}

async function loadClips() {
	loading.value = true;
	try {
		const entries = await getCompletedBuildEntries();
		allBuilds.value = entries.map(({ clip, build }) => ({
			clip,
			build,
			key: build.id,
		}));
		// Show the list immediately; load thumbnails in the background.
		void loadThumbnails();
		if (searchQuery.value.trim()) {
			void performTranscriptSearch(searchQuery.value);
		}
	} catch (error) {
		console.error("[BuiltClipsView] Failed to load clips:", error);
	} finally {
		loading.value = false;
	}
}

async function loadThumbnails() {
	const clipsToThumb = [...new Map(allBuilds.value.map((e) => [e.clip.id, e.clip])).values()];
	await thumbnailStore.loadThumbnails(clipsToThumb);

	// Then collect and batch load build-specific thumbnails (for builds with custom thumbnails)
	const buildsToLoad: Array<{ key: string; thumbnailPath: string }> = [];
	
	for (const entry of allBuilds.value) {
		if (entry.build.thumbnail_path && !thumbnailStore.hasBuildThumbnail(entry.build.id)) {
			buildsToLoad.push({
				key: entry.build.id,
				thumbnailPath: entry.build.thumbnail_path,
			});
		}
	}

	if (buildsToLoad.length > 0) {
		await thumbnailStore.loadBuildThumbnails(buildsToLoad);
	}
}

async function addBuildToEditor(entry: BuildEntry) {
	if (!activeProject.value || !entry.build.file_path) return;
	if (addingIds.value.has(entry.build.id) || isAlreadyAdded(entry)) return;

	addingIds.value = new Set([...addingIds.value, entry.build.id]);

	try {
		let videoServerPort: number;
		try {
			videoServerPort = await invoke<number>("get_video_server_port");
		} catch {
			videoServerPort = 8642;
		}

		const encodedPath = utf8ToBase64Url(entry.build.file_path);
		const url = `http://localhost:${videoServerPort}/video/${encodedPath}`;

		const displayName = getBuildDisplayName(entry);
		const file = await hydrateVideoFileFromLocalUrl({
			url,
			name: displayName,
			fallbackType: "video/mp4",
			diskPath: entry.build.file_path,
		});

		const asset: Omit<MediaAsset, "id"> = {
			name: displayName,
			type: "video",
			file,
			url,
			duration: entry.build.duration ?? entry.clip.duration ?? undefined,
			thumbnailUrl: undefined,
			ephemeral: false,
			diskImportPath: entry.build.file_path,
		};

		// Use cached data URL thumbnail if available
		const cachedThumb = getCachedThumbnail(entry.build.id, entry.clip.id);
		if (cachedThumb) {
			asset.thumbnailUrl = cachedThumb;
		}

		await editor.media.addMediaAsset({
			projectId: activeProject.value.metadata.id,
			asset,
		});

		// Track the mapping from build ID to the newly added media asset ID
		const addedAsset = editor.media.getAssets().find((a) => a.name === displayName);
		if (addedAsset) {
			addedMediaIds.value = new Map([...addedMediaIds.value, [entry.build.id, addedAsset.id]]);
		}

		addedIds.value = new Set([...addedIds.value, entry.build.id]);
	} catch (error) {
		console.error("[BuiltClipsView] Failed to add build:", error);
	} finally {
		const next = new Set(addingIds.value);
		next.delete(entry.build.id);
		addingIds.value = next;
	}
}

onMounted(loadClips);

onUnmounted(() => {
	if (transcriptSearchTimeoutId.value !== null) {
		clearTimeout(transcriptSearchTimeoutId.value);
	}
});
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Search -->
		<div class="border-b border-white/10 px-3 py-2">
			<div class="relative">
				<Search class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search by name or transcript..."
					class="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-7 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500/50"
				/>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-3">
			<!-- Loading -->
			<div v-if="loading" class="flex h-full items-center justify-center">
				<Loader2 class="size-6 animate-spin text-zinc-500" />
			</div>

			<!-- Empty -->
			<div
				v-else-if="filteredBuilds.length === 0"
				class="flex h-full flex-col items-center justify-center gap-2 text-center"
			>
				<Film class="size-8 text-zinc-600" />
				<p class="text-sm text-zinc-500">
					{{ searchQuery ? "No matching built clips" : "No built clips yet" }}
				</p>
				<p class="text-xs text-zinc-600">
					Build clips from your projects to see them here
				</p>
			</div>

			<!-- Builds grid -->
			<div
				v-else
				class="grid gap-2"
				style="grid-template-columns: repeat(3, 1fr)"
			>
				<div
					v-for="entry in filteredBuilds"
					:key="entry.key"
					class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-white/20"
					:class="{ 'ring-1 ring-green-500/30': isAlreadyAdded(entry) }"
					@click="handleBuildClick(entry)"
					@dblclick="addToTimeline(entry)"
					@pointerdown="(e: PointerEvent) => handlePointerDown(e, entry)"
					@dragstart.prevent
				>
					<!-- Thumbnail -->
					<div class="relative aspect-video bg-zinc-800">
						<img
							v-if="getCachedThumbnail(entry.build.id, entry.clip.id)"
							:src="getCachedThumbnail(entry.build.id, entry.clip.id)!"
							:alt="getClipName(entry.clip)"
							class="size-full object-cover"
							draggable="false"
							@error="($event.target as HTMLImageElement).style.display = 'none'"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<Film class="size-6 text-zinc-500" />
						</div>
						<!-- Org/Campaign badge -->
						<div
							v-if="entry.build.branding_type === 'campaign' && entry.build.campaign_name"
							class="absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
							style="background-color: rgba(249, 115, 22, 0.9);"
							:title="`Campaign: ${entry.build.campaign_name}`"
						>
							<Briefcase class="size-2.5" />
							<span class="max-w-[60px] truncate">{{ entry.build.campaign_name }}</span>
						</div>
						<div
							v-else-if="entry.build.branding_type === 'org' && entry.build.organization_name"
							class="absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
							:style="{ backgroundColor: getOrgColor(entry.build.organization_id) + 'E6' }"
							:title="entry.build.organization_name"
						>
							<Building2 class="size-2.5" />
							<span class="max-w-[60px] truncate">{{ entry.build.organization_name }}</span>
						</div>
						<!-- Aspect ratio badge -->
						<div
							v-if="entry.build.aspect_ratios"
							class="absolute right-1 top-1 rounded bg-black/70 px-1 text-[9px] text-white"
						>
							{{ JSON.parse(entry.build.aspect_ratios).join(', ') }}
						</div>
						<!-- Duration badge -->
						<div
							v-if="entry.build.duration || entry.clip.duration"
							class="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white"
						>
							{{ formatDuration(entry.build.duration || entry.clip.duration) }}
						</div>
						<!-- Status overlay -->
						<div
							v-if="addingIds.has(entry.build.id)"
							class="absolute inset-0 flex items-center justify-center bg-black/50"
						>
							<Loader2 class="size-4 animate-spin text-white" />
						</div>
						<div
							v-else-if="isAlreadyAdded(entry)"
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
						{{ getClipName(entry.clip) }}
					</div>
					<!-- Project name -->
					<div
						v-if="entry.clip.project_name"
						class="truncate px-2 pb-1 text-[10px] text-zinc-500"
					>
						{{ entry.clip.project_name }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
