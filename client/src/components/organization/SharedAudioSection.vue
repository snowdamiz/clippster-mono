<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    type SharedAudio,
    listOrganizationSharedAudio,
    getUserSharedAudio,
    deleteSharedAudio,
    getExpirationText,
    markSharedAudioViewed,
  } from '@/services/sharedAudioApi';
  import { downloadSharedAudioToLibrary } from '@/services/sharedAudioDownload';
  import { useToast } from '@/composables/useToast';
  import {
    Music,
    Download,
    Clock,
    AlertCircle,
    RefreshCw,
    Users,
    UserCheck,
    Eye,
    CheckCircle,
    Play,
    Plus,
    Trash2,
  } from 'lucide-vue-next';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { expirationBadgeVariant, formatClock, formatFileSize } from './shared/helpers';

  const props = defineProps<{
    organizationId: string | number;
    organizationName: string;
    isAdmin: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'share-audio'): void;
  }>();

  const { success: showSuccess, error: showError } = useToast();

  const audioFiles = ref<SharedAudio[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const downloadingId = ref<number | null>(null);
  const deletingId = ref<number | null>(null);
  const previewAudio = ref<SharedAudio | null>(null);
  const audioToDelete = ref<SharedAudio | null>(null);

  const sharingFilter = ref<'all' | 'everyone' | 'specific'>('all');
  const sharingOptions: SegmentedOption<'all' | 'everyone' | 'specific'>[] = [
    { value: 'all', label: 'All' },
    { value: 'everyone', label: 'All members', icon: Users },
    { value: 'specific', label: 'Specific', icon: UserCheck },
  ];

  const filteredAudio = computed(() => {
    let result = [...audioFiles.value];

    if (sharingFilter.value === 'everyone') {
      result = result.filter((a) => a.share_with_all);
    } else if (sharingFilter.value === 'specific') {
      result = result.filter((a) => !a.share_with_all);
    }

    return result.sort(
      (a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime()
    );
  });

  async function loadAudio() {
    loading.value = true;
    error.value = null;

    try {
      const response = props.isAdmin
        ? await listOrganizationSharedAudio(props.organizationId)
        : await getUserSharedAudio();

      if (response.success) {
        audioFiles.value = props.isAdmin
          ? response.audio
          : response.audio.filter((a) => String(a.organization_id) === String(props.organizationId));
      } else {
        error.value = response.error || 'Failed to load shared audio';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load shared audio';
    } finally {
      loading.value = false;
    }
  }

  async function handlePreview(audio: SharedAudio) {
    previewAudio.value = audio;
    if (!audio.viewed_at) {
      await markSharedAudioViewed(audio.id);
      audio.viewed_at = new Date().toISOString();
    }
  }

  async function handleDownload(audio: SharedAudio) {
    downloadingId.value = audio.id;

    try {
      const result = await downloadSharedAudioToLibrary(audio, props.organizationName);
      if (result.success) {
        audio.downloaded_at = new Date().toISOString();
        showSuccess(
          result.alreadyExists
            ? `"${audio.name}" is already in your audio library`
            : `"${audio.name}" added to your audio library`
        );
      } else {
        showError(result.error || 'Failed to download audio');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to download audio');
    } finally {
      downloadingId.value = null;
    }
  }

  function requestDelete(audio: SharedAudio) {
    audioToDelete.value = audio;
  }

  async function handleDelete(audio: SharedAudio) {
    audioToDelete.value = null;

    deletingId.value = audio.id;
    try {
      const response = await deleteSharedAudio(props.organizationId, audio.id);
      if (response.success) {
        audioFiles.value = audioFiles.value.filter((a) => a.id !== audio.id);
        showSuccess('Audio deleted');
      } else {
        showError(response.error || 'Failed to delete audio');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to delete audio');
    } finally {
      deletingId.value = null;
    }
  }

  onMounted(loadAudio);

  defineExpose({ loadAudio });
</script>

<template>
  <section class="shared-audio flex flex-col gap-3">
    <div class="flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0 overflow-x-auto">
        <SegmentedControl v-model="sharingFilter" :options="sharingOptions" size="sm" />
      </div>
      <Button variant="ghost" size="icon-sm" title="Refresh" aria-label="Refresh" :disabled="loading" @click="loadAudio">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </div>

    <div
      v-if="loading && audioFiles.length === 0"
      class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3"
      aria-busy="true"
    >
      <div v-for="i in 3" :key="i" class="flex gap-3 rounded-xl border border-line-subtle bg-surface p-3">
        <div class="skeleton size-12 shrink-0 rounded-lg" />
        <div class="flex flex-1 flex-col gap-2 pt-1">
          <div class="skeleton h-3.5 w-2/3" />
          <div class="skeleton h-3 w-1/2" />
          <div class="skeleton mt-1 h-7 w-40" />
        </div>
      </div>
    </div>

    <EmptyState
      v-else-if="error"
      size="sm"
      :icon="AlertCircle"
      tone="danger"
      title="Couldn't load shared audio"
      :description="error"
    >
      <Button variant="secondary" size="sm" @click="loadAudio">Try again</Button>
    </EmptyState>

    <EmptyState
      v-else-if="filteredAudio.length === 0"
      size="sm"
      :icon="Music"
      title="No shared audio yet"
      :description="
        isAdmin ? 'Share music or sound effects with your team for use in clips' : 'No audio has been shared with you yet'
      "
    >
      <Button v-if="isAdmin" variant="secondary" size="sm" @click="emit('share-audio')">
        <Plus />
        Share audio
      </Button>
    </EmptyState>

    <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
      <article
        v-for="audio in filteredAudio"
        :key="audio.id"
        class="flex min-w-0 gap-3 rounded-xl border bg-surface p-3 transition-colors"
        :class="!audio.viewed_at && !isAdmin ? 'border-brand-line' : 'border-line-subtle hover:border-line'"
      >
        <button
          type="button"
          class="group relative grid size-12 shrink-0 place-items-center rounded-lg bg-surface-sunken text-fg-muted transition-colors hover:text-fg"
          :aria-label="`Preview ${audio.name}`"
          @click="handlePreview(audio)"
        >
          <Music class="size-4 group-hover:hidden" />
          <Play class="hidden size-4 fill-current group-hover:block" />
          <span
            v-if="audio.duration"
            class="tabular absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium leading-4 text-white"
          >
            {{ formatClock(audio.duration) }}
          </span>
        </button>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <div class="flex min-w-0 items-start justify-between gap-2">
            <h4 class="truncate text-sm font-medium text-fg">{{ audio.name }}</h4>
            <Badge :variant="expirationBadgeVariant(audio.days_until_expiration)">
              <Clock />
              {{ getExpirationText(audio.days_until_expiration) }}
            </Badge>
          </div>

          <p v-if="audio.description" class="line-clamp-2 text-xs text-fg-muted">{{ audio.description }}</p>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle [&_svg]:size-3">
            <span>{{ formatFileSize(audio.file_size) }}</span>
            <span v-if="audio.downloaded_at" class="inline-flex items-center gap-1 text-success">
              <CheckCircle />
              In library
            </span>
            <template v-if="isAdmin && audio.stats">
              <span class="tabular inline-flex items-center gap-1" title="Viewed"><Eye /> {{ audio.stats.viewed }}</span>
              <span class="tabular inline-flex items-center gap-1" title="Downloaded">
                <Download /> {{ audio.stats.downloaded }}
              </span>
            </template>
          </div>

          <div class="mt-auto flex items-center gap-1.5 pt-1">
            <Button variant="secondary" size="sm" @click="handlePreview(audio)">
              <Play />
              Preview
            </Button>
            <Button variant="secondary" size="sm" :loading="downloadingId === audio.id" @click="handleDownload(audio)">
              <Download v-if="downloadingId !== audio.id" />
              Add to library
            </Button>
            <Button
              v-if="isAdmin"
              variant="ghost"
              size="icon-sm"
              class="ml-auto hover:text-danger"
              title="Delete"
              aria-label="Delete"
              :loading="deletingId === audio.id"
              @click="requestDelete(audio)"
            >
              <Trash2 v-if="deletingId !== audio.id" />
            </Button>
          </div>
        </div>
      </article>
    </div>

    <!-- Preview -->
    <Modal
      :open="!!previewAudio"
      :title="previewAudio?.name"
      :icon="Music"
      size="sm"
      @close="previewAudio = null"
    >
      <div v-if="previewAudio" class="flex flex-col gap-3">
        <audio v-if="previewAudio.url" :src="previewAudio.url" controls class="w-full" />
        <p v-if="previewAudio.description" class="text-sm text-fg-muted">{{ previewAudio.description }}</p>
      </div>
      <template #footer>
        <Button variant="ghost" @click="previewAudio = null">Close</Button>
        <Button
          v-if="previewAudio"
          variant="primary"
          :loading="downloadingId === previewAudio.id"
          @click="handleDownload(previewAudio)"
        >
          <Download v-if="downloadingId !== previewAudio.id" />
          Add to library
        </Button>
      </template>
    </Modal>

    <ConfirmationModal
      :show="!!audioToDelete"
      title="Delete audio?"
      message="This removes"
      :item-name="audioToDelete?.name"
      suffix="for every member."
      confirm-text="Delete"
      variant="destructive"
      @close="audioToDelete = null"
      @confirm="audioToDelete && handleDelete(audioToDelete)"
    />
  </section>
</template>
