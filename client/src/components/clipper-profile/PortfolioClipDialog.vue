<script setup lang="ts">
  /**
   * Add or edit one portfolio clip. Adding offers three sources: a built clip
   * from the local library, a video file upload, or a link to a hosted video.
   * Editing changes the title / URLs of an existing clip. Every action hits
   * the API immediately and emits `saved` (with a local poster URL for
   * uploads, which the parent owns and revokes).
   */
  import { computed, reactive, ref, watch } from 'vue';
  import { FolderOpen, Link2, Loader2, Upload, Video } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Dropzone } from '@/components/ui/dropzone';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { MediaTile } from '@/components/ui/media-tile';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { useToast } from '@/composables/useToast';
  import { createPortfolioClip, updatePortfolioClip, type PortfolioClip } from '@/services/clipperProfilesApi';
  import {
    MAX_PORTFOLIO_CLIP_BYTES,
    formatMegabytes,
    libraryClipFile,
    loadLibraryClipThumbnail,
    loadLibraryClips,
    uploadPortfolioVideo,
    type LibraryClip,
  } from './portfolioClipMedia';

  const open = defineModel<boolean>('open', { required: true });
  const props = defineProps<{
    /** Clip to edit; null to add a new one. */
    clip: PortfolioClip | null;
  }>();
  const emit = defineEmits<{ saved: [payload: { clipId?: number; localThumbnail?: string | null }] }>();

  const toast = useToast();

  type Source = 'library' | 'upload' | 'link';
  const sourceOptions = [
    { value: 'library' as const, label: 'My clips', icon: FolderOpen },
    { value: 'upload' as const, label: 'Upload file', icon: Upload },
    { value: 'link' as const, label: 'Link', icon: Link2 },
  ];
  const source = ref<Source>('library');
  const editing = computed(() => !!props.clip);
  /** The title/URL form shows when editing and on the Link tab. */
  const showForm = computed(() => editing.value || source.value === 'link');

  const busy = ref(false);
  const busyClipId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const form = reactive({ title: '', video_url: '', thumbnail_url: '' });

  // ── Library picker ────────────────────────────────────────────────────
  const library = ref<LibraryClip[]>([]);
  const libraryLoading = ref(false);
  const libraryThumbs = reactive(new Map<string, string>());

  async function loadLibrary() {
    libraryLoading.value = true;
    try {
      library.value = await loadLibraryClips();
      for (const clip of library.value) {
        if (libraryThumbs.has(clip.id)) continue;
        void loadLibraryClipThumbnail(clip).then((url) => url && libraryThumbs.set(clip.id, url));
      }
    } catch (err) {
      console.error('Failed to load library clips:', err);
    } finally {
      libraryLoading.value = false;
    }
  }

  const formatDuration = (seconds?: number | null) =>
    seconds ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : null;

  watch(open, (isOpen) => {
    if (!isOpen) return;
    error.value = null;
    source.value = 'library';
    Object.assign(form, {
      title: props.clip?.title ?? '',
      video_url: props.clip?.video_url ?? '',
      thumbnail_url: props.clip?.thumbnail_url ?? '',
    });
    if (!props.clip) void loadLibrary();
  });

  watch(source, () => (error.value = null));

  // ── Actions ───────────────────────────────────────────────────────────
  function done(message: string, payload: { clipId?: number; localThumbnail?: string | null } = {}) {
    emit('saved', payload);
    open.value = false;
    toast.success(message);
  }

  async function upload(file: File, title: string) {
    if (file.size > MAX_PORTFOLIO_CLIP_BYTES) {
      error.value = `Clips can be up to 200 MB. This one is ${formatMegabytes(file.size)}.`;
      return;
    }
    const { response, localThumbnail } = await uploadPortfolioVideo(file, title);
    if (response.success) {
      done('Clip added to your portfolio', { clipId: response.portfolio_clip?.id, localThumbnail });
    } else {
      error.value = response.error || 'Failed to upload clip';
    }
  }

  async function addFromLibrary(clip: LibraryClip) {
    if (busy.value) return;
    busy.value = true;
    busyClipId.value = clip.id;
    error.value = null;
    try {
      const file = await libraryClipFile(clip);
      if (!file) error.value = 'This clip has no built file';
      else await upload(file, clip.name || 'Untitled clip');
    } catch (err) {
      console.error('Failed to add library clip:', err);
      error.value = 'Failed to add clip to portfolio';
    } finally {
      busy.value = false;
      busyClipId.value = null;
    }
  }

  async function addFromFile(files: File[]) {
    const file = files[0];
    if (!file || busy.value) return;
    if (!file.type.startsWith('video/')) {
      error.value = 'Please choose a video file';
      return;
    }
    busy.value = true;
    error.value = null;
    try {
      await upload(file, file.name.replace(/\.[^.]+$/, '') || file.name);
    } catch (err) {
      console.error('Failed to upload clip:', err);
      error.value = 'Failed to upload clip';
    } finally {
      busy.value = false;
    }
  }

  const withScheme = (url: string) => {
    const trimmed = url.trim();
    return !trimmed || /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  async function saveLink() {
    if (!form.video_url.trim() || busy.value) return;
    busy.value = true;
    error.value = null;
    const data = {
      title: form.title.trim(),
      video_url: withScheme(form.video_url),
      thumbnail_url: withScheme(form.thumbnail_url),
    };
    try {
      const response = props.clip ? await updatePortfolioClip(props.clip.id, data) : await createPortfolioClip(data);
      if (response.success) done(props.clip ? 'Clip updated' : 'Clip added to your portfolio');
      else error.value = response.error || 'Failed to save clip';
    } catch (err: any) {
      console.error('Failed to save portfolio clip:', err);
      error.value = err?.response?.data?.error || 'Failed to save clip';
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <Modal
    v-model:open="open"
    :title="editing ? 'Edit portfolio clip' : 'Add portfolio clip'"
    :description="editing ? undefined : 'Clips can be up to 200 MB each.'"
    :icon="Video"
    :size="editing ? 'sm' : 'lg'"
    :dismissible="!busy"
    body-class="flex flex-col gap-4"
  >
    <SegmentedControl v-if="!editing" v-model="source" :options="sourceOptions" block />

    <!-- Adding: a steady min height so switching sources doesn't resize the dialog -->
    <div
      :key="editing ? 'edit' : source"
      class="flex animate-enter flex-col gap-4"
      :class="!editing && 'min-h-[min(360px,50vh)]'"
    >
      <!-- Built clips from the library -->
      <template v-if="!editing && source === 'library'">
        <div
          v-if="libraryLoading && !library.length"
          class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2"
          aria-busy="true"
        >
          <div v-for="n in 3" :key="n" class="flex flex-col gap-2">
            <div class="skeleton aspect-video w-full !rounded-lg" />
            <div class="skeleton h-3 w-2/3" />
          </div>
        </div>
        <EmptyState
          v-else-if="!library.length"
          size="sm"
          :icon="Video"
          title="No built clips yet"
          description="Build a clip in the editor and it will show up here."
        />
        <div
          v-else
          class="grid max-h-[min(360px,50vh)] animate-fade-in grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 overflow-y-auto"
        >
          <MediaTile
            v-for="item in library"
            :key="item.id"
            :title="item.name || 'Untitled clip'"
            :thumbnail="libraryThumbs.get(item.id)"
            :icon="Video"
            :meta="[formatDuration(item.built_duration ?? item.duration), item.project_name]"
            :class="busy && busyClipId !== item.id && 'pointer-events-none opacity-50'"
            :aria-disabled="busy || undefined"
            @open="addFromLibrary(item)"
          >
            <template v-if="busyClipId === item.id" #overlay>
              <div class="absolute inset-0 grid place-items-center bg-[var(--overlay)]">
                <Loader2 class="size-5 animate-spin text-fg" />
              </div>
            </template>
          </MediaTile>
        </div>
      </template>

      <!-- Video file upload -->
      <Dropzone
        v-else-if="!editing && source === 'upload'"
        accept="video/*"
        :icon="Upload"
        title="Choose a video file"
        hint="MP4, MOV or WebM · up to 200 MB"
        class="flex flex-1"
        :loading="busy"
        @files="addFromFile"
      />

      <!-- Hosted video link (also the edit form) -->
      <template v-else-if="showForm">
        <Field label="Title">
          <Input v-model="form.title" placeholder="Clip title" />
        </Field>
        <Field label="Video URL" required>
          <Input v-model="form.video_url" placeholder="https://…" @keydown.enter="saveLink" />
        </Field>
        <Field label="Thumbnail URL" hint="Optional">
          <Input v-model="form.thumbnail_url" placeholder="https://…" @keydown.enter="saveLink" />
        </Field>
      </template>

      <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="busy" @click="open = false">Cancel</Button>
      <Button v-if="showForm" variant="primary" :disabled="!form.video_url.trim()" :loading="busy" @click="saveLink">
        {{ editing ? 'Save clip' : 'Add clip' }}
      </Button>
    </template>
  </Modal>
</template>
