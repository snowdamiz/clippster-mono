<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import { getAllDownloadedAudio } from '@/services/database/downloaded-audio';
  import {
    getAllAudioPlaylists,
    getPlaylistItemsWithAudio,
    createAudioPlaylist,
  } from '@/services/database/audio-playlists';
  import type { DownloadedAudio, AudioPlaylist } from '@/services/database/types';
  import { useEditor } from '../../../composables/useEditor';
  import type { MediaAsset } from '../../../types/assets';
  import { generateUUID } from '../../../utils/id';
  import { editorMediaDestinationFilename, playbackFileLabel } from '@/utils/fsNames';
  import { utf8ToBase64Url } from '@/utils/encoding';
  import { hydrateVideoFileFromLocalUrl } from '../../../lib/media/hydrate-video-file-from-url';
  import { Music, Loader2, ListMusic, ArrowLeft, ChevronRight, Plus, SearchX } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';
  import { SectionHeader } from '@/components/ui/section-header';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Modal } from '@/components/ui/modal';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import AssetListRow from '../shared/AssetListRow.vue';

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
    let filtered = audioFiles.value.filter((audio) => audio.platform !== 'Twitter');
    if (!searchQuery.value) return filtered;
    const query = searchQuery.value.toLowerCase();
    return filtered.filter((audio) => audio.title.toLowerCase().includes(query));
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
      await createAudioPlaylist(newPlaylistName.value.trim(), newPlaylistDescription.value.trim() || undefined);

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
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar: breadcrumb inside a playlist, search + new playlist at the root -->
    <div class="flex h-12 shrink-0 items-center gap-3 px-5">
      <template v-if="selectedPlaylist">
        <div class="flex min-w-0 flex-1 items-center gap-1">
          <Button variant="ghost" size="sm" class="-ml-2.5 shrink-0" @click="backToAudioList">
            <ArrowLeft />
            Audio
          </Button>
          <ChevronRight class="size-3.5 shrink-0 text-fg-subtle" />
          <span class="truncate text-sm font-medium text-fg" :title="selectedPlaylist.name">
            {{ selectedPlaylist.name }}
          </span>
          <span v-if="selectedPlaylist.description" class="ml-1 truncate text-xs text-fg-subtle">
            {{ selectedPlaylist.description }}
          </span>
        </div>
      </template>
      <template v-else>
        <p class="tabular min-w-0 flex-1 truncate text-xs text-fg-muted">
          <template v-if="!isLoading">
            {{ filteredAudio.length }} {{ filteredAudio.length === 1 ? 'track' : 'tracks' }}
            <template v-if="playlists.length > 0">
              · {{ playlists.length }} {{ playlists.length === 1 ? 'playlist' : 'playlists' }}
            </template>
          </template>
        </p>
        <SearchField v-model="searchQuery" size="sm" input-class="text-xs" placeholder="Search audio…" class="w-64" />
        <Button variant="secondary" size="sm" @click="showCreatePlaylistDialog = true">
          <Plus />
          New playlist
        </Button>
      </template>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex flex-1 items-center justify-center">
      <Loader2 class="size-5 animate-spin text-fg-subtle" />
    </div>

    <!-- Playlist contents view -->
    <div v-else-if="selectedPlaylist" class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
      <EmptyState
        v-if="playlistTracks.length === 0"
        size="sm"
        class="h-full"
        :icon="Music"
        title="No audio in this playlist"
        description="Add tracks to it from the Audio Library page."
      />

      <div v-else class="-mx-2 space-y-px">
        <AssetListRow
          v-for="track in playlistTracks"
          :key="track.playlist_item_id"
          :title="track.title"
          :persistent-actions="addingAudioIds.has(track.id)"
          class="cursor-pointer"
          role="button"
          tabindex="0"
          :aria-label="`Add ${track.title} to media`"
          @click="addLibraryAudioToProjectMedia(track)"
          @keydown.enter="addLibraryAudioToProjectMedia(track)"
        >
          <template #leading>
            <div class="grid size-9 place-items-center overflow-hidden rounded-md bg-surface-sunken">
              <Music class="size-4 text-fg-subtle" />
            </div>
          </template>
          <template #meta>
            <span v-if="track.duration" class="tabular">{{ formatDuration(track.duration) }}</span>
            <span v-if="track.duration && track.file_size">·</span>
            <span v-if="track.file_size" class="tabular">{{ formatFileSize(track.file_size) }}</span>
          </template>
          <template #trailing>
            <Loader2 v-if="addingAudioIds.has(track.id)" class="mr-1.5 size-3.5 animate-spin text-fg-subtle" />
            <Button v-else variant="ghost" size="xs" tabindex="-1" @click.stop="addLibraryAudioToProjectMedia(track)">
              <Plus />
              Add
            </Button>
          </template>
        </AssetListRow>
      </div>
    </div>

    <!-- Empty state (no playlists or audio) -->
    <EmptyState
      v-else-if="playlists.length === 0 && filteredAudio.length === 0"
      size="sm"
      class="flex-1"
      :icon="searchQuery ? SearchX : Music"
      :title="searchQuery ? 'No matching audio' : 'No audio files found'"
      :description="searchQuery ? 'Try a different search term.' : 'Download audio from the Audio Library page.'"
    />

    <!-- Playlists, then tracks -->
    <div v-else class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
      <section v-if="playlists.length > 0">
        <SectionHeader variant="eyebrow" title="Playlists" class="mb-1" />
        <div class="-mx-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-px">
          <AssetListRow
            v-for="playlist in playlists"
            :key="'playlist-' + playlist.id"
            as="button"
            :title="playlist.name"
            :meta="playlist.description || undefined"
            persistent-actions
            @click="openPlaylist(playlist)"
          >
            <template #leading>
              <IconTile :icon="ListMusic" size="md" />
            </template>
            <template #trailing>
              <ChevronRight class="size-3.5 text-fg-subtle" />
            </template>
          </AssetListRow>
        </div>
      </section>

      <section>
        <SectionHeader variant="eyebrow" title="Tracks" class="mb-1" />
        <EmptyState
          v-if="filteredAudio.length === 0"
          size="sm"
          :icon="searchQuery ? SearchX : Music"
          :title="searchQuery ? 'No matching audio' : 'No audio files found'"
          :description="searchQuery ? 'Try a different search term.' : 'Download audio from the Audio Library page.'"
        />
        <div v-else class="-mx-2 space-y-px">
          <AssetListRow
            v-for="audio in filteredAudio"
            :key="audio.id"
            :title="audio.title"
            :persistent-actions="addingAudioIds.has(audio.id)"
            class="cursor-pointer"
            role="button"
            tabindex="0"
            :aria-label="`Add ${audio.title} to media`"
            @click="addLibraryAudioToProjectMedia(audio)"
            @keydown.enter="addLibraryAudioToProjectMedia(audio)"
          >
            <template #leading>
              <div class="grid size-9 place-items-center overflow-hidden rounded-md bg-surface-sunken">
                <img
                  v-if="audio.thumbnail_url"
                  :src="convertFileSrc(audio.thumbnail_url)"
                  :alt="audio.title"
                  class="size-full object-cover"
                  draggable="false"
                />
                <Music v-else class="size-4 text-fg-subtle" />
              </div>
            </template>
            <template #meta>
              <span v-if="audio.duration" class="tabular">{{ formatDuration(audio.duration) }}</span>
              <span v-if="audio.duration && audio.file_size">·</span>
              <span v-if="audio.file_size" class="tabular">{{ formatFileSize(audio.file_size) }}</span>
            </template>
            <template #trailing>
              <Loader2 v-if="addingAudioIds.has(audio.id)" class="mr-1.5 size-3.5 animate-spin text-fg-subtle" />
              <Button v-else variant="ghost" size="xs" tabindex="-1" @click.stop="addLibraryAudioToProjectMedia(audio)">
                <Plus />
                Add
              </Button>
            </template>
          </AssetListRow>
        </div>
      </section>
    </div>

    <!-- Create playlist dialog -->
    <Modal
      v-model:open="showCreatePlaylistDialog"
      title="New playlist"
      description="Group tracks from your audio library."
      :icon="ListMusic"
      size="sm"
    >
      <div class="flex flex-col gap-3">
        <Field label="Name" for="new-playlist-name" required>
          <Input
            id="new-playlist-name"
            v-model="newPlaylistName"
            type="text"
            placeholder="My playlist"
            @keyup.enter="createPlaylist"
          />
        </Field>
        <Field label="Description" for="new-playlist-description">
          <Textarea
            id="new-playlist-description"
            v-model="newPlaylistDescription"
            rows="3"
            placeholder="Optional"
            class="resize-none"
          />
        </Field>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showCreatePlaylistDialog = false">Cancel</Button>
        <Button variant="primary" :disabled="!newPlaylistName.trim()" @click="createPlaylist">Create playlist</Button>
      </template>
    </Modal>
  </div>
</template>
