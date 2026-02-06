<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../../composables/useEditor";
import { getAllClips } from "@/services/database/clips";
import type { Clip } from "@/services/database/types";
import type { MediaAsset } from "../../../types/assets";
import { Film, Plus, Loader2, Check, Search } from "lucide-vue-next";

const { editor, version } = useEditor();

const clips = ref<Clip[]>([]);
const loading = ref(false);
const addingIds = ref<Set<string>>(new Set());
const addedIds = ref<Set<string>>(new Set());
const searchQuery = ref("");

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActive();
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

function getClipThumbnail(clip: Clip): string | null {
	if (clip.built_thumbnail_path) {
		return clip.built_thumbnail_path;
	}
	return null;
}

function getThumbnailUrl(path: string, videoServerPort: number): string {
	const encoded = btoa(path);
	return `http://localhost:${videoServerPort}/video/${encoded}`;
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

async function loadClips() {
	loading.value = true;
	try {
		clips.value = await getAllClips();
	} catch (error) {
		console.error("[BuiltClipsView] Failed to load clips:", error);
	} finally {
		loading.value = false;
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

		// Generate thumbnail URL from built_thumbnail_path if available
		const thumbPath = getClipThumbnail(clip);
		if (thumbPath) {
			asset.thumbnailUrl = getThumbnailUrl(thumbPath, videoServerPort);
		}

		await editor.media.addMediaAsset({
			projectId: activeProject.value.metadata.id,
			asset,
		});

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
				style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr))"
			>
				<div
					v-for="clip in filteredClips"
					:key="clip.id"
					class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-white/20"
					:class="{ 'opacity-50': isAlreadyAdded(clip) }"
					@click="addClipToEditor(clip)"
				>
					<!-- Thumbnail -->
					<div class="relative aspect-video bg-zinc-800">
						<img
							v-if="getClipThumbnail(clip)"
							:src="getThumbnailUrl(getClipThumbnail(clip)!, 8642)"
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
