<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { getAllDownloadedAudio } from '@/services/database/downloaded-audio';
import { getAllAudioPlaylists, getPlaylistItemsWithAudio, createAudioPlaylist } from '@/services/database/audio-playlists';
import type { DownloadedAudio, AudioPlaylist } from '@/services/database/types';
import { useEditor } from '../../../composables/useEditor';
import type { MediaAsset } from '../../../types/assets';
import { generateUUID } from '../../../utils/id';
import { editorMediaDestinationFilename, playbackFileLabel } from '@/utils/fsNames';
import { utf8ToBase64Url } from '@/utils/encoding';
import { hydrateVideoFileFromLocalUrl } from '../../../lib/media/hydrate-video-file-from-url';
import { Music, Search, Play, Loader2, ListMusic, ChevronLeft, Plus } from 'lucide-vue-next';

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		playback: false,
		timeline: false,
		scenes: false,
		media: false,
		selection: false,
	},
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const audioFiles = ref<DownloadedAudio[]>([]);
const playlists = ref<AudioPlaylist[]>([]);
const selectedPlaylist = ref<AudioPlaylist | null>(null);
const playlistTracks = ref<Array<DownloadedAudio & { playlist_item_id: string }>>([]);
const searchQuery = ref('');
const isLoading = ref(true);
const showCreatePlaylistDialog = ref(false);
const newPlaylistName = ref('');
const newPlaylistDescription = ref('');
/** Prevents double-submit while copying/hydrating a track into project media */
const addingAudioIds = ref<Set<string>>(new Set());

const filteredAudio = computed(() => {
	// Match standalone Audio Library: X Spaces (Twitter) live only under X Spaces, not Audio
	let filtered = audioFiles.value.filter(audio => audio.platform !== 'Twitter');
	if (!searchQuery.value) return filtered;
	const query = searchQuery.value.toLowerCase();
	return filtered.filter(audio => audio.title.toLowerCase().includes(query));
});

async function loadAudioFiles() {
	try {
		isLoading.value = true;
		audioFiles.value = await getAllDownloadedAudio();
		playlists.value = await getAllAudioPlaylists();
	} catch (error) {
		console.error('Failed to load audio files:', error);
	} finally {
		isLoading.value = false;
	}
}

async function openPlaylist(playlist: AudioPlaylist) {
	selectedPlaylist.value = playlist;
	try {
		const items = await getPlaylistItemsWithAudio(playlist.id);
		playlistTracks.value = items
			.map((item: any) => ({
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
			}))
			.filter((track: DownloadedAudio) => track.platform !== 'Twitter');
	} catch (error) {
		console.error('Failed to load playlist tracks:', error);
	}
}

function backToAudioList() {
	selectedPlaylist.value = null;
	playlistTracks.value = [];
}

async function createPlaylist() {
	if (!newPlaylistName.value.trim()) return;

	try {
		await createAudioPlaylist(
			newPlaylistName.value.trim(),
			newPlaylistDescription.value.trim() || undefined
		);

		newPlaylistName.value = '';
		newPlaylistDescription.value = '';
		showCreatePlaylistDialog.value = false;

		// Reload playlists
		playlists.value = await getAllAudioPlaylists();
	} catch (error) {
		console.error('Failed to create playlist:', error);
	}
}

function getAudioMimeFromPath(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
	const map: Record<string, string> = {
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		ogg: 'audio/ogg',
		aac: 'audio/aac',
		m4a: 'audio/mp4',
		flac: 'audio/flac',
	};
	return map[ext] || 'audio/mpeg';
}

