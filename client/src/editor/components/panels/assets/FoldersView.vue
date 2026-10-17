<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAllAudioPlaylists, getPlaylistItemsWithAudio } from '@/services/database/audio-playlists';
import type { AudioPlaylist, DownloadedAudio } from '@/services/database/types';
import { useEditor } from '../../../composables/useEditor';
import { buildLibraryAudioElement } from '../../../lib/timeline/element-utils';
import { FolderOpen, Music, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-vue-next';
import { EmptyState } from '@/components/ui/empty-state';
import { IconTile } from '@/components/ui/icon-tile';
import PanelHeader from '../../chrome/PanelHeader.vue';
import ToolbarButton from '../../chrome/ToolbarButton.vue';
import AssetListRow from '../shared/AssetListRow.vue';

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
	<div class="flex h-full flex-col">
		<!-- Loading state -->
		<div v-if="isLoading" class="flex flex-1 items-center justify-center">
			<Loader2 class="size-5 animate-spin text-fg-subtle" />
		</div>

		<!-- Folder list view -->
		<div v-else-if="!selectedFolder" class="flex-1 overflow-y-auto p-3">
			<EmptyState
				v-if="folders.length === 0"
				size="sm"
				class="h-full"
				:icon="FolderOpen"
				title="No folders found"
				description="Create folders in the Audio Library page."
			/>

			<div v-else class="-mx-1 space-y-px">
				<AssetListRow
					v-for="folder in folders"
					:key="folder.id"
					as="button"
					:title="folder.name"
					:meta="folder.description || undefined"
					persistent-actions
					@click="openFolder(folder)"
				>
					<template #leading>
						<IconTile :icon="FolderOpen" size="md" />
					</template>
					<template #trailing>
						<ChevronRight class="size-3.5 text-fg-subtle" />
					</template>
				</AssetListRow>
			</div>
		</div>

		<!-- Folder contents view -->
		<div v-else class="flex flex-1 flex-col overflow-hidden">
			<PanelHeader class="pl-1.5">
				<template #title>
					<ToolbarButton label="Back to folders" @click="backToFolders">
						<ChevronLeft />
					</ToolbarButton>
					<span class="min-w-0 flex-1 truncate text-xs font-medium text-fg" :title="selectedFolder.name">
						{{ selectedFolder.name }}
					</span>
				</template>
			</PanelHeader>

			<EmptyState
				v-if="folderTracks.length === 0"
				size="sm"
				class="flex-1"
				:icon="Music"
				title="No audio in this folder"
			/>

			<div v-else class="flex-1 overflow-y-auto p-3">
				<p v-if="selectedFolder.description" class="mb-2 text-2xs text-fg-subtle">
					{{ selectedFolder.description }}
				</p>
				<div class="-mx-1 space-y-px">
					<AssetListRow
						v-for="track in folderTracks"
						:key="track.playlist_item_id"
						:title="track.title"
						:meta="track.duration ? formatDuration(track.duration) : undefined"
						class="cursor-pointer"
						role="button"
						tabindex="0"
						:aria-label="`Add ${track.title} to the timeline`"
						@click="addAudioToTimeline(track)"
						@keydown.enter="addAudioToTimeline(track)"
					>
						<template #leading>
							<div class="grid size-8 place-items-center rounded-md bg-surface-sunken">
								<Music class="size-4 text-fg-subtle" />
							</div>
						</template>
						<template #trailing>
							<Plus class="mr-1 size-3.5 text-fg-subtle" />
						</template>
					</AssetListRow>
				</div>
			</div>
		</div>
	</div>
</template>
