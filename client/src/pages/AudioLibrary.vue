<template>
  <div class="audio-library h-full">
    <PageLayout
      title="Audio library"
      description="Manage your downloaded audio and playlists"
      :show-header="true"
      :icon="Music"
    >
      <template #actions>
        <Button v-if="activeTab === 'audio'" variant="primary" @click="handleUploadAudio"><Upload /> Upload audio</Button>
      </template>

      <template v-if="canUseTokend || audioFiles.length > 0 || selectedAudioIds.size > 0" #toolbar>
        <SelectionBar
          v-if="activeTab === 'audio' && selectedAudioIds.size > 0"
          :count="selectedAudioIds.size"
          :total="filteredAudio.length"
          @clear="clearSelection"
          @select-all="selectAll"
        >
          <Button variant="secondary" size="sm" @click="addSelectedToPlaylist"><ListPlus /> Add to playlist</Button>
          <Button variant="destructive-soft" size="sm" @click="deleteSelectedAudio"><Trash2 /> Delete</Button>
        </SelectionBar>
        <template v-else>
          <SegmentedControl v-if="canUseTokend" v-model="activeTab" :options="tabOptions" />
          <SearchField
            v-if="activeTab === 'audio'"
            v-model="searchQuery"
            placeholder="Search audio…"
            class="min-w-[120px] max-w-64 flex-1"
          />
        </template>
      </template>

      <div :key="activeTab" class="flex min-h-full animate-enter flex-col px-5 py-4">
        <CirclesLibraryView v-if="activeTab === 'circles' && canUseTokend" />

        <!-- First load: skeleton rows (delayed, so fast loads go straight to content) -->
        <div v-else-if="activeTab === 'audio' && !loaded" class="flex flex-col gap-3" aria-busy="true">
          <div class="skeleton h-4 w-36" />
          <div v-for="i in 6" :key="`skeleton-${i}`" class="flex h-12 items-center gap-3 px-3">
            <div class="skeleton size-8 shrink-0" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-1/3" />
              <div class="skeleton h-3 w-1/5" />
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'audio'" class="flex flex-1 animate-fade-in flex-col gap-6">
          <!-- Active downloads -->
          <section v-if="getActiveDownloads().length > 0">
            <SectionHeader title="Active downloads" :count="getActiveDownloads().length" class="mb-3" />
            <div class="card-grid">
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
                    total_time: undefined,
                  },
                  result: undefined,
                }"
              />
            </div>
          </section>

          <!-- Playlists -->
          <section v-if="playlists.length > 0">
            <SectionHeader title="Playlists" :count="playlists.length" class="mb-3" />
            <div class="card-grid">
              <div
                v-for="playlist in playlists"
                :key="playlist.id"
                class="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-line-subtle bg-surface p-3 outline-none transition-colors hover:border-line-strong focus-visible:shadow-[var(--focus-ring)]"
                role="button"
                tabindex="0"
                @click="viewPlaylist(playlist)"
                @keydown.enter.self="viewPlaylist(playlist)"
              >
                <IconTile :icon="ListMusic" size="md" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-fg" :title="playlist.name">{{ playlist.name }}</p>
                  <p class="truncate text-xs text-fg-subtle" :title="playlist.description || undefined">
                    {{ getPlaylistTrackCount(playlist.id) }} {{ getPlaylistTrackCount(playlist.id) === 1 ? 'track' : 'tracks'
                    }}<template v-if="playlist.description"> · {{ playlist.description }}</template>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hidden group-focus-within:inline-flex group-hover:inline-flex"
                    title="Edit"
                    aria-label="Edit playlist"
                    @click.stop="editPlaylist(playlist)"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hidden hover:text-danger group-focus-within:inline-flex group-hover:inline-flex"
                    title="Delete"
                    aria-label="Delete playlist"
                    @click.stop="deletePlaylist(playlist)"
                  >
                    <Trash2 />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    class="rounded-full"
                    title="Play all"
                    aria-label="Play playlist"
                    @click.stop="playPlaylist(playlist)"
                  >
                    <Play class="ml-px" fill="currentColor" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <!-- Downloaded audio -->
          <section v-if="filteredAudio.length > 0">
            <SectionHeader title="Downloaded audio" :count="filteredAudio.length" class="mb-3">
              <Button variant="ghost" size="sm" title="Play all" @click="playAllAudio"><Play /> Play all</Button>
              <Button variant="ghost" size="sm" title="Shuffle all" @click="shuffleAllAudio"><Shuffle /> Shuffle</Button>
            </SectionHeader>
            <div class="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-surface">
              <div
                v-for="audio in filteredAudio"
                :key="audio.id"
                class="group flex min-w-0 cursor-pointer items-center gap-3 px-3 py-1.5 transition-colors"
                :class="isAudioSelected(audio.id) ? 'bg-brand-soft' : 'hover:bg-surface-hover'"
                @click="handleAudioCardClick(audio)"
              >
                <Checkbox
                  :model-value="isAudioSelected(audio.id)"
                  :aria-label="`Select ${audio.title}`"
                  @click.stop
                  @update:model-value="toggleAudioSelection(audio.id)"
                />

                <!-- Artwork with play state -->
                <div class="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken">
                  <img
                    v-if="audio.thumbnail_url"
                    :src="convertFileSrc(audio.thumbnail_url)"
                    alt=""
                    class="size-full object-cover"
                  />
                  <Music v-else class="size-4 text-fg-subtle" />
                  <div
                    class="absolute inset-0 grid place-items-center bg-black/55 text-white transition-opacity"
                    :class="isCurrentTrack(audio) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                  >
                    <Pause v-if="isCurrentTrack(audio) && isPlaying" class="size-3.5" fill="currentColor" />
                    <Play v-else class="ml-px size-3.5" fill="currentColor" />
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium"
                    :class="isCurrentTrack(audio) ? 'text-brand' : 'text-fg'"
                    :title="audio.title"
                  >
                    {{ audio.title }}
                  </p>
                  <div class="flex min-w-0 items-center gap-1.5 text-xs text-fg-subtle">
                    <template v-if="platformLabel(audio.platform)">
                      <img
                        v-if="platformLabel(audio.platform) === 'YouTube'"
                        src="/youtube.svg"
                        alt=""
                        class="size-3.5 shrink-0"
                      />
                      <Upload v-else-if="audio.platform === 'Upload'" class="size-3 shrink-0" />
                      <span class="truncate">{{ platformLabel(audio.platform) }}</span>
                    </template>
                    <template v-if="audio.file_size">
                      <span v-if="platformLabel(audio.platform)" aria-hidden="true" class="text-fg-disabled">·</span>
                      <span class="tabular shrink-0">{{ formatFileSize(audio.file_size) }}</span>
                    </template>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Add to playlist"
                    aria-label="Add to playlist"
                    @click.stop="openAddToPlaylistDialog(audio)"
                  >
                    <ListPlus />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hover:text-danger"
                    title="Delete"
                    aria-label="Delete"
                    @click.stop="deleteAudio(audio)"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <span v-if="audio.duration" class="tabular w-12 shrink-0 text-right text-xs text-fg-subtle">
                  {{ formatDuration(audio.duration) }}
                </span>
              </div>
            </div>
          </section>

          <!-- Search found nothing while other sections are visible -->
          <EmptyState
            v-else-if="searchQuery && (playlists.length > 0 || getActiveDownloads().length > 0)"
            size="sm"
            :icon="SearchX"
            title="No matching audio"
            :description="`Nothing in your library matches “${searchQuery}”.`"
          />

          <!-- Empty -->
          <template v-if="filteredAudio.length === 0 && playlists.length === 0 && getActiveDownloads().length === 0">
            <EmptyState
              v-if="searchQuery"
              :icon="SearchX"
              title="No matching audio"
              :description="`Nothing in your library matches “${searchQuery}”.`"
            >
              <Button variant="secondary" @click="searchQuery = ''">Clear search</Button>
            </EmptyState>
            <EmptyState
              v-else
              :icon="Music"
              title="No audio yet"
              description="Download audio from YouTube, or upload your own audio files"
            >
              <Button variant="secondary" @click="$router.push('/download-audio')"><Download /> Download audio</Button>
            </EmptyState>
          </template>
        </div>
      </div>
    </PageLayout>

    <!-- Create playlist -->
    <Modal v-model:open="showCreatePlaylistDialog" title="New playlist" :icon="ListMusic" size="sm">
      <div class="flex flex-col gap-4">
        <Field label="Name" for="new-playlist-name" required>
          <Input id="new-playlist-name" v-model="newPlaylistName" type="text" placeholder="My playlist" />
        </Field>
        <Field label="Description" for="new-playlist-description">
          <Textarea
            id="new-playlist-description"
            v-model="newPlaylistDescription"
            rows="3"
            placeholder="Optional description"
          />
        </Field>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showCreatePlaylistDialog = false">Cancel</Button>
        <Button variant="primary" :disabled="!newPlaylistName.trim()" @click="createPlaylist">Create</Button>
      </template>
    </Modal>

    <!-- Edit playlist -->
    <Modal v-model:open="showEditPlaylistDialog" title="Edit playlist" :icon="Pencil" size="sm">
      <div class="flex flex-col gap-4">
        <Field label="Name" for="edit-playlist-name" required>
          <Input id="edit-playlist-name" v-model="editPlaylistName" type="text" placeholder="My playlist" />
        </Field>
        <Field label="Description" for="edit-playlist-description">
          <Textarea
            id="edit-playlist-description"
            v-model="editPlaylistDescription"
            rows="3"
            placeholder="Optional description"
          />
        </Field>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showEditPlaylistDialog = false">Cancel</Button>
        <Button variant="primary" :disabled="!editPlaylistName.trim()" @click="savePlaylistEdit">Save</Button>
      </template>
    </Modal>

    <!-- Add to playlist -->
    <Modal
      v-model:open="showAddToPlaylistDialog"
      title="Add to playlist"
      :description="
        selectedAudioIds.size > 0
          ? `${selectedAudioIds.size} selected ${selectedAudioIds.size === 1 ? 'track' : 'tracks'}`
          : selectedAudioForPlaylist?.title
      "
      :icon="ListPlus"
      size="sm"
    >
      <div class="-mx-2 flex flex-col gap-0.5">
        <button
          type="button"
          class="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          @click="
            showAddToPlaylistDialog = false;
            showCreatePlaylistDialog = true;
          "
        >
          <IconTile :icon="Plus" tone="brand" size="md" />
          <span class="text-sm font-medium text-fg">New playlist</span>
        </button>
        <button
          v-for="playlist in playlists"
          :key="playlist.id"
          type="button"
          class="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          @click="addToPlaylist(playlist.id)"
        >
          <IconTile :icon="ListMusic" size="md" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-fg">{{ playlist.name }}</span>
            <span class="block text-xs text-fg-subtle">{{ getPlaylistTrackCount(playlist.id) }} tracks</span>
          </span>
        </button>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showAddToPlaylistDialog = false">Cancel</Button>
      </template>
    </Modal>

    <!-- Playlist detail -->
    <Modal
      :open="showPlaylistDetailDialog && !!selectedPlaylist"
      :title="selectedPlaylist?.name"
      :description="selectedPlaylist?.description || undefined"
      :icon="ListMusic"
      size="lg"
      @close="showPlaylistDetailDialog = false"
    >
      <EmptyState
        v-if="playlistTracks.length === 0"
        size="sm"
        :icon="ListMusic"
        title="No tracks yet"
        description="Add tracks from your library with the “Add to playlist” action."
      />
      <div v-else class="-mx-2 flex select-none flex-col gap-0.5">
        <div
          v-for="(track, index) in playlistTracks"
          :key="track.playlist_item_id"
          class="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
          :class="[
            draggedTrackIndex === index ? 'bg-surface-active' : 'hover:bg-surface-hover',
            dragOverTrackIndex === index && 'bg-brand-soft',
          ]"
          @mouseenter="handleMouseEnter(index)"
          @mouseleave="handleMouseLeave"
          @mouseup="handleMouseUp(index)"
        >
          <span
            class="grid size-6 shrink-0 cursor-grab place-items-center rounded text-fg-subtle hover:text-fg active:cursor-grabbing"
            title="Drag to reorder"
            @mousedown.prevent="handleMouseDown(index)"
          >
            <GripVertical class="size-3.5" />
          </span>
          <span class="tabular w-5 shrink-0 text-right text-xs text-fg-subtle">{{ index + 1 }}</span>
          <div class="min-w-0 flex-1 px-1">
            <p class="truncate text-sm text-fg" :title="track.title">{{ track.title }}</p>
            <p class="flex items-center gap-1.5 text-xs text-fg-subtle">
              <span v-if="track.platform">{{ platformLabel(track.platform) }}</span>
              <span v-if="track.platform && track.duration" aria-hidden="true" class="text-fg-disabled">·</span>
              <span v-if="track.duration" class="tabular">{{ formatDuration(track.duration) }}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" title="Play" aria-label="Play" @click="playAudio(track)">
            <Play />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="hover:text-danger"
            title="Remove from playlist"
            aria-label="Remove from playlist"
            @click="removeTrackFromPlaylist(track.playlist_item_id)"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <template #footer>
        <Button variant="secondary" @click="showPlaylistDetailDialog = false">Close</Button>
      </template>
    </Modal>

    <ConfirmationModal
      :show="showDeleteAudioDialog"
      :title="deleteAudioTitle"
      :message="deleteAudioMessage"
      :item-name="deleteAudioItemName"
      :suffix="deleteAudioSuffix"
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteAudioDialogClose"
      @confirm="deleteAudioConfirmed"
    />

    <ConfirmationModal
      :show="showDeletePlaylistDialog"
      title="Delete playlist"
      message="Are you sure you want to delete"
      :item-name="playlistToDelete?.name"
      suffix="?"
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeletePlaylistDialogClose"
      @confirm="deletePlaylistConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { open } from '@tauri-apps/plugin-dialog';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import PageLayout from '@/components/PageLayout.vue';
  import DownloadCard from '@/components/DownloadCard.vue';
  import CirclesLibraryView from '@/components/circles/CirclesLibraryView.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { useAudioDownloads } from '@/composables/useAudioDownloads';
  import { useAudioPlayer } from '@/composables/useAudioPlayer';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';
  import { canAccessTokend } from '@/utils/tokendAccess';
  import type { AudioDownloadResult } from '@/composables/useAudioDownloads';
  import {
    getAllDownloadedAudio,
    createDownloadedAudio,
    deleteDownloadedAudio,
    updateDownloadedAudio,
  } from '@/services/database/downloaded-audio';
  import {
    getAllAudioPlaylists,
    createAudioPlaylist,
    deleteAudioPlaylist,
    addAudioToPlaylist,
    getPlaylistItemsWithAudio,
    removeAudioFromPlaylist,
    getPlaylistTrackCount as getPlaylistTrackCountFromDb,
    reorderPlaylistItem,
    updateAudioPlaylist,
  } from '@/services/database/audio-playlists';
  import type { DownloadedAudio, AudioPlaylist } from '@/services/database/types';
  import { invoke } from '@tauri-apps/api/core';
  import {
    Music,
    Upload,
    Download,
    Play,
    Pause,
    ListPlus,
    Trash2,
    ListMusic,
    Plus,
    Pencil,
    GripVertical,
    Shuffle,
    SearchX,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Textarea } from '@/components/ui/textarea';
  import { SelectionBar } from '@/components/ui/selection-bar';

  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getActiveDownloads, uploadAudioFile } = useAudioDownloads();
  const { playPlaylist: playPlaylistTracks, currentTrack, isPlaying } = useAudioPlayer();

  const audioFiles = ref<DownloadedAudio[]>([]);
  // True once the first library load finished — gates the empty state so it never flashes in.
  const loaded = ref(false);
  const playlists = ref<AudioPlaylist[]>([]);
  const searchQuery = ref('');
  const activeTab = ref<'audio' | 'circles'>('audio');
  const authStore = useAuthStore();
  const canUseTokend = computed(() => canAccessTokend(authStore.user));
  const showCreatePlaylistDialog = ref(false);
  const showAddToPlaylistDialog = ref(false);
  const showPlaylistDetailDialog = ref(false);
  const showEditPlaylistDialog = ref(false);
  const showDeleteAudioDialog = ref(false);
  const showDeletePlaylistDialog = ref(false);
  const bulkDeleteAudioMode = ref(false);
  const audioToDelete = ref<DownloadedAudio | null>(null);
  const playlistToDelete = ref<AudioPlaylist | null>(null);
  const selectedAudioForPlaylist = ref<DownloadedAudio | null>(null);
  const selectedPlaylist = ref<AudioPlaylist | null>(null);
  const playlistTracks = ref<Array<DownloadedAudio & { playlist_item_id: string }>>([]);
  const newPlaylistName = ref('');
  const newPlaylistDescription = ref('');
  const editPlaylistName = ref('');
  const editPlaylistDescription = ref('');
  const playlistTrackCounts = ref<Map<string, number>>(new Map());
  const selectedAudioIds = ref<Set<string>>(new Set());
  const draggedTrackIndex = ref<number | null>(null);
  const dragOverTrackIndex = ref<number | null>(null);
  const isDragging = ref(false);

  const tabOptions: SegmentedOption<'audio' | 'circles'>[] = [
    { value: 'audio', label: 'Audio' },
    { value: 'circles', label: 'Circles' },
  ];

  /** Track that is loaded in the global player (drives the row highlight). */
  function isCurrentTrack(audio: DownloadedAudio): boolean {
    return currentTrack.value?.id === audio.id.toString();
  }

  function platformLabel(platform: string | null | undefined): string | null {
    if (!platform) return null;
    if (platform.toLowerCase() === 'youtube') return 'YouTube';
    if (platform === 'Upload') return 'Uploaded';
    return platform;
  }

  const filteredAudio = computed(() => {
    // Circles are separate; exclude any legacy Twitter/X Spaces audio rows
    let filtered = audioFiles.value.filter((audio) => audio.platform !== 'Twitter');

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((audio) => audio.title.toLowerCase().includes(query));
    }

    return filtered;
  });

  async function loadAudioFiles() {
    try {
      audioFiles.value = await getAllDownloadedAudio();
      void repairMissingThumbnails();
    } catch (error) {
      console.error('Failed to load audio files:', error);
      showError('Load Failed', 'Failed to load audio files');
    }
  }

  async function repairMissingThumbnails() {
    const missing = audioFiles.value.filter((audio) => !audio.thumbnail_url && audio.source_url);
    if (missing.length === 0) return;

    for (const audio of missing) {
      const thumbPath = audio.file_path.replace(/\.[^.]+$/, '.jpg');
      try {
        await invoke('generate_audio_thumbnail', {
          sourceUrl: audio.source_url,
          outputPath: thumbPath,
        });
        await updateDownloadedAudio(audio.id, { thumbnail_url: thumbPath });
        const index = audioFiles.value.findIndex((item) => item.id === audio.id);
        if (index >= 0) {
          audioFiles.value[index] = { ...audioFiles.value[index], thumbnail_url: thumbPath };
        }
      } catch (error) {
        console.warn('[AudioLibrary] Failed to generate thumbnail for', audio.title, error);
      }
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
    filteredAudio.value.forEach((audio) => {
      selectedAudioIds.value.add(audio.id);
    });
  }

  const deleteAudioTitle = computed(() => {
    if (bulkDeleteAudioMode.value && selectedAudioIds.value.size > 0) {
      const count = selectedAudioIds.value.size;
      return `Delete ${count} audio file${count > 1 ? 's' : ''}`;
    }
    return 'Delete audio';
  });

  const deleteAudioMessage = computed(() => {
    if (bulkDeleteAudioMode.value && selectedAudioIds.value.size > 0) {
      const count = selectedAudioIds.value.size;
      return `Are you sure you want to delete ${count} audio file${count > 1 ? 's' : ''}?`;
    }
    return 'Are you sure you want to delete';
  });

  const deleteAudioItemName = computed(() => {
    if (bulkDeleteAudioMode.value) return undefined;
    return audioToDelete.value?.title;
  });

  const deleteAudioSuffix = computed(() => {
    if (bulkDeleteAudioMode.value) return '';
    return '?';
  });

  function deleteSelectedAudio() {
    if (selectedAudioIds.value.size === 0) return;

    bulkDeleteAudioMode.value = true;
    audioToDelete.value = null;
    showDeleteAudioDialog.value = true;
  }

  function deleteAudio(audio: DownloadedAudio) {
    bulkDeleteAudioMode.value = false;
    audioToDelete.value = audio;
    showDeleteAudioDialog.value = true;
  }

  function handleDeleteAudioDialogClose() {
    showDeleteAudioDialog.value = false;
    audioToDelete.value = null;
    bulkDeleteAudioMode.value = false;
  }

  async function deleteAudioEntry(audio: DownloadedAudio) {
    await invoke('delete_audio_file', { filePath: audio.file_path });
    await deleteDownloadedAudio(audio.id);
  }

  async function deleteAudioConfirmed() {
    try {
      if (bulkDeleteAudioMode.value && selectedAudioIds.value.size > 0) {
        const count = selectedAudioIds.value.size;
        const toDelete = audioFiles.value.filter((a) => selectedAudioIds.value.has(a.id));

        for (const audio of toDelete) {
          await deleteAudioEntry(audio);
        }

        success('Deleted', `Deleted ${count} audio file${count > 1 ? 's' : ''}`);
        clearSelection();
        await loadAudioFiles();
      } else if (audioToDelete.value) {
        const audio = audioToDelete.value;

        await deleteAudioEntry(audio);

        success('Deleted', `Deleted: ${audio.title}`);
        await loadAudioFiles();
      }
    } catch (error) {
      console.error('Delete error:', error);
      showError('Delete Failed', error instanceof Error ? error.message : 'Failed to delete audio');
    } finally {
      handleDeleteAudioDialogClose();
    }
  }

  async function addSelectedToPlaylist() {
    if (selectedAudioIds.value.size === 0) return;

    const selectedAudio = audioFiles.value.filter((a) => selectedAudioIds.value.has(a.id));
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
        multiple: true,
        filters: [
          {
            name: 'Audio',
            extensions: ['mp3', 'm4a', 'wav', 'flac', 'ogg'],
          },
        ],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length === 0) return;

      let ok = 0;
      const failures: string[] = [];
      let singleSuccessTitle: string | null = null;

      for (const filePath of paths) {
        const fileName = filePath.split(/[\\/]/).pop() || 'Uploaded Audio';
        const title = fileName.replace(/\.[^/.]+$/, '');

        try {
          const result = await uploadAudioFile(filePath, title);
          if (result.success) {
            ok += 1;
            if (paths.length === 1) singleSuccessTitle = title;
          } else {
            failures.push(`${title}: ${result.error || 'Unknown error'}`);
          }
        } catch (err) {
          failures.push(`${title}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await loadAudioFiles();

      if (ok > 0 && failures.length === 0) {
        success(
          'Upload Complete',
          ok === 1 && singleSuccessTitle
            ? `Uploaded: ${singleSuccessTitle}`
            : `Uploaded ${ok} file${ok === 1 ? '' : 's'}`
        );
      } else if (ok > 0 && failures.length > 0) {
        showError(
          'Some uploads failed',
          `${ok} succeeded, ${failures.length} failed.\n${failures.slice(0, 5).join('\n')}${failures.length > 5 ? `\n… and ${failures.length - 5} more` : ''}`
        );
      } else {
        showError('Upload Failed', failures.slice(0, 5).join('\n') || 'All uploads failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Upload Failed', error instanceof Error ? error.message : String(error));
    }
  }

  async function createPlaylist() {
    if (!newPlaylistName.value.trim()) return;

    try {
      const newPlaylistId = await createAudioPlaylist(
        newPlaylistName.value.trim(),
        newPlaylistDescription.value.trim() || undefined
      );
      const playlistName = newPlaylistName.value;

      newPlaylistName.value = '';
      newPlaylistDescription.value = '';
      showCreatePlaylistDialog.value = false;

      await loadPlaylists();

      // If there's a pending audio selection or bulk selection, automatically add to the new playlist
      if (selectedAudioForPlaylist.value || selectedAudioIds.value.size > 0) {
        try {
          await addToPlaylist(newPlaylistId, true); // skipDialog = true to avoid duplicate success message

          // Show combined success message
          if (selectedAudioIds.value.size > 0) {
            success('Created & Added', `Created "${playlistName}" and added ${selectedAudioIds.value.size} tracks`);
          } else {
            success('Created & Added', `Created "${playlistName}" and added track`);
          }
        } catch (error) {
          console.error('Failed to add audio to new playlist:', error);
          success('Created', `Created playlist: ${playlistName}`);
          showError('Add Failed', 'Playlist created but failed to add track(s)');
        }
      } else {
        // No pending selection, just show create success
        success('Created', `Created playlist: ${playlistName}`);
      }
    } catch (error) {
      console.error('Create playlist error:', error);
      showError('Create Failed', error instanceof Error ? error.message : String(error));
    }
  }

  function deletePlaylist(playlist: AudioPlaylist) {
    playlistToDelete.value = playlist;
    showDeletePlaylistDialog.value = true;
  }

  function handleDeletePlaylistDialogClose() {
    showDeletePlaylistDialog.value = false;
    playlistToDelete.value = null;
  }

  async function deletePlaylistConfirmed() {
    if (!playlistToDelete.value) return;

    const playlist = playlistToDelete.value;

    try {
      await deleteAudioPlaylist(playlist.id);
      success('Deleted', `Deleted playlist: ${playlist.name}`);
      await loadPlaylists();
    } catch (error) {
      console.error('Delete playlist error:', error);
      showError('Delete Failed', error instanceof Error ? error.message : String(error));
    } finally {
      handleDeletePlaylistDialogClose();
    }
  }

  function toAudioTrack(audio: DownloadedAudio) {
    return {
      id: audio.id.toString(),
      title: audio.title,
      filePath: audio.file_path,
      duration: audio.duration ?? undefined,
      platform: audio.platform ?? undefined,
    };
  }

  function playAudio(audio: DownloadedAudio) {
    if (showPlaylistDetailDialog.value && playlistTracks.value.length > 0) {
      const tracks = playlistTracks.value.map(toAudioTrack);
      const startIndex = tracks.findIndex((t) => t.id === audio.id.toString());
      playPlaylistTracks(tracks, startIndex >= 0 ? startIndex : 0);
      return;
    }

    const tracks = filteredAudio.value.map(toAudioTrack);
    const startIndex = tracks.findIndex((t) => t.id === audio.id.toString());
    playPlaylistTracks(tracks, startIndex >= 0 ? startIndex : 0);
  }

  async function playAllAudio() {
    const tracks = filteredAudio.value.map(toAudioTrack);
    if (tracks.length === 0) return;
    await playPlaylistTracks(tracks, 0);
  }

  async function shuffleAllAudio() {
    const tracks = filteredAudio.value.map(toAudioTrack);
    if (tracks.length === 0) return;
    await playPlaylistTracks(tracks, 0, { shuffle: true });
  }

  function handleAudioCardClick(audio: DownloadedAudio) {
    playAudio(audio);
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
    selectedPlaylist.value = playlist;
    editPlaylistName.value = playlist.name;
    editPlaylistDescription.value = playlist.description || '';
    showEditPlaylistDialog.value = true;
  }

  async function savePlaylistEdit() {
    if (!selectedPlaylist.value || !editPlaylistName.value.trim()) return;

    try {
      // Update playlist in database
      await updateAudioPlaylist(selectedPlaylist.value.id, {
        name: editPlaylistName.value.trim(),
        description: editPlaylistDescription.value.trim() || undefined,
      });

      success('Updated', `Updated playlist: ${editPlaylistName.value}`);

      editPlaylistName.value = '';
      editPlaylistDescription.value = '';
      showEditPlaylistDialog.value = false;

      await loadPlaylists();
    } catch (error) {
      console.error('Update playlist error:', error);
      showError('Update Failed', error instanceof Error ? error.message : String(error));
    }
  }

  function openAddToPlaylistDialog(audio: DownloadedAudio) {
    selectedAudioForPlaylist.value = audio;
    showAddToPlaylistDialog.value = true;
  }

  async function addToPlaylist(playlistId: string, skipDialog = false) {
    try {
      // Check if we're doing bulk add
      if (selectedAudioIds.value.size > 0) {
        // Bulk add selected items
        for (const audioId of selectedAudioIds.value) {
          await addAudioToPlaylist(playlistId, audioId);
        }
        if (!skipDialog) {
          success('Added', `Added ${selectedAudioIds.value.size} tracks to playlist`);
        }
        clearSelection();
      } else if (selectedAudioForPlaylist.value) {
        // Single add
        await addAudioToPlaylist(playlistId, selectedAudioForPlaylist.value.id.toString());
        if (!skipDialog) {
          success('Added', `Added to playlist`);
        }
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

  function handleMouseDown(index: number) {
    console.log('[Playlist] Mouse down on:', index);
    draggedTrackIndex.value = index;
    isDragging.value = true;
  }

  function handleMouseEnter(index: number) {
    if (isDragging.value && draggedTrackIndex.value !== null && draggedTrackIndex.value !== index) {
      console.log('[Playlist] Mouse enter:', index);
      dragOverTrackIndex.value = index;

      // Visually reorder the array in real-time to show where it will drop
      const tracks = [...playlistTracks.value];
      const draggedTrack = tracks[draggedTrackIndex.value];
      tracks.splice(draggedTrackIndex.value, 1);
      tracks.splice(index, 0, draggedTrack);
      playlistTracks.value = tracks;

      // Update the dragged index to the new position
      draggedTrackIndex.value = index;
    }
  }

  function handleMouseLeave() {
    if (isDragging.value) {
      dragOverTrackIndex.value = null;
    }
  }

  async function handleMouseUp(dropIndex: number) {
    console.log('[Playlist] Mouse up at:', dropIndex);

    if (!isDragging.value || !selectedPlaylist.value) {
      isDragging.value = false;
      draggedTrackIndex.value = null;
      dragOverTrackIndex.value = null;
      return;
    }

    // Array is already visually reordered from handleMouseEnter
    // Just need to save to database
    const draggedTrack = playlistTracks.value[dropIndex];

    // Clear drag state
    isDragging.value = false;
    draggedTrackIndex.value = null;
    dragOverTrackIndex.value = null;

    try {
      // Update database with new position
      await reorderPlaylistItem(draggedTrack.playlist_item_id, dropIndex);
    } catch (error) {
      console.error('Reorder error:', error);
      // Reload on error to restore correct order
      await loadPlaylistTracks(selectedPlaylist.value.id);
      showError('Reorder Failed', error instanceof Error ? error.message : String(error));
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

  onMounted(async () => {
    try {
      await Promise.all([loadAudioFiles(), loadPlaylists()]);
    } finally {
      loaded.value = true;
    }

    // Listen for audio library updates (after database save is complete)
    window.addEventListener('audio-library-updated', handleAudioLibraryUpdate);
  });

  function handleAudioLibraryUpdate(event: Event) {
    const customEvent = event as CustomEvent;
    console.log('[AudioLibrary] Audio library updated:', customEvent.detail);
    // Reload audio files after database has been updated
    loadAudioFiles();
  }

  onUnmounted(() => {
    window.removeEventListener('audio-library-updated', handleAudioLibraryUpdate);
  });
</script>
