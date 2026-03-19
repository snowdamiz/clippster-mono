<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getAllDownloadedAudio } from '@/services/database/downloaded-audio';
import type { DownloadedAudio } from '@/services/database/types';
import { useEditor } from '../../../composables/useEditor';
import { buildLibraryAudioElement } from '../../../lib/timeline/element-utils';
import { Music, Search, Play, Loader2 } from 'lucide-vue-next';

const { editor } = useEditor();

const audioFiles = ref<DownloadedAudio[]>([]);
const searchQuery = ref('');
const isLoading = ref(true);

const filteredAudio = computed(() => {
	if (!searchQuery.value) return audioFiles.value;
	const query = searchQuery.value.toLowerCase();
	return audioFiles.value.filter(audio =>
		audio.title.toLowerCase().includes(query)
	);
});

async function loadAudioFiles() {
	try {
		isLoading.value = true;
		audioFiles.value = await getAllDownloadedAudio();
	} catch (error) {
		console.error('Failed to load audio files:', error);
	} finally {
		isLoading.value = false;
	}
}

function addAudioToTimeline(audio: DownloadedAudio) {
	const duration = audio.duration ?? 30;
	const startTime = editor.playback.getCurrentTime();
	
	// Create library audio element with file path as sourceUrl
	const element = buildLibraryAudioElement({
		sourceUrl: audio.file_path,
		name: audio.title,
		duration,
		startTime,
	});
	
	editor.timeline.insertElement({ element, placement: { mode: 'auto' } });
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${bytes} B`;
}

onMounted(() => {
	loadAudioFiles();
});
</script>

<template>
	<div class="flex h-full flex-col bg-transparent">
		<!-- Search bar -->
		<div class="flex items-center gap-2 border-b border-white/10 px-4 py-2 shrink-0">
			<div class="relative flex-1">
				<Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search audio..."
					class="w-full h-7 pl-8 pr-3 bg-zinc-800/50 border border-white/10 rounded text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
				/>
			</div>
		</div>

		<!-- Loading state -->
		<div v-if="isLoading" class="flex-1 flex items-center justify-center">
			<Loader2 class="size-5 animate-spin text-blue-400" />
		</div>

		<!-- Empty state -->
		<div v-else-if="filteredAudio.length === 0" class="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
			<Music class="size-8 text-zinc-500" />
			<p class="text-sm text-zinc-400">No audio files found</p>
			<p class="text-xs text-zinc-500">Download audio from the Audio Library page</p>
		</div>

		<!-- Audio grid -->
		<div v-else class="flex-1 overflow-y-auto p-4">
			<div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
				<div
					v-for="audio in filteredAudio"
					:key="audio.id"
					class="group relative overflow-hidden rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
					@click="addAudioToTimeline(audio)"
				>
					<!-- Thumbnail or Fallback -->
					<div
						v-if="audio.thumbnail_url"
						class="relative aspect-video bg-zinc-800"
						:style="{
							backgroundImage: `url(${convertFileSrc(audio.thumbnail_url)})`,
							backgroundSize: 'cover',
							backgroundPosition: 'center',
						}"
					>
						<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
					</div>
					<div v-else class="relative aspect-video bg-zinc-800 flex items-center justify-center">
						<Music class="size-8 text-zinc-600" />
					</div>

					<!-- Play button overlay -->
					<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
						<div class="rounded-full bg-blue-500 p-2">
							<Play class="size-4 text-white fill-white" />
						</div>
					</div>

					<!-- Info -->
					<div class="px-2 py-1.5 bg-zinc-900/90">
						<h3 class="text-xs font-medium text-zinc-200 truncate" :title="audio.title">
							{{ audio.title }}
						</h3>
						<div class="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-500">
							<span v-if="audio.duration">{{ formatDuration(audio.duration) }}</span>
							<span v-if="audio.duration && audio.file_size" class="text-zinc-700">•</span>
							<span v-if="audio.file_size">{{ formatFileSize(audio.file_size) }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
