<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../../composables/useEditor";
import { getCompletedBuildEntries } from "@/services/database/clip-build";
import { searchTranscriptSegmentsByClipIds } from "@/services/database";
import type { Clip, ClipBuild } from "@/services/database/types";
import type { MediaAsset } from "../../../types/assets";
import { Film, Loader2, SearchX, Briefcase, Building2 } from "lucide-vue-next";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import AssetGrid from "../shared/AssetGrid.vue";
import ImportMediaTile from "./ImportMediaTile.vue";
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
		<!-- Toolbar -->
		<div class="flex h-12 shrink-0 items-center gap-3 px-5">
			<p class="tabular min-w-0 flex-1 truncate text-xs text-fg-muted">
				<template v-if="!loading">
					{{ searchQuery.trim() ? `${filteredBuilds.length} of ${allBuilds.length}` : allBuilds.length }}
					{{ allBuilds.length === 1 ? "built clip" : "built clips" }}
				</template>
			</p>
			<SearchField
				v-model="searchQuery"
				size="sm"
				input-class="text-xs"
				placeholder="Search by name or transcript…"
				class="w-64"
			/>
		</div>

		<!-- Content -->
		<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			<div v-if="loading" class="flex h-full items-center justify-center">
				<Loader2 class="size-5 animate-spin text-fg-subtle" />
			</div>

			<EmptyState
				v-else-if="filteredBuilds.length === 0"
				size="sm"
				class="h-full"
				:icon="searchQuery ? SearchX : Film"
				:title="searchQuery ? 'No matching built clips' : 'No built clips yet'"
				:description="
					searchQuery ? 'Try a different name or a phrase from the transcript.' : 'Build clips from your projects to see them here.'
				"
			/>

			<AssetGrid v-else :min="176">
				<ImportMediaTile
					v-for="entry in filteredBuilds"
					:key="entry.key"
					:label="getClipName(entry.clip)"
					:sublabel="entry.clip.project_name || undefined"
					:src="getCachedThumbnail(entry.build.id, entry.clip.id)"
					:icon="Film"
					:tag="entry.build.aspect_ratios ? JSON.parse(entry.build.aspect_ratios).join(', ') : undefined"
					:duration="formatDuration(entry.build.duration || entry.clip.duration) || undefined"
					:added="isAlreadyAdded(entry)"
					:busy="addingIds.has(entry.build.id)"
					:action="isAlreadyAdded(entry) ? 'Add to timeline' : 'Add to media'"
					:title="
						isAlreadyAdded(entry)
							? `Click to add ${getClipName(entry.clip)} at the playhead, or drag it to the timeline`
							: `Add ${getClipName(entry.clip)} to this edit's media`
					"
					@click="handleBuildClick(entry)"
					@dblclick="addToTimeline(entry)"
					@keydown.enter="handleBuildClick(entry)"
					@pointerdown="(e: PointerEvent) => handlePointerDown(e, entry)"
					@dragstart.prevent
				>
					<template #badges>
						<span
							v-if="entry.build.branding_type === 'campaign' && entry.build.campaign_name"
							class="inline-flex h-4 min-w-0 items-center gap-1 rounded bg-black/60 px-1 text-2xs leading-4 text-white"
							:title="`Campaign: ${entry.build.campaign_name}`"
						>
							<Briefcase class="size-2.5 shrink-0" />
							<span class="truncate">{{ entry.build.campaign_name }}</span>
						</span>
						<span
							v-else-if="entry.build.branding_type === 'org' && entry.build.organization_name"
							class="inline-flex h-4 min-w-0 items-center gap-1 rounded bg-black/60 px-1 text-2xs leading-4 text-white"
							:title="entry.build.organization_name"
						>
							<Building2
								class="size-2.5 shrink-0"
								:style="{ color: getOrgColor(entry.build.organization_id) }"
							/>
							<span class="truncate">{{ entry.build.organization_name }}</span>
						</span>
					</template>
				</ImportMediaTile>
			</AssetGrid>
		</div>
	</div>
</template>
