<template>
  <div class="projects">
    <PageLayout
      title="Audio Library"
      description="Manage your downloaded audio and playlists"
      :show-header="true"
      :icon="Music"
    >
      <template #actions>
        <div class="projects-header-actions">
          <!-- Bulk Actions (shown when items selected) -->
          <div v-if="selectedAudioIds.size > 0" class="projects-bulk-actions">
            <span class="projects-bulk-actions__count">{{ selectedAudioIds.size }} selected</span>
            <button @click="addSelectedToPlaylist" class="projects-bulk-actions__btn">
              <ListPlus :size="16" />
              Add to Playlist
            </button>
            <button @click="deleteSelectedAudio" class="projects-bulk-actions__btn projects-bulk-actions__btn--danger">
              <Trash2 :size="16" />
              Delete
            </button>
            <button @click="clearSelection" class="projects-bulk-actions__btn">
              <X :size="16" />
              Clear
            </button>
          </div>

          <!-- Normal Actions -->
          <template v-else>
            <!-- Search -->
            <div class="projects-header__search">
              <Search class="projects-header__search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search audio..."
                class="projects-header__search-input"
              />
            </div>

            <!-- Select All Button -->
            <button 
              v-if="filteredAudio.length > 0"
              @click="selectAll" 
              class="projects-bulk-actions__btn"
            >
              <Check :size="16" />
              Select All
            </button>

            <!-- Upload Audio Button -->
            <button @click="handleUploadAudio" class="projects-create-btn">
              <Upload class="projects-create-btn__icon" />
              Upload Audio
            </button>
          </template>
        </div>
      </template>

      <div class="projects__content">
        <!-- Page Heading -->
        <div
          v-if="filteredAudio.length > 0 || playlists.length > 0 || getActiveDownloads().length > 0"
          class="projects__heading"
        >
          <h1 class="projects__title">Audio Library</h1>
          <p class="projects__subtitle">Manage your downloaded audio and playlists</p>
        </div>

        <!-- Active Downloads Section -->
        <div v-if="getActiveDownloads().length > 0" class="projects__section">
          <div class="projects__section-header-row">
            <h3 class="projects__section-header">Active Downloads</h3>
          </div>
          <div class="projects__grid projects__grid--downloads">
            <DownloadCard
              v-for="download in getActiveDownloads()"
              :key="download.id"
              :download="{
                id: download.id,
                title: download.title,
                mintId: download.id,
                progress: {
                  download_id: download.id,
                  progress: download.progress,
                  status: download.status,
                  current_time: undefined,
                  total_time: undefined
                },
                result: undefined
              }"
            />
          </div>
        </div>

        <!-- Downloaded Audio Section -->
        <div v-if="filteredAudio.length > 0" class="projects__section">
          <h3 class="projects__section-header">Downloaded Audio</h3>
          <div class="projects__grid">
            <div
              v-for="audio in filteredAudio"
              :key="audio.id"
              class="project-card project-card--audio"
              @click="playAudio(audio)"
            >
              <!-- Selection Checkbox -->
              <div
                class="project-card__checkbox"
                :class="{ 'project-card__checkbox--visible': isAudioSelected(audio.id) }"
                @click.stop="toggleAudioSelection(audio.id)"
              >
                <div
                  class="project-card__checkbox-inner"
                  :class="{ 'project-card__checkbox-inner--checked': isAudioSelected(audio.id) }"
                >
                  <Check v-if="isAudioSelected(audio.id)" class="project-card__checkbox-icon" />
                </div>
              </div>

              <!-- Thumbnail or Fallback -->
              <div
                v-if="audio.thumbnail_url"
                class="project-card__thumbnail"
                :style="{
                  backgroundImage: `url(${convertFileSrc(audio.thumbnail_url)})`,
                }"
              >
                <div class="project-card__vignette"></div>
              </div>
              <div v-else class="project-card__thumbnail project-card__thumbnail--empty">
                <div class="project-card__thumbnail-gradient"></div>
                
                <!-- Standard Empty State -->
                <div class="project-card__empty-icon">
                  <Music class="project-card__folder-icon" />
                </div>
              </div>

            <!-- Bottom Overlay with Info -->
            <div class="project-card__bottom">
              <!-- Title -->
              <h3 class="project-card__title" :title="audio.title">
                {{ audio.title }}
              </h3>

              <!-- Metadata Row -->
              <div class="project-card__meta">
                <!-- Platform Icon -->
                <div
                  v-if="audio.platform === 'YouTube'"
                  class="project-card__platform project-card__platform--youtube"
                  title="YouTube"
                >
                  <img src="/youtube.svg" class="project-card__platform-icon" />
                </div>
                <div
                  v-else-if="audio.platform === 'Twitter'"
                  class="project-card__platform project-card__platform--twitter"
                  title="Twitter"
                >
                  <img src="/x.svg" class="project-card__platform-icon" />
                </div>
                <div
                  v-else-if="audio.platform === 'Upload'"
                  class="project-card__platform project-card__platform--manual"
                  title="Uploaded"
                >
                  <Upload class="project-card__platform-svg" />
                </div>

                <span v-if="audio.platform" class="project-card__dot"></span>

                <!-- Duration -->
                <span v-if="audio.duration" class="project-card__info">
                  {{ formatDuration(audio.duration) }}
                </span>

                <span v-if="audio.duration && audio.file_size" class="project-card__dot"></span>

                <!-- File Size -->
                <span v-if="audio.file_size" class="project-card__info">
                  {{ formatFileSize(audio.file_size) }}
                </span>
              </div>
            </div>

            <!-- Hover Actions -->
            <div class="project-card__hover-actions">
              <button
                @click.stop="playAudio(audio)"
                class="project-card__hover-btn"
                title="Play"
              >
                <Play :size="16" />
              </button>
              <button
                @click.stop="openAddToPlaylistDialog(audio)"
                class="project-card__hover-btn"
                title="Add to playlist"
              >
                <ListPlus :size="16" />
              </button>
              <button
                @click.stop="deleteAudio(audio)"
                class="project-card__hover-btn project-card__hover-btn--danger"
                title="Delete"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

        <!-- Playlists Section -->
        <div v-if="playlists.length > 0" class="projects__section">
          <div class="projects__section-header-row">
            <h3 class="projects__section-header">Playlists</h3>
          </div>
          <div class="projects__grid">
            <div
              v-for="playlist in playlists"
              :key="playlist.id"
              class="project-card project-card--playlist"
              @click="viewPlaylist(playlist)"
            >
              <div class="project-card__thumbnail">
                <div class="project-card__thumbnail-placeholder">
                  <ListMusic :size="32" />
                </div>
                <div class="project-card__playlist-count">
                  {{ getPlaylistTrackCount(playlist.id) }} tracks
                </div>
              </div>
              <div class="project-card__content">
                <h3 class="project-card__title">{{ playlist.name }}</h3>
                <p v-if="playlist.description" class="project-card__description">
                  {{ playlist.description }}
                </p>
              </div>
              <div class="project-card__actions">
                <button
                  @click.stop="playPlaylist(playlist)"
                  class="project-card__action"
                  title="Play all"
                >
                  <Play :size="18" />
                </button>
                <button
                  @click.stop="editPlaylist(playlist)"
                  class="project-card__action"
                  title="Edit"
                >
                  <Edit :size="18" />
                </button>
                <button
                  @click.stop="deletePlaylist(playlist)"
                  class="project-card__action project-card__action--danger"
                  title="Delete"
                >
                  <Trash2 :size="18" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredAudio.length === 0 && playlists.length === 0 && getActiveDownloads().length === 0" class="projects-empty">
          <Music class="projects-empty__icon" />
          <h3 class="projects-empty__title">No Audio Files</h3>
          <p class="projects-empty__text">
            Download audio from YouTube or X Spaces, or upload your own audio files
          </p>
          <div class="projects-empty__actions">
            <button @click="$router.push('/download-audio')" class="projects-empty__button">
              <Download :size="18" />
              Download Audio
            </button>
            <button @click="handleUploadAudio" class="projects-empty__button projects-empty__button--secondary">
              <Upload :size="18" />
              Upload Audio
            </button>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Create Playlist Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreatePlaylistDialog" class="bug-dialog__overlay" @click.self="showCreatePlaylistDialog = false">
          <div class="bug-dialog">
            <div class="bug-dialog__accent"></div>
            <div class="bug-dialog__header">
              <button class="bug-dialog__close" @click="showCreatePlaylistDialog = false">
                <X :size="18" />
              </button>
              <div class="bug-dialog__icon">
                <ListMusic :size="24" />
              </div>
              <h2 class="bug-dialog__title">Create Playlist</h2>
            </div>
            <div class="bug-dialog__content">
              <div class="bug-dialog__field">
                <label class="bug-dialog__label">Playlist Name *</label>
                <input
                  v-model="newPlaylistName"
                  type="text"
                  placeholder="My Playlist"
                  class="bug-dialog__input"
                />
              </div>
              <div class="bug-dialog__field">
                <label class="bug-dialog__label">Description</label>
                <textarea
                  v-model="newPlaylistDescription"
                  rows="3"
                  placeholder="Optional description"
                  class="bug-dialog__input bug-dialog__textarea"
                ></textarea>
              </div>
            </div>
            <div class="bug-dialog__footer">
              <button @click="showCreatePlaylistDialog = false" class="bug-dialog__btn bug-dialog__btn--secondary">
                Cancel
              </button>
              <button
                @click="createPlaylist"
                :disabled="!newPlaylistName.trim()"
                class="bug-dialog__btn bug-dialog__btn--primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add to Playlist Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddToPlaylistDialog" class="bug-dialog__overlay" @click.self="showAddToPlaylistDialog = false">
          <div class="bug-dialog">
            <div class="bug-dialog__accent"></div>
            <div class="bug-dialog__header">
              <button class="bug-dialog__close" @click="showAddToPlaylistDialog = false">
                <X :size="18" />
              </button>
              <div class="bug-dialog__icon">
                <ListPlus :size="24" />
              </div>
              <h2 class="bug-dialog__title">Add to Playlist</h2>
            </div>
            <div class="bug-dialog__content">
              <div class="playlist-select">
                <!-- Create New Playlist Button -->
                <button
                  @click="showAddToPlaylistDialog = false; showCreatePlaylistDialog = true"
                  class="playlist-select__item playlist-select__item--create"
                >
                  <Plus :size="18" class="playlist-select__icon" />
                  <div class="playlist-select__info">
                    <div class="playlist-select__name">Create New Playlist</div>
                  </div>
                </button>

                <!-- Existing Playlists -->
                <button
                  v-for="playlist in playlists"
                  :key="playlist.id"
                  @click="addToPlaylist(playlist.id)"
                  class="playlist-select__item"
                >
                  <ListMusic :size="18" class="playlist-select__icon" />
                  <div class="playlist-select__info">
                    <div class="playlist-select__name">{{ playlist.name }}</div>
                    <div class="playlist-select__count">{{ getPlaylistTrackCount(playlist.id) }} tracks</div>
                  </div>
                </button>
              </div>
            </div>
            <div class="bug-dialog__footer">
              <button @click="showAddToPlaylistDialog = false" class="bug-dialog__btn bug-dialog__btn--secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Playlist Detail Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPlaylistDetailDialog && selectedPlaylist" class="bug-dialog__overlay" @click.self="showPlaylistDetailDialog = false">
          <div class="bug-dialog bug-dialog--large">
            <div class="bug-dialog__accent"></div>
            <div class="bug-dialog__header">
              <button class="bug-dialog__close" @click="showPlaylistDetailDialog = false">
                <X :size="18" />
              </button>
              <div class="bug-dialog__icon">
                <ListMusic :size="24" />
              </div>
              <h2 class="bug-dialog__title">{{ selectedPlaylist.name }}</h2>
              <p v-if="selectedPlaylist.description" class="bug-dialog__subtitle">
                {{ selectedPlaylist.description }}
              </p>
            </div>
            <div class="bug-dialog__content">
              <p v-if="playlistTracks.length === 0" class="bug-dialog__text">
                No tracks in this playlist yet.
              </p>
              <div v-else class="playlist-tracks">
                <div
                  v-for="(track, index) in playlistTracks"
                  :key="track.playlist_item_id"
                  class="playlist-track"
                >
                  <div class="playlist-track__number">{{ index + 1 }}</div>
                  <div class="playlist-track__info">
                    <div class="playlist-track__title">{{ track.title }}</div>
                    <div class="playlist-track__meta">
                      <span v-if="track.platform" class="playlist-track__platform">{{ track.platform }}</span>
                      <span v-if="track.platform && track.duration" class="playlist-track__dot">•</span>
                      <span v-if="track.duration">{{ formatDuration(track.duration) }}</span>
                    </div>
                  </div>
                  <div class="playlist-track__actions">
                    <button
                      @click="playAudio(track)"
                      class="playlist-track__btn"
                      title="Play"
                    >
                      <Play :size="16" />
                    </button>
                    <button
                      @click="removeTrackFromPlaylist(track.playlist_item_id)"
                      class="playlist-track__btn playlist-track__btn--danger"
                      title="Remove from playlist"
                    >
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="bug-dialog__footer">
              <button @click="showPlaylistDetailDialog = false" class="bug-dialog__btn bug-dialog__btn--secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { open } from '@tauri-apps/plugin-dialog';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import PageLayout from '@/components/PageLayout.vue';
  import DownloadCard from '@/components/DownloadCard.vue';
  import { useAudioDownloads } from '@/composables/useAudioDownloads';
  import { useAudioPlayer } from '@/composables/useAudioPlayer';
  import { useToast } from '@/composables/useToast';
  import type { AudioDownloadResult } from '@/composables/useAudioDownloads';
  import {
    getAllDownloadedAudio,
    createDownloadedAudio,
    deleteDownloadedAudio,
  } from '@/services/database/downloaded-audio';
  import {
    getAllAudioPlaylists,
    createAudioPlaylist,
    deleteAudioPlaylist,
    addAudioToPlaylist,
    getPlaylistItemsWithAudio,
    removeAudioFromPlaylist,
    getPlaylistTrackCount as getPlaylistTrackCountFromDb,
  } from '@/services/database/audio-playlists';
  import type { DownloadedAudio, AudioPlaylist } from '@/services/database/types';
  import { invoke } from '@tauri-apps/api/core';
  import {
    Music,
    Search,
    Upload,
    Download,
    Play,
    ListPlus,
    Trash2,
    ListMusic,
    Plus,
    Edit,
    X,
    Check,
  } from 'lucide-vue-next';

  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getActiveDownloads, uploadAudioFile } = useAudioDownloads();
  const { playTrack, playPlaylist: playPlaylistTracks } = useAudioPlayer();

  const audioFiles = ref<DownloadedAudio[]>([]);
  const playlists = ref<AudioPlaylist[]>([]);
  const searchQuery = ref('');
  const showCreatePlaylistDialog = ref(false);
  const showAddToPlaylistDialog = ref(false);
  const showPlaylistDetailDialog = ref(false);
  const selectedAudioForPlaylist = ref<DownloadedAudio | null>(null);
  const selectedPlaylist = ref<AudioPlaylist | null>(null);
  const playlistTracks = ref<Array<DownloadedAudio & { playlist_item_id: string }>>([]);
  const newPlaylistName = ref('');
  const newPlaylistDescription = ref('');
  const playlistTrackCounts = ref<Map<string, number>>(new Map());
  const selectedAudioIds = ref<Set<string>>(new Set());
  
  let downloadCompleteUnlisten: UnlistenFn | null = null;

  const filteredAudio = computed(() => {
    if (!searchQuery.value) return audioFiles.value;
    const query = searchQuery.value.toLowerCase();
    return audioFiles.value.filter(audio =>
      audio.title.toLowerCase().includes(query)
    );
  });

  async function loadAudioFiles() {
    try {
      audioFiles.value = await getAllDownloadedAudio();
    } catch (error) {
      console.error('Failed to load audio files:', error);
      showError('Load Failed', 'Failed to load audio files');
    }
  }

  function toggleAudioSelection(audioId: string) {
    if (selectedAudioIds.value.has(audioId)) {
      selectedAudioIds.value.delete(audioId);
    } else {
      selectedAudioIds.value.add(audioId);
    }
  }

  function isAudioSelected(audioId: string): boolean {
    return selectedAudioIds.value.has(audioId);
  }

  function clearSelection() {
    selectedAudioIds.value.clear();
  }

  function selectAll() {
    // Select all filtered audio files (not playlists)
    filteredAudio.value.forEach(audio => {
      selectedAudioIds.value.add(audio.id);
    });
  }

  async function deleteSelectedAudio() {
    if (selectedAudioIds.value.size === 0) return;

    const count = selectedAudioIds.value.size;
    const confirmed = confirm(`Delete ${count} audio file${count > 1 ? 's' : ''}?`);
    if (!confirmed) return;

    try {
      for (const audioId of selectedAudioIds.value) {
        await deleteDownloadedAudio(audioId);
      }
      success('Deleted', `Deleted ${count} audio file${count > 1 ? 's' : ''}`);
      clearSelection();
      await loadAudioFiles();
    } catch (error) {
      console.error('Failed to delete audio files:', error);
      showError('Delete Failed', 'Failed to delete selected audio files');
    }
  }

  async function addSelectedToPlaylist() {
    if (selectedAudioIds.value.size === 0) return;
    
    const selectedAudio = audioFiles.value.filter(a => selectedAudioIds.value.has(a.id));
    if (selectedAudio.length === 0) return;

    // For bulk add, we'll show the playlist dialog
    selectedAudioForPlaylist.value = selectedAudio[0]; // Use first as reference
    showAddToPlaylistDialog.value = true;
  }

  async function loadPlaylists() {
    try {
      playlists.value = await getAllAudioPlaylists();
      
      // Load track counts for each playlist
      for (const playlist of playlists.value) {
        const count = await getPlaylistTrackCountFromDb(playlist.id);
        playlistTrackCounts.value.set(playlist.id, count);
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
      showError('Load Failed', 'Failed to load playlists');
    }
  }

  async function handleUploadAudio() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Audio',
          extensions: ['mp3', 'm4a', 'wav', 'flac', 'ogg']
        }]
      });

      if (!selected) return;

      const filePath = Array.isArray(selected) ? selected[0] : selected;
      const fileName = filePath.split(/[\\/]/).pop() || 'Uploaded Audio';
      const title = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

      const result = await uploadAudioFile(filePath, title);

      if (result.success) {
        success('Upload Complete', `Uploaded: ${title}`);
        await loadAudioFiles();
      } else {
        showError('Upload Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Upload Failed', error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteAudio(audio: DownloadedAudio) {
    if (!confirm(`Delete "${audio.title}"?`)) return;

    try {
      // Delete from filesystem
      await invoke('delete_audio_file', { filePath: audio.file_path });
      
      // Delete from database
      await deleteDownloadedAudio(audio.id);
      
      success('Deleted', `Deleted: ${audio.title}`);
      await loadAudioFiles();
    } catch (error) {
      console.error('Delete error:', error);
      showError('Delete Failed', error instanceof Error ? error.message : String(error));
    }
  }

  async function createPlaylist() {
    if (!newPlaylistName.value.trim()) return;

    try {
      await createAudioPlaylist(newPlaylistName.value.trim(), newPlaylistDescription.value.trim() || undefined);
      success('Created', `Created playlist: ${newPlaylistName.value}`);
      
      newPlaylistName.value = '';
      newPlaylistDescription.value = '';
      showCreatePlaylistDialog.value = false;
      
      await loadPlaylists();
    } catch (error) {
      console.error('Create playlist error:', error);
      showError('Create Failed', error instanceof Error ? error.message : String(error));
    }
  }

  async function deletePlaylist(playlist: AudioPlaylist) {
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return;

    try {
      await deleteAudioPlaylist(playlist.id);
      success('Deleted', `Deleted playlist: ${playlist.name}`);
      await loadPlaylists();
    } catch (error) {
      console.error('Delete playlist error:', error);
      showError('Delete Failed', error instanceof Error ? error.message : String(error));
    }
  }

  function playAudio(audio: DownloadedAudio) {
    playTrack({
      id: audio.id.toString(),
      title: audio.title,
      filePath: audio.file_path,
      duration: audio.duration ?? undefined,
      platform: audio.platform ?? undefined,
    });
  }

  async function playPlaylist(playlist: AudioPlaylist) {
    try {
      const items = await getPlaylistItemsWithAudio(playlist.id);
      const tracks = items.map((item: any) => ({
        id: item.audio_id,
        title: item.audio_title,
        filePath: item.audio_file_path,
        duration: item.audio_duration,
        platform: item.audio_platform,
      }));
      
      if (tracks.length > 0) {
        await playPlaylistTracks(tracks);
        success('Playing', `Playing ${playlist.name}`);
      } else {
        showError('Empty Playlist', 'This playlist has no tracks');
      }
    } catch (error) {
      console.error('Play playlist error:', error);
      showError('Failed', 'Could not play playlist');
    }
  }

  async function viewPlaylist(playlist: AudioPlaylist) {
    selectedPlaylist.value = playlist;
    await loadPlaylistTracks(playlist.id);
    showPlaylistDetailDialog.value = true;
  }

  async function loadPlaylistTracks(playlistId: string) {
    try {
      const items = await getPlaylistItemsWithAudio(playlistId);
      playlistTracks.value = items.map((item: any) => ({
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
        playlist_item_id: item.id, // Store the playlist item ID for removal
      }));
    } catch (error) {
      console.error('Load playlist tracks error:', error);
      showError('Failed', 'Could not load playlist tracks');
    }
  }

  async function removeTrackFromPlaylist(playlistItemId: string) {
    if (!selectedPlaylist.value) return;
    
    try {
      await removeAudioFromPlaylist(playlistItemId);
      success('Removed', 'Track removed from playlist');
      await loadPlaylistTracks(selectedPlaylist.value.id);
      await loadPlaylists();
    } catch (error) {
      console.error('Remove track error:', error);
      showError('Failed', error instanceof Error ? error.message : String(error));
    }
  }

  function editPlaylist(playlist: AudioPlaylist) {
    // TODO: Show edit playlist dialog
    console.log('Edit playlist:', playlist);
  }

  function openAddToPlaylistDialog(audio: DownloadedAudio) {
    selectedAudioForPlaylist.value = audio;
    showAddToPlaylistDialog.value = true;
  }

  async function addToPlaylist(playlistId: string) {
    try {
      // Check if we're doing bulk add
      if (selectedAudioIds.value.size > 0) {
        // Bulk add selected items
        for (const audioId of selectedAudioIds.value) {
          await addAudioToPlaylist(playlistId, audioId);
        }
        success('Added', `Added ${selectedAudioIds.value.size} tracks to playlist`);
        clearSelection();
      } else if (selectedAudioForPlaylist.value) {
        // Single add
        await addAudioToPlaylist(playlistId, selectedAudioForPlaylist.value.id.toString());
        success('Added', `Added to playlist`);
        selectedAudioForPlaylist.value = null;
      }
      
      showAddToPlaylistDialog.value = false;
      await loadPlaylists();
    } catch (error) {
      console.error('Add to playlist error:', error);
      showError('Failed', error instanceof Error ? error.message : String(error));
    }
  }

  function getPlaylistTrackCount(playlistId: string): number {
    return playlistTrackCounts.value.get(playlistId) || 0;
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

  onMounted(async () => {
    await Promise.all([
      loadAudioFiles(),
      loadPlaylists(),
    ]);

    // Listen for download complete events to refresh the library
    downloadCompleteUnlisten = await listen<AudioDownloadResult>('download-complete', async (event) => {
      if (event.payload.success) {
        console.log('[AudioLibrary] Download completed, reloading audio files');
        await loadAudioFiles();
      }
    });
  });

  onUnmounted(() => {
    if (downloadCompleteUnlisten) {
      downloadCompleteUnlisten();
    }
  });
</script>

<style scoped>
  /* ===== Main Container ===== */
  .projects {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  /* ===== Header Actions ===== */
  .projects-header-actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .projects-header__search {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    max-width: 320px;
  }

  .projects-header__search-icon {
    position: absolute;
    left: 0.75rem;
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .projects-header__search-input {
    width: 100%;
    height: 32px;
    padding: 0 0.75rem 0 2.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .projects-header__search-input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .projects-header__search-input:focus {
    border-color: var(--sidebar-accent);
    outline: none;
  }

  .projects-create-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects-create-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .projects-create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .projects-create-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Sections ===== */
  .projects__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .projects__section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .projects__section-header {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    padding-bottom: 0.1rem;
  }

  /* ===== Content Container ===== */
  .projects__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
  }

  /* ===== Page Heading ===== */
  .projects__heading {
    margin-bottom: 0.5rem;
  }

  .projects__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .projects__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Projects Grid ===== */
  .projects__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
  }

  @media (min-width: 1024px) {
    .projects__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .projects__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .projects__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Project Card ===== */
  .project-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .project-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  /* Thumbnail */
  .project-card__thumbnail {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .project-card__thumbnail--empty {
    background-color: var(--sidebar-hover);
  }

  .project-card__thumbnail-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.5) 100%);
  }

  /* Empty State Icons */
  .project-card__empty-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.2;
  }

  .project-card__folder-icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text);
  }

  /* Bottom Info */
  .project-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 1rem;
    padding-top: 7rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .project-card__title {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    line-height: 1.3;
    transition: color 150ms ease;
  }

  .project-card:hover .project-card__title {
    color: rgba(255, 255, 255, 0.9);
  }

  .project-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    flex-wrap: wrap;
  }

  .project-card__info {
    color: rgba(255, 255, 255, 0.7);
  }

  .project-card__dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  /* Platform Icons */
  .project-card__platform {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .project-card__platform--youtube {
    background-color: #dc2626;
  }

  .project-card__platform--twitter {
    background-color: #000000;
  }

  .project-card__platform--manual {
    background-color: #475569;
    color: white;
  }

  .project-card__platform-icon {
    width: 10px;
    height: 10px;
    filter: invert(1) brightness(2);
  }

  .project-card__platform-svg {
    width: 10px;
    height: 10px;
  }

  /* Hover Actions */
  .project-card__hover-actions {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .project-card:hover .project-card__hover-actions {
    opacity: 1;
  }

  .project-card__hover-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 9999px;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .project-card__hover-btn:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .project-card__hover-btn--danger:hover {
    background-color: #ef4444;
    color: white;
  }

  /* Playlist Card Styles */
  .project-card__thumbnail-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .project-card__playlist-count {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(0, 0, 0, 0.75);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    z-index: 10;
  }

  .project-card__content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 70%, transparent 100%);
    z-index: 5;
  }

  .project-card__description {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-card__actions {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 200ms ease;
    z-index: 20;
  }

  .project-card:hover .project-card__actions {
    opacity: 1;
  }

  .project-card__action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
    backdrop-filter: blur(8px);
  }

  .project-card__action:hover {
    background-color: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }

  .project-card__action--danger:hover {
    background-color: rgba(239, 68, 68, 0.9);
    border-color: #ef4444;
  }

  /* ===== Empty State ===== */
  .projects-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .projects-empty__icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text-muted);
    margin-bottom: 1.5rem;
    opacity: 0.5;
  }

  .projects-empty__title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.75rem;
  }

  .projects-empty__text {
    font-size: 0.9375rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 2rem;
    max-width: 400px;
  }

  .projects-empty__actions {
    display: flex;
    gap: 0.75rem;
  }

  .projects-empty__button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects-empty__button:hover {
    opacity: 0.9;
  }

  .projects-empty__button--secondary {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .projects-empty__button--secondary:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* ===== Playlist Selection ===== */
  .playlist-select {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .playlist-select__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .playlist-select__item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--sidebar-accent);
  }

  .playlist-select__icon {
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .playlist-select__info {
    flex: 1;
    min-width: 0;
  }

  .playlist-select__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-select__count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .playlist-select__item--create {
    background: rgba(6, 182, 212, 0.1);
    border-color: var(--sidebar-accent);
  }

  .playlist-select__item--create:hover {
    background: rgba(6, 182, 212, 0.15);
  }

  .playlist-select__item--create .playlist-select__icon {
    color: var(--sidebar-accent);
  }

  .playlist-select__item--create .playlist-select__name {
    color: var(--sidebar-accent);
    font-weight: 600;
  }

  /* ===== Playlist Tracks ===== */
  .playlist-tracks {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .playlist-track {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    transition: all 150ms ease;
  }

  .playlist-track:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .playlist-track__number {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    min-width: 24px;
    text-align: center;
  }

  .playlist-track__info {
    flex: 1;
    min-width: 0;
  }

  .playlist-track__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.25rem;
  }

  .playlist-track__meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .playlist-track__platform {
    text-transform: capitalize;
  }

  .playlist-track__dot {
    opacity: 0.5;
  }

  .playlist-track__actions {
    display: flex;
    gap: 0.5rem;
  }

  .playlist-track__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .playlist-track__btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .playlist-track__btn--danger:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  /* ===== Dialog Styling (matches ClipDetectionConfirmDialog) ===== */
  .bug-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .bug-dialog {
    position: relative;
    width: 90%;
    max-width: 500px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .bug-dialog--large {
    max-width: 700px;
  }

  .bug-dialog__accent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent) 0%, rgba(6, 182, 212, 0.5) 100%);
  }

  .bug-dialog__header {
    position: relative;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .bug-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .bug-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .bug-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    background-color: rgba(6, 182, 212, 0.1);
    border-radius: 12px;
    color: var(--sidebar-accent);
  }

  .bug-dialog__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .bug-dialog__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0.5rem 0 0;
  }

  .bug-dialog__content {
    padding: 0 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .bug-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bug-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* Audio card specific styles - half height, same width */
  .project-card--audio {
    aspect-ratio: auto;
    height: 160px;
  }

  .project-card--audio .project-card__thumbnail {
    height: 100px;
  }

  .project-card--audio .project-card__thumbnail--empty {
    height: 100px;
  }

  .project-card--audio .project-card__bottom {
    padding: 0.75rem;
  }

  .project-card--audio .project-card__title {
    font-size: 0.875rem;
    line-height: 1.3;
    -webkit-line-clamp: 2;
  }

  .project-card--audio .project-card__meta {
    margin-top: 0.25rem;
  }

  /* Checkbox styles */
  .project-card__checkbox {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 100;
    opacity: 0;
    transition: opacity 150ms ease;
    pointer-events: auto;
  }

  .project-card:hover .project-card__checkbox,
  .project-card__checkbox--visible {
    opacity: 1;
  }

  .project-card__checkbox-inner {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.6);
    border: 2px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .project-card__checkbox-inner:hover {
    background-color: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .project-card__checkbox-inner--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .project-card__checkbox-inner--checked:hover {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .project-card__checkbox-icon {
    width: 16px;
    height: 16px;
  }

  /* Bulk Actions */
  .projects-bulk-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .projects-bulk-actions__count {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    padding: 0.5rem 0.75rem;
    background: rgba(6, 182, 212, 0.1);
    border-radius: 6px;
  }

  .projects-bulk-actions__btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects-bulk-actions__btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .projects-bulk-actions__btn--danger {
    color: #ef4444;
  }

  .projects-bulk-actions__btn--danger:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .bug-dialog__input {
    width: 100%;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .bug-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .bug-dialog__input:focus {
    border-color: var(--sidebar-accent);
    outline: none;
  }

  .bug-dialog__textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  .bug-dialog__footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .bug-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .bug-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .bug-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .bug-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .bug-dialog__btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .bug-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* Modal transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
</style>
