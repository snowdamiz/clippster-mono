<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../../composables/useEditor";
import { getAllClips } from "@/services/database/clips";
import type { Clip } from "@/services/database/types";
import type { MediaAsset } from "../../../types/assets";
import { Film, Plus, Loader2, Check, Search } from "lucide-vue-next";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { buildVideoElement } from "../../../lib/timeline/element-utils";
import { setDragData } from "../../../lib/drag-data";
import type { CreateTimelineElement } from "../../../types/timeline";

const { editor, version } = useEditor();

const clips = ref<Clip[]>([]);
const loading = ref(false);
const addingIds = ref<Set<string>>(new Set());
const addedIds = ref<Set<string>>(new Set());
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

function getCachedThumbnail(clipId: string): string | undefined {
	return thumbnailCache.value.get(clipId);
}

function getClipName(clip: Clip): string {
	return clip.name || clip.project_name || "Untitled Clip";
}

function formatDuration(seconds: number | null): string {
	if (!seconds) return "";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function isAlreadyAdded(clip: Clip): boolean {
	const name = getClipName(clip);
	return existingMediaNames.value.has(name) || addedIds.value.has(clip.id);
}

function getMediaAssetId(clip: Clip): string | undefined {
	// Check our local map first
	const mapped = addedMediaIds.value.get(clip.id);
	if (mapped) return mapped;
	// Fall back to finding by name in the editor's assets
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

async function loadClips() {
	loading.value = true;
	try {
		clips.value = await getAllClips();
		await loadThumbnails();
	} catch (error) {
		console.error("[BuiltClipsView] Failed to load clips:", error);
	} finally {
		loading.value = false;
	}
}

async function loadThumbnails() {
	const clipsNeedingThumbs = builtClips.value.filter(
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
					console.warn(`[BuiltClipsView] Failed to load thumbnail for ${clip.id}:`, err);
				}
			}),
		);
	}
	if (hasNew) {
		thumbnailCache.value = new Map(thumbnailCache.value);
	}
}

async function addClipToEditor(clip: Clip) {
	if (!activeProject.value || !clip.built_file_path) return;
	if (addingIds.value.has(clip.id) || isAlreadyAdded(clip)) return;

	addingIds.value = new Set([...addingIds.value, clip.id]);

	try {
		let videoServerPort: number;
		try {
			videoServerPort = await invoke<number>("get_video_server_port");
		} catch {
			videoServerPort = 8642;
		}

		const encodedPath = btoa(clip.built_file_path);
		const url = `http://localhost:${videoServerPort}/video/${encodedPath}`;

		const mimeType = "video/mp4";
		const file = new File([], getClipName(clip), { type: mimeType });
		// Attach the path so the storage adapter can resolve it
		(file as File & { path?: string }).path = clip.built_file_path;

		const asset: Omit<MediaAsset, "id"> = {
			name: getClipName(clip),
			type: "video",
			file,
			url,
			duration: clip.built_duration ?? clip.duration ?? undefined,
			thumbnailUrl: undefined,
			ephemeral: false,
		};

		// Use cached data URL thumbnail if available
		const cachedThumb = getCachedThumbnail(clip.id);
		if (cachedThumb) {
			asset.thumbnailUrl = cachedThumb;
		}

		await editor.media.addMediaAsset({
			projectId: activeProject.value.metadata.id,
			asset,
		});

		// Track the mapping from clip ID to the newly added media asset ID
		const addedAsset = editor.media.getAssets().find((a) => a.name === getClipName(clip));
		if (addedAsset) {
			addedMediaIds.value = new Map([...addedMediaIds.value, [clip.id, addedAsset.id]]);
		}

		addedIds.value = new Set([...addedIds.value, clip.id]);
	} catch (error) {
		console.error("[BuiltClipsView] Failed to add clip:", error);
	} finally {
		const next = new Set(addingIds.value);
		next.delete(clip.id);
		addingIds.value = next;
	}
}

onMounted(loadClips);
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
					placeholder="Search built clips..."
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
				v-else-if="filteredClips.length === 0"
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

			<!-- Clips grid -->
			<div
				v-else
				class="grid gap-2"
				style="grid-template-columns: repeat(3, 1fr)"
			>
				<div
					v-for="clip in filteredClips"
					:key="clip.id"
						class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-white/20"
					:class="{ 'ring-1 ring-green-500/30': isAlreadyAdded(clip) }"
					:draggable="isAlreadyAdded(clip)"
					@click="handleClipClick(clip)"
					@dblclick="addToTimeline(clip)"
					@dragstart="(e: DragEvent) => handleDragStart(e, clip)"
				>
					<!-- Thumbnail -->
					<div class="relative aspect-video bg-zinc-800">
						<img
							v-if="getCachedThumbnail(clip.id)"
							:src="getCachedThumbnail(clip.id)!"
							:alt="getClipName(clip)"
							class="size-full object-cover"
							@error="($event.target as HTMLImageElement).style.display = 'none'"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<Film class="size-6 text-zinc-500" />
						</div>
						<!-- Duration badge -->
						<div
							v-if="clip.built_duration || clip.duration"
							class="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white"
						>
							{{ formatDuration(clip.built_duration || clip.duration) }}
						</div>
						<!-- Status overlay -->
						<div
							v-if="addingIds.has(clip.id)"
							class="absolute inset-0 flex items-center justify-center bg-black/50"
						>
							<Loader2 class="size-4 animate-spin text-white" />
						</div>
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
					<!-- Project name -->
					<div
						v-if="clip.project_name"
						class="truncate px-2 pb-1 text-[10px] text-zinc-500"
					>
						{{ clip.project_name }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
