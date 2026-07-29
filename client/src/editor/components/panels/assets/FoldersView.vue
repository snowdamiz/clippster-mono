<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAllAudioPlaylists, getPlaylistItemsWithAudio } from '@/services/database/audio-playlists';
import type { AudioPlaylist, DownloadedAudio } from '@/services/database/types';
import { useEditor } from '../../../composables/useEditor';
import { buildLibraryAudioElement } from '../../../lib/timeline/element-utils';
import { FolderOpen, Music, ChevronLeft, Loader2 } from 'lucide-vue-next';

const { editor } = useEditor({ subscribe: false });

const folders = ref<AudioPlaylist[]>([]);
const selectedFolder = ref<AudioPlaylist | null>(null);
const folderTracks = ref<Array<DownloadedAudio & { playlist_item_id: string }>>([]);
const isLoading = ref(true);

async function loadFolders() {
	try {
		isLoading.value = true;
		folders.value = await getAllAudioPlaylists();
	} catch (error) {
		console.error('Failed to load folders:', error);
	} finally {
		isLoading.value = false;
	}
}

async function openFolder(folder: AudioPlaylist) {
	selectedFolder.value = folder;
	try {
		const items = await getPlaylistItemsWithAudio(folder.id);
		folderTracks.value = items.map((item: any) => ({
			id: item.audio_id,
			title: item.audio_title,
			source: item.audio_source,
			platform: item.audio_platform,
			source_url: item.audio_source_url,
			file_path: item.audio_file_path,
			duration: item.audio_duration,
			file_size: item.audio_file_size,
			sample_rate: item.audio_sample_rate,
			channels: item.audio_channels,
			thumbnail_url: item.audio_thumbnail_url,
			user_id: item.audio_user_id,
			created_at: item.audio_created_at,
			updated_at: item.audio_updated_at,
			playlist_item_id: item.id,
		}));
	} catch (error) {
		console.error('Failed to load folder tracks:', error);
	}
}

function backToFolders() {
	selectedFolder.value = null;
	folderTracks.value = [];
}

function addAudioToTimeline(audio: DownloadedAudio) {
	const duration = audio.duration ?? 30;
	const startTime = editor.playback.getCurrentTime();
	
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

onMounted(() => {
	loadFolders();
});
</script>

<template>
	<div class="flex h-full flex-col bg-transparent">
		<!-- Loading state -->
		<div v-if="isLoading" class="flex-1 flex items-center justify-center">
			<Loader2 class="size-5 animate-spin text-blue-400" />
		</div>

		<!-- Folder list view -->
		<div v-else-if="!selectedFolder" class="flex-1 overflow-y-auto p-4">
			<!-- Empty state -->
			<div v-if="folders.length === 0" class="flex flex-col items-center justify-center gap-2 px-4 text-center h-full">
				<FolderOpen class="size-8 text-zinc-500" />
				<p class="text-sm text-zinc-400">No folders found</p>
				<p class="text-xs text-zinc-500">Create folders in the Audio Library page</p>
			</div>

			<!-- Folders grid -->
			<div v-else class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
				<div
					v-for="folder in folders"
					:key="folder.id"
					class="group relative overflow-hidden rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
					@click="openFolder(folder)"
				>
					<div class="relative aspect-video bg-zinc-800 flex items-center justify-center">
						<FolderOpen class="size-8 text-zinc-600" />
					</div>

					<!-- Info -->
					<div class="px-2 py-1.5 bg-zinc-900/90">
						<h3 class="text-xs font-medium text-zinc-200 truncate" :title="folder.name">
							{{ folder.name }}
						</h3>
						<p v-if="folder.description" class="text-[10px] text-zinc-500 truncate">
							{{ folder.description }}
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Folder contents view -->
		<div v-else class="flex-1 flex flex-col overflow-hidden">
			<!-- Header with back button -->
			<div class="flex items-center gap-2 border-b border-white/10 px-4 py-2 shrink-0">
				<button
					@click="backToFolders"
					class="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
				>
					<ChevronLeft class="size-3.5" />
					Back
				</button>
				<div class="flex-1">
					<h3 class="text-sm font-medium text-zinc-200">{{ selectedFolder.name }}</h3>
					<p v-if="selectedFolder.description" class="text-xs text-zinc-500">{{ selectedFolder.description }}</p>
				</div>
			</div>

			<!-- Empty folder state -->
			<div v-if="folderTracks.length === 0" class="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
				<Music class="size-8 text-zinc-500" />
				<p class="text-sm text-zinc-400">No audio in this folder</p>
			</div>

			<!-- Folder tracks grid -->
			<div v-else class="flex-1 overflow-y-auto p-4">
				<div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
					<div
						v-for="track in folderTracks"
						:key="track.playlist_item_id"
						:title="track.title"
						class="group relative overflow-hidden rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
						@click="addAudioToTimeline(track)"
					>
						<div class="relative aspect-video bg-zinc-800 flex items-center justify-center">
							<Music class="size-8 text-zinc-600" />
						</div>

						<!-- Info -->
						<div class="px-2 py-1.5 bg-zinc-900/90">
							<h3 class="text-xs font-medium text-zinc-200 truncate" :title="track.title">
								{{ track.title }}
							</h3>
							<div class="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-500">
								<span v-if="track.duration">{{ formatDuration(track.duration) }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
