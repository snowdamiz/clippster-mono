<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { buildLibraryAudioElement } from "../../../lib/timeline/element-utils";
import {
	searchSounds,
	isFreesoundConfigured,
	type FreesoundSearchResponse,
} from "../../../lib/freesound-api";
import type { SoundEffect, SavedSound } from "../../../types/sounds";
import {
	Loader2,
	Play,
	Pause,
	Plus,
	Heart,
	Headphones,
	ExternalLink,
} from "lucide-vue-next";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor({ subscribe: false });

const searchQuery = ref("");
const isSearching = ref(false);
const searchResponse = ref<FreesoundSearchResponse | null>(null);
const currentPage = ref(1);
const isLoadingMore = ref(false);
const addingSound = ref<number | null>(null);

const playingId = ref<number | null>(null);
const audioElement = ref<HTMLAudioElement | null>(null);

const SAVED_SOUNDS_KEY = "clippster:saved-sounds";

function loadSavedSounds(): SavedSound[] {
	try {
		const raw = localStorage.getItem(SAVED_SOUNDS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

const savedSounds = ref<SavedSound[]>(loadSavedSounds());

watch(savedSounds, (val) => {
	localStorage.setItem(SAVED_SOUNDS_KEY, JSON.stringify(val));
}, { deep: true });

const configured = computed(() => isFreesoundConfigured());

let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function handleSearchInput() {
	if (searchDebounce) clearTimeout(searchDebounce);
	searchDebounce = setTimeout(() => {
		if (searchQuery.value.trim()) {
			currentPage.value = 1;
			doSearch();
		} else {
			searchResponse.value = null;
		}
	}, 400);
}

async function doSearch(query?: string) {
	const searchTerm = query || searchQuery.value.trim();
	if (!searchTerm) return;
	isSearching.value = true;
	try {
		searchResponse.value = await searchSounds({
			query: searchTerm,
			page: currentPage.value,
			pageSize: 15,
		});
	} catch (error) {
		console.error("Sound search failed:", error);
		searchResponse.value = null;
	} finally {
		isSearching.value = false;
	}
}

// Load default trending sounds on mount
onMounted(() => {
	if (configured.value) {
		// Load popular/trending sounds by default
		doSearch("popular");
	}
});

async function loadMore() {
	if (!searchResponse.value?.next || isLoadingMore.value) return;
	isLoadingMore.value = true;
	currentPage.value++;
	try {
		const more = await searchSounds({
			query: searchQuery.value,
			page: currentPage.value,
			pageSize: 15,
		});
		if (searchResponse.value) {
			searchResponse.value = {
				...more,
				results: [...searchResponse.value.results, ...more.results],
			};
		}
	} catch (error) {
		console.error("Failed to load more sounds:", error);
	} finally {
		isLoadingMore.value = false;
	}
}

function playSound(sound: SoundEffect) {
	if (playingId.value === sound.id) {
		stopPlayback();
		return;
	}

	stopPlayback();

	if (!sound.previewUrl) return;

	const audio = new Audio(sound.previewUrl);
	audio.volume = 0.5;
	audio.addEventListener("ended", () => {
		playingId.value = null;
		audioElement.value = null;
	});
	audio.play().catch((err) => {
		console.error("Failed to play sound:", err);
		playingId.value = null;
	});

	audioElement.value = audio;
	playingId.value = sound.id;
}

function stopPlayback() {
	if (audioElement.value) {
		audioElement.value.pause();
		audioElement.value.currentTime = 0;
		audioElement.value = null;
	}
	playingId.value = null;
}

async function addSoundToTimeline(sound: SoundEffect) {
	const audioUrl = sound.previewUrl;
	if (!audioUrl) return;

	addingSound.value = sound.id;
	try {
		// Download audio to local storage via Tauri
		const filename = `freesound_${sound.id}_${sound.name.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
		const { invoke } = await import('@tauri-apps/api/core');
		const localFilePath = await invoke<string>('download_library_audio', {
			url: audioUrl,
			filename,
		});

		// Decode audio for preview playback
		const response = await fetch(audioUrl);
		if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);

		const arrayBuffer = await response.arrayBuffer();
		const audioContext = new AudioContext();
		const buffer = await audioContext.decodeAudioData(arrayBuffer);

		const currentTime = editor.playback.getCurrentTime();
		const element = buildLibraryAudioElement({
			sourceUrl: localFilePath,
			name: sound.name,
			duration: sound.duration,
			startTime: currentTime,
			buffer,
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	} catch (error) {
		console.error("Failed to add sound to timeline:", error);
	} finally {
		addingSound.value = null;
	}
}

function isSoundSaved(soundId: number): boolean {
	return savedSounds.value.some((s) => s.id === soundId);
}

function toggleSaveSound(sound: SoundEffect) {
	if (isSoundSaved(sound.id)) {
		savedSounds.value = savedSounds.value.filter((s) => s.id !== sound.id);
	} else {
		savedSounds.value.push({
			id: sound.id,
			name: sound.name,
			username: sound.username,
			previewUrl: sound.previewUrl,
			downloadUrl: sound.downloadUrl,
			duration: sound.duration,
			tags: sound.tags,
			license: sound.license,
			savedAt: new Date().toISOString(),
		});
	}
}

function savedToSoundEffect(saved: SavedSound): SoundEffect {
	return {
		id: saved.id,
		name: saved.name,
		description: "",
		url: "",
		previewUrl: saved.previewUrl,
		downloadUrl: saved.downloadUrl,
		duration: saved.duration,
		filesize: 0,
		type: "",
		channels: 0,
		bitrate: 0,
		bitdepth: 0,
		samplerate: 0,
		username: saved.username,
		tags: saved.tags,
		license: saved.license,
		created: "",
		downloads: 0,
		rating: 0,
		ratingCount: 0,
	};
}

const unsavedResults = computed(() =>
	searchResponse.value?.results.filter((s) => !isSoundSaved(s.id)) ?? [],
);

function formatDuration(seconds: number): string {
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

onUnmounted(() => {
	stopPlayback();
});
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Not configured message -->
		<div v-if="!configured" class="flex flex-1 flex-col items-center justify-center gap-3 p-4">
			<Headphones class="size-10 text-zinc-600" :stroke-width="1" />
			<div class="flex flex-col gap-2 text-center">
				<p class="text-sm font-medium text-zinc-300">Freesound Integration</p>
				<p class="text-xs text-zinc-500 text-balance">
					Add <code class="rounded bg-white/10 px-1">VITE_FREESOUND_API_KEY</code> to your
					<code class="rounded bg-white/10 px-1">.env</code> file to enable sound search.
				</p>
				<a
					href="https://freesound.org/apiv2/apply/"
					target="_blank"
					class="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
				>
					Get a free API key
					<ExternalLink class="size-3" />
				</a>
			</div>
		</div>

		<!-- Configured: full UI -->
		<template v-else>
			<!-- Search bar -->
			<PanelSearchBar
				v-model="searchQuery"
				placeholder="Search sound effects..."
				@input="handleSearchInput"
				@keydown.enter="doSearch"
			/>

			<!-- Scrollable content -->
			<div class="flex-1 overflow-y-auto">
				<!-- Saved sounds section -->
				<template v-if="savedSounds.length > 0">
					<div class="px-3 py-1.5">
						<span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Saved</span>
					</div>
					<div class="flex flex-col">
						<div
							v-for="saved in savedSounds"
							:key="saved.id"
							class="group flex items-center gap-3 border-b border-white/5 px-3 py-2 transition-colors hover:bg-white/5"
						>
							<button
								type="button"
								class="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5"
								@click="playSound(savedToSoundEffect(saved))"
							>
								<div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent" />
								<Play v-if="playingId !== saved.id" class="size-4 text-zinc-300" />
								<Pause v-else class="size-4 text-zinc-300" />
							</button>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-zinc-200">{{ saved.name }}</p>
								<div class="flex items-center gap-2">
									<span class="text-xs text-zinc-500">{{ saved.username }}</span>
									<span class="text-xs text-zinc-600">{{ formatDuration(saved.duration) }}</span>
								</div>
							</div>
							<div class="flex items-center gap-1">
								<button
									type="button"
									class="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
									:class="addingSound === saved.id && 'pointer-events-none opacity-50'"
									title="Add to timeline"
									@click="addSoundToTimeline(savedToSoundEffect(saved))"
								>
									<Loader2 v-if="addingSound === saved.id" class="size-4 animate-spin" />
									<Plus v-else class="size-4" />
								</button>
								<button
									type="button"
									class="rounded p-1.5 text-red-400 transition-colors hover:bg-white/5 hover:text-red-300"
									title="Remove from saved"
									@click="toggleSaveSound(savedToSoundEffect(saved))"
								>
									<Heart class="size-4 fill-current" />
								</button>
							</div>
						</div>
					</div>
					<div v-if="searchResponse" class="px-3 py-1.5">
						<span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Results</span>
					</div>
				</template>

				<!-- Loading -->
				<div v-if="isSearching && !searchResponse" class="flex items-center justify-center py-12">
					<Loader2 class="size-6 animate-spin text-zinc-500" />
				</div>

				<!-- No results -->
				<div v-else-if="searchResponse && unsavedResults.length === 0" class="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p class="text-sm text-zinc-400">No sounds found</p>
					<p class="text-xs text-zinc-500">Try a different search term</p>
				</div>

				<!-- Search results list -->
				<div v-else-if="searchResponse && unsavedResults.length > 0" class="flex flex-col">
					<div
						v-for="sound in unsavedResults"
						:key="sound.id"
						class="group flex items-center gap-3 border-b border-white/5 px-3 py-2 transition-colors hover:bg-white/5"
					>
						<button
							type="button"
							class="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5"
							@click="playSound(sound)"
						>
							<div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent" />
							<Play v-if="playingId !== sound.id" class="size-4 text-zinc-300" />
							<Pause v-else class="size-4 text-zinc-300" />
						</button>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-zinc-200">{{ sound.name }}</p>
							<div class="flex items-center gap-2">
								<span class="text-xs text-zinc-500">{{ sound.username }}</span>
								<span class="text-xs text-zinc-600">{{ formatDuration(sound.duration) }}</span>
							</div>
						</div>
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
								:class="addingSound === sound.id && 'pointer-events-none opacity-50'"
								title="Add to timeline"
								@click="addSoundToTimeline(sound)"
							>
								<Loader2 v-if="addingSound === sound.id" class="size-4 animate-spin" />
								<Plus v-else class="size-4" />
							</button>
							<button
								type="button"
								class="rounded p-1.5 transition-colors hover:bg-white/5"
								:class="isSoundSaved(sound.id) ? 'text-red-400 hover:text-red-300' : 'text-zinc-500 hover:text-zinc-300'"
								:title="isSoundSaved(sound.id) ? 'Remove from saved' : 'Save sound'"
								@click="toggleSaveSound(sound)"
							>
								<Heart class="size-4" :class="isSoundSaved(sound.id) && 'fill-current'" />
							</button>
						</div>
					</div>

					<!-- Load more -->
					<button
						v-if="searchResponse.next"
						type="button"
						class="flex items-center justify-center gap-2 px-3 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
						:disabled="isLoadingMore"
						@click="loadMore"
					>
						<Loader2 v-if="isLoadingMore" class="size-3.5 animate-spin" />
						<span>{{ isLoadingMore ? 'Loading...' : 'Load more' }}</span>
					</button>
				</div>

				<!-- Empty state when nothing saved and no search yet -->
				<div v-else-if="savedSounds.length === 0 && !searchQuery" class="flex flex-col items-center justify-center gap-3 p-6 pt-12">
					<Headphones class="size-10 text-zinc-600" :stroke-width="1" />
					<div class="flex flex-col gap-1 text-center">
						<p class="text-sm text-zinc-400">Search for sound effects</p>
						<p class="text-xs text-zinc-500">Powered by Freesound.org</p>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