async function addLibraryAudioToProjectMedia(audio: DownloadedAudio) {
	if (!activeProject.value) return;
	const sourcePath = audio.file_path?.trim();
	if (!sourcePath) return;
	if (addingAudioIds.value.has(audio.id)) return;

	addingAudioIds.value = new Set([...addingAudioIds.value, audio.id]);
	try {
		const projectId = activeProject.value.metadata.id;
		const displayName = audio.title;
		const mediaAssetId = generateUUID();
		const fileName = editorMediaDestinationFilename({
			id: mediaAssetId,
			displayName,
			sourcePathHint: sourcePath,
			kind: 'audio',
		});

		const destPath = await invoke<string>('copy_file_to_project_media', {
			sourcePath: sourcePath,
			projectId,
			fileName,
		});

		let videoServerPort = 8642;
		try {
			videoServerPort = await invoke<number>('get_video_server_port');
		} catch {
			// dev fallback
		}
		const url = `http://localhost:${videoServerPort}/video/${utf8ToBase64Url(destPath)}`;
		const mime = getAudioMimeFromPath(destPath);
		const playbackName = playbackFileLabel(destPath, displayName, 'audio');
		// Under editor-media, plugin-fs can read bytes; AudioManager uses `mediaAsset.file` for decode.
		const file = await hydrateVideoFileFromLocalUrl({
			url,
			name: playbackName,
			fallbackType: mime,
			diskPath: destPath,
		});

		const asset: Omit<MediaAsset, 'id'> = {
			name: displayName,
			type: 'audio',
			file,
			url,
			duration: audio.duration ?? undefined,
			ephemeral: false,
			alreadyResolvedFilePath: destPath,
		};
		if (audio.thumbnail_url) {
			asset.thumbnailUrl = audio.thumbnail_url;
		}

		await editor.media.addMediaAsset({
			projectId,
			asset,
			mediaAssetId,
		});
	} catch (error) {
		console.error('Failed to add audio to project media:', error);
	} finally {
		const next = new Set(addingAudioIds.value);
		next.delete(audio.id);
		addingAudioIds.value = next;
	}
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
		<!-- Header with back button (when in playlist view) -->
		<div v-if="selectedPlaylist" class="flex items-center gap-2 border-b border-white/10 px-4 py-2 shrink-0">
			<button
				@click="backToAudioList"
				class="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
			>
				<ChevronLeft class="size-3.5" />
				Back
			</button>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-zinc-200">{{ selectedPlaylist.name }}</h3>
				<p v-if="selectedPlaylist.description" class="text-xs text-zinc-500">{{ selectedPlaylist.description }}</p>
			</div>
		</div>

		<!-- Search bar (when not in playlist view) -->
		<div v-else class="flex items-center gap-2 border-b border-white/10 px-4 py-2 shrink-0">
			<div class="relative flex-1">
				<Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search audio..."
					class="w-full h-7 pl-8 pr-3 bg-zinc-800/50 border border-white/10 rounded text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
				/>
			</div>
			<button
				@click="showCreatePlaylistDialog = true"
				class="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
				title="Create playlist"
			>
				<Plus class="size-3.5" />
				Playlist
			</button>
		</div>

		<!-- Loading state -->
		<div v-if="isLoading" class="flex-1 flex items-center justify-center">
			<Loader2 class="size-5 animate-spin text-blue-400" />
		</div>

		<!-- Playlist contents view -->
		<div v-else-if="selectedPlaylist" class="flex-1 overflow-y-auto p-4">
			<!-- Empty playlist state -->
			<div v-if="playlistTracks.length === 0" class="flex flex-col items-center justify-center gap-2 px-4 text-center h-full">
				<Music class="size-8 text-zinc-500" />
				<p class="text-sm text-zinc-400">No audio in this playlist</p>
			</div>

			<!-- Playlist tracks grid -->
			<div v-else class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
				<div
					v-for="track in playlistTracks"
					:key="track.playlist_item_id"
					:title="track.title"
					class="group relative overflow-hidden rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
					@click="addLibraryAudioToProjectMedia(track)"
				>
					<div class="relative aspect-video bg-zinc-800 flex items-center justify-center">
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
						<h3 class="text-xs font-medium text-zinc-200 truncate" :title="track.title">
							{{ track.title }}
						</h3>
						<div class="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-500">
							<span v-if="track.duration">{{ formatDuration(track.duration) }}</span>
							<span v-if="track.duration && track.file_size" class="text-zinc-700">•</span>
							<span v-if="track.file_size">{{ formatFileSize(track.file_size) }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Empty state (no playlists or audio) -->
		<div v-else-if="playlists.length === 0 && filteredAudio.length === 0" class="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
			<Music class="size-8 text-zinc-500" />
			<p class="text-sm text-zinc-400">No audio files found</p>
			<p class="text-xs text-zinc-500">Download audio from the Audio Library page</p>
		</div>

		<!-- Audio list with playlists at top -->
		<div v-else class="flex-1 overflow-y-auto p-4">
			<div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
				<!-- Playlists (shown first) -->
				<div
					v-for="playlist in playlists"
					:key="'playlist-' + playlist.id"
					class="group relative overflow-hidden rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
					@click="openPlaylist(playlist)"
				>
					<div class="relative aspect-video bg-zinc-800 flex items-center justify-center">
						<ListMusic class="size-8 text-zinc-600" />
					</div>

					<!-- Info -->
					<div class="px-2 py-1.5 bg-zinc-900/90">
						<h3 class="text-xs font-medium text-zinc-200 truncate" :title="playlist.name">
							{{ playlist.name }}
						</h3>
						<p v-if="playlist.description" class="text-[10px] text-zinc-500 truncate">
							{{ playlist.description }}
						</p>
					</div>
				</div>

				<!-- Audio files -->
				<div
					v-for="audio in filteredAudio"
					:key="audio.id"
					:title="audio.title"
					class="group relative overflow-hidden rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
					@click="addLibraryAudioToProjectMedia(audio)"
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

		<!-- Create Playlist Dialog -->
		<div v-if="showCreatePlaylistDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreatePlaylistDialog = false">
			<div class="bg-[#1e1e22] border border-white/10 rounded-lg p-4 w-96" @click.stop>
				<h3 class="text-sm font-medium text-zinc-200 mb-3">Create Playlist</h3>
				
				<div class="space-y-3">
					<div>
						<label class="text-xs text-zinc-400 mb-1 block">Playlist Name *</label>
						<input
							v-model="newPlaylistName"
							type="text"
							placeholder="My Playlist"
							class="w-full px-3 py-2 bg-zinc-800/50 border border-white/10 rounded text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
							@keyup.enter="createPlaylist"
						/>
					</div>
					
					<div>
						<label class="text-xs text-zinc-400 mb-1 block">Description</label>
						<textarea
							v-model="newPlaylistDescription"
							rows="3"
							placeholder="Optional description"
							class="w-full px-3 py-2 bg-zinc-800/50 border border-white/10 rounded text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 resize-none"
						></textarea>
					</div>
				</div>

				<div class="flex gap-2 mt-4">
					<button
						@click="showCreatePlaylistDialog = false"
						class="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs rounded transition-colors"
					>
						Cancel
					</button>
					<button
						@click="createPlaylist"
						:disabled="!newPlaylistName.trim()"
						class="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs rounded transition-colors"
					>
						Create
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
