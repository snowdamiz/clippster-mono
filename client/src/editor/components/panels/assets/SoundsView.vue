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
	SearchX,
} from "lucide-vue-next";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import AssetListRow from "../shared/AssetListRow.vue";
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
		<div v-if="!configured" class="flex flex-1 flex-col justify-center p-3">
			<EmptyState size="sm" :icon="Headphones" title="Freesound integration">
				<template #description>
					Add <code class="rounded bg-surface-hover px-1 font-mono text-xs">VITE_FREESOUND_API_KEY</code> to your
					<code class="rounded bg-surface-hover px-1 font-mono text-xs">.env</code> file to enable sound search.
				</template>
				<a
					href="https://freesound.org/apiv2/apply/"
					target="_blank"
					:class="buttonVariants({ variant: 'link', size: 'sm' })"
				>
					Get a free API key
					<ExternalLink />
				</a>
			</EmptyState>
		</div>

		<!-- Configured: full UI -->
		<template v-else>
			<PanelSearchBar
				v-model="searchQuery"
				placeholder="Search sound effects…"
				@input="handleSearchInput"
				@keydown.enter="doSearch()"
			/>

			<!-- Scrollable content -->
			<div class="flex flex-1 flex-col overflow-y-auto p-3">
				<!-- Saved sounds section -->
				<template v-if="savedSounds.length > 0">
					<SectionHeader variant="eyebrow" title="Saved" :count="savedSounds.length" class="mb-1 min-h-0" />
					<div class="-mx-1 mb-3 space-y-px">
						<AssetListRow
							v-for="saved in savedSounds"
							:key="saved.id"
							:title="saved.name"
							:persistent-actions="addingSound === saved.id"
						>
							<template #leading>
								<button
									type="button"
									:class="[
										'grid size-8 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
										playingId === saved.id
											? 'border-brand-line bg-brand-soft text-brand'
											: 'border-line-subtle bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg',
									]"
									:title="playingId === saved.id ? 'Stop preview' : 'Play preview'"
									:aria-label="playingId === saved.id ? `Stop ${saved.name}` : `Play ${saved.name}`"
									@click="playSound(savedToSoundEffect(saved))"
								>
									<Pause v-if="playingId === saved.id" class="size-3.5" />
									<Play v-else class="size-3.5" />
								</button>
							</template>
							<template #meta>
								<span class="truncate">{{ saved.username }}</span>
								<span class="tabular shrink-0">· {{ formatDuration(saved.duration) }}</span>
							</template>
							<template #trailing>
								<Button
									variant="ghost"
									size="icon-xs"
									:loading="addingSound === saved.id"
									title="Add to timeline"
									:aria-label="`Add ${saved.name} to timeline`"
									@click="addSoundToTimeline(savedToSoundEffect(saved))"
								>
									<Plus v-if="addingSound !== saved.id" />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									class="text-brand hover:text-brand"
									title="Remove from saved"
									:aria-label="`Remove ${saved.name} from saved`"
									@click="toggleSaveSound(savedToSoundEffect(saved))"
								>
									<Heart class="fill-current" />
								</Button>
							</template>
						</AssetListRow>
					</div>
					<SectionHeader v-if="searchResponse" variant="eyebrow" title="Results" class="mb-1 min-h-0" />
				</template>

				<!-- Loading -->
				<div v-if="isSearching && !searchResponse" class="flex items-center justify-center py-12">
					<Loader2 class="size-5 animate-spin text-fg-subtle" />
				</div>

				<!-- No results -->
				<EmptyState
					v-else-if="searchResponse && unsavedResults.length === 0"
					size="sm"
					:icon="SearchX"
					title="No sounds found"
					description="Try a different search term."
				/>

				<!-- Search results list -->
				<div v-else-if="searchResponse && unsavedResults.length > 0" class="-mx-1 space-y-px">
					<AssetListRow
						v-for="sound in unsavedResults"
						:key="sound.id"
						:title="sound.name"
						:persistent-actions="addingSound === sound.id"
					>
						<template #leading>
							<button
								type="button"
								:class="[
									'grid size-8 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
									playingId === sound.id
										? 'border-brand-line bg-brand-soft text-brand'
										: 'border-line-subtle bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg',
								]"
								:title="playingId === sound.id ? 'Stop preview' : 'Play preview'"
								:aria-label="playingId === sound.id ? `Stop ${sound.name}` : `Play ${sound.name}`"
								@click="playSound(sound)"
							>
								<Pause v-if="playingId === sound.id" class="size-3.5" />
								<Play v-else class="size-3.5" />
							</button>
						</template>
						<template #meta>
							<span class="truncate">{{ sound.username }}</span>
							<span class="tabular shrink-0">· {{ formatDuration(sound.duration) }}</span>
						</template>
						<template #trailing>
							<Button
								variant="ghost"
								size="icon-xs"
								:loading="addingSound === sound.id"
								title="Add to timeline"
								:aria-label="`Add ${sound.name} to timeline`"
								@click="addSoundToTimeline(sound)"
							>
								<Plus v-if="addingSound !== sound.id" />
							</Button>
							<Button
								variant="ghost"
								size="icon-xs"
								:class="isSoundSaved(sound.id) && 'text-brand hover:text-brand'"
								:title="isSoundSaved(sound.id) ? 'Remove from saved' : 'Save sound'"
								:aria-label="isSoundSaved(sound.id) ? `Remove ${sound.name} from saved` : `Save ${sound.name}`"
								@click="toggleSaveSound(sound)"
							>
								<Heart :class="isSoundSaved(sound.id) && 'fill-current'" />
							</Button>
						</template>
					</AssetListRow>

					<!-- Load more -->
					<Button
						v-if="searchResponse.next"
						variant="ghost"
						size="sm"
						block
						class="mt-2"
						:loading="isLoadingMore"
						@click="loadMore"
					>
						{{ isLoadingMore ? 'Loading…' : 'Load more' }}
					</Button>
				</div>

				<!-- Empty state when nothing saved and no search yet -->
				<EmptyState
					v-else-if="savedSounds.length === 0 && !searchQuery"
					size="sm"
					:icon="Headphones"
					title="Search for sound effects"
					description="Powered by Freesound.org"
					class="flex-1"
				/>
			</div>
		</template>
	</div>
</template>
