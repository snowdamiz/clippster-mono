<script setup lang="ts">
  /**
   * Top of the session rail: the project's videos and images (only for projects started with
   * media), the example to copy (or the shape), and the song. Everything is analyzed as soon as
   * it's added. Files dropped on the window are added here; a single video dropped on the example
   * section, or on a project without clips, becomes the example.
   */
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { Clapperboard, Library, Music, Upload, X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import {
    AUDIO_EXTENSIONS,
    PHOTO_EXTENSIONS,
    VIDEO_EXTENSIONS,
    type MediaFile,
    fileExtension,
    fileName,
    mediaThumbnail,
    pickFiles,
  } from '../analysis/media';
  import { ASPECT_RATIOS } from '../director/aspect';
  import { formatDuration } from '../format';
  import type { MotionGraphicsLevel } from '../types';
  import type { LibrarySource } from '../library';
  import { useProject } from '../projectContext';
  import LibraryPicker from './LibraryPicker.vue';
  import MediaThumb from './MediaThumb.vue';

  const FOOTAGE_SOURCES: LibrarySource[] = ['built-clips', 'projects', 'image-library'];
  const MUSIC_SOURCES: LibrarySource[] = ['audio-library'];
  const {
    session,
    clips,
    song,
    exampleDraft,
    policy,
    hasExample,
    needsExampleAnalysis,
    analysis,
    aspect,
    motionGraphics,
    speechPending,
    speechError,
    running,
    ...project
  } = useProject();

  const exampleSection = ref<HTMLElement | null>(null);
  const dragging = ref(false);
  const thumbnails = ref<Record<string, string | null>>({});
  const exampleUrl = ref(
    exampleDraft.value?.kind === 'url' ? exampleDraft.value.value : (session.value?.reference?.sourceUrl ?? '')
  );
  const picker = ref<'footage' | 'music' | null>(null);

  const locked = computed(() => !!running.value);
  const aspectOptions = computed(() => ASPECT_RATIOS.map((value) => ({ value, label: value, disabled: locked.value })));
  const graphicsOptions = computed(() => [
    { value: 'none', label: 'None', disabled: locked.value },
    { value: 'light', label: 'Light', disabled: locked.value },
    { value: 'full', label: 'Full', disabled: locked.value },
  ]);

  function setGraphics(value: string) {
    void project.setMotionGraphics(value as MotionGraphicsLevel);
  }
  function speakersFor(hash: string) {
    const turns = session.value?.speech_index?.[hash] ?? [];
    return [...new Set(turns.map((turn) => turn.speakerId).filter((id): id is string => !!id))].map((id, index) => ({
      id,
      label: `Speaker ${index + 1}`,
      name: turns.find((turn) => turn.speakerId === id)?.speakerName ?? '',
      position: turns.find((turn) => turn.speakerId === id)?.speakerPosition ?? 'wide',
      example: turns.find((turn) => turn.speakerId === id)?.text ?? '',
    }));
  }
  const reference = computed(() => session.value?.reference ?? null);
  const example = computed(() => {
    const draft = exampleDraft.value;
    if (draft?.kind === 'upload') return { label: fileName(draft.value), sub: 'new', preview: null };
    if (draft?.kind === 'url') return { label: 'Example from your link', sub: 'new', preview: null };
    if (reference.value) {
      return {
        label: reference.value.displayName,
        sub: formatDuration(reference.value.duration),
        preview: `${convertFileSrc(reference.value.path)}#t=1`,
      };
    }
    return null;
  });
  const exampleStatus = computed(() => {
    const progress = analysis.example;
    if (progress)
      return progress.progress > 0 && progress.progress < 100
        ? `${progress.message} (${Math.round(progress.progress)}%)`
        : progress.message;
    if (exampleUrl.value.trim() && !example.value) return 'Paste the full link, starting with https://';
    if (needsExampleAnalysis.value && !analysis.exampleError && policy.value)
      return `Analyzing it uses ${policy.value.credits.reference} credits.`;
    return null;
  });
  const clipsStatus = computed(() => {
    const progress = analysis.clips;
    return progress
      ? `Looking through your clips (${Math.min(progress.done + 1, progress.total)} of ${progress.total})...`
      : null;
  });

  watch(
    clips,
    (items) => {
      for (const item of items) {
        if (item.contentHash in thumbnails.value) continue;
        thumbnails.value = { ...thumbnails.value, [item.contentHash]: null };
        void mediaThumbnail(item).then((url) => (thumbnails.value = { ...thumbnails.value, [item.contentHash]: url }));
      }
    },
    { immediate: true }
  );

  const toFiles = (paths: string[]): MediaFile[] => paths.map((path) => ({ path }));

  async function uploadFootage() {
    await project.addMedia(
      toFiles(await pickFiles([...VIDEO_EXTENSIONS, ...PHOTO_EXTENSIONS], true, 'Videos and images'))
    );
  }

  async function uploadSong() {
    await project.addMedia(toFiles(await pickFiles(AUDIO_EXTENSIONS, false, 'Song')));
  }

  function addPicked(files: MediaFile[]) {
    picker.value = null;
    void project.addMedia(files);
  }

  function onExampleUrl(value: string | number) {
    exampleUrl.value = String(value);
    project.setExampleUrl(exampleUrl.value);
  }

  async function uploadExample() {
    const [path] = await pickFiles(VIDEO_EXTENSIONS, false, 'Example video');
    if (path) useExampleFile(path);
  }

  function useExampleFile(path: string) {
    exampleUrl.value = '';
    project.setExampleFile(path);
  }

  function removeExample() {
    exampleUrl.value = '';
    void project.removeExample();
  }

  function overExample(position: { x: number; y: number }) {
    const rect = exampleSection.value?.getBoundingClientRect();
    if (!rect) return false;
    const x = position.x / window.devicePixelRatio;
    const y = position.y / window.devicePixelRatio;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function onDrop(paths: string[], position: { x: number; y: number }) {
    if (locked.value) return;
    const video = paths.length === 1 && VIDEO_EXTENSIONS.includes(fileExtension(paths[0]));
    if (video && (overExample(position) || !clips.value.length)) useExampleFile(paths[0]);
    else void project.addMedia(toFiles(paths));
  }

  let unlisten: UnlistenFn | null = null;
  let unmounted = false;
  onMounted(async () => {
    const stop = await getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === 'drop') {
        dragging.value = false;
        onDrop(payload.paths, payload.position);
      } else {
        dragging.value = payload.type !== 'leave';
      }
    });
    if (unmounted) stop();
    else unlisten = stop;
  });
  onBeforeUnmount(() => {
    unmounted = true;
    unlisten?.();
  });
</script>

<template>
  <div class="flex flex-col gap-5 p-4" :class="dragging && 'bg-brand-soft'">
    <section v-if="clips.length" class="flex flex-col gap-2">
      <SectionHeader title="Videos and images" variant="eyebrow" :count="clips.length" class="min-h-5" />
      <div class="grid grid-cols-3 gap-1.5">
        <MediaThumb
          v-for="item in clips"
          :key="item.id"
          :label="item.name"
          :sub="item.kind === 'video' ? formatDuration(item.duration) : `${item.width}×${item.height}`"
          :thumbnail="thumbnails[item.contentHash]"
          :removable="!locked"
          @remove="project.removeMedia(item.id)"
        />
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <Button variant="secondary" size="xs" :disabled="locked" @click="uploadFootage">
          <Upload />
          Upload
        </Button>
        <Button variant="secondary" size="xs" :disabled="locked" @click="picker = 'footage'">
          <Library />
          From library
        </Button>
        <span class="text-2xs text-fg-subtle">or drop files here</span>
      </div>
      <div
        v-for="item in clips.filter((clip) => clip.kind === 'video' && clip.hasAudio)"
        :key="`${item.id}-speech`"
        class="flex items-center justify-between gap-2 rounded-md border border-line-subtle px-2 py-1.5 text-xs"
      >
        <span class="min-w-0 truncate text-fg-muted">
          {{ item.name }}:
          {{
            session?.speech_index?.[item.contentHash]
              ? `${session.speech_index[item.contentHash].length} speech turns analyzed`
              : 'Speech not analyzed'
          }}
        </span>
        <Button
          variant="secondary"
          size="xs"
          :disabled="locked || !!speechPending"
          @click="project.analyzeSpeech(item.id)"
        >
          {{
            speechPending === item.id
              ? 'Analyzing…'
              : session?.speech_index?.[item.contentHash]
                ? 'Analyze again'
                : 'Analyze speech'
          }}
        </Button>
      </div>
      <div
        v-for="item in clips.filter(
          (clip) => clip.kind === 'video' && clip.hasAudio && session?.speech_index?.[clip.contentHash]
        )"
        :key="`${item.id}-speakers`"
        class="space-y-1 rounded-md border border-line-subtle p-2"
      >
        <p class="truncate text-xs font-medium text-fg">Speakers in {{ item.name }}</p>
        <label
          v-for="speaker in speakersFor(item.contentHash)"
          :key="speaker.id"
          class="flex flex-wrap items-center gap-2 text-xs text-fg-muted"
        >
          <span class="w-20 shrink-0">{{ speaker.label }}</span>
          <input
            :value="speaker.name"
            :placeholder="'Name if known'"
            maxlength="100"
            class="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-fg"
            @change="project.nameSpeaker(item.id, speaker.id, ($event.target as HTMLInputElement).value)"
          />
          <select
            :value="speaker.position"
            title="Where is this speaker on screen?"
            class="rounded border border-line bg-surface px-1 py-1 text-fg"
            @change="
              project.positionSpeaker(
                item.id,
                speaker.id,
                ($event.target as HTMLSelectElement).value as 'left' | 'center' | 'right' | 'wide'
              )
            "
          >
            <option value="wide">Wide</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <span class="w-full truncate pl-[5.5rem] text-2xs text-fg-subtle" :title="speaker.example">
            “{{ speaker.example }}”
          </span>
        </label>
      </div>
      <p v-if="clips.some((clip) => clip.kind === 'video' && clip.hasAudio)" class="text-2xs text-fg-subtle">
        Speech analysis uses transcription credits. It labels up to four voices per audio chunk; review the names before
        editing.
      </p>
      <p v-if="speechError" role="alert" class="text-xs text-danger">{{ speechError }}</p>
      <div v-if="analysis.clipsError" class="flex items-center gap-2">
        <span class="text-xs text-danger">{{ analysis.clipsError }}</span>
        <Button variant="link" size="xs" @click="project.retryClips()">Try again</Button>
      </div>
      <span v-else-if="clipsStatus" class="text-xs text-fg-subtle">{{ clipsStatus }}</span>
    </section>

    <section ref="exampleSection" class="flex flex-col gap-2">
      <SectionHeader title="Example to copy" variant="eyebrow" class="min-h-5">
        <Button v-if="!example" variant="link" size="xs" :disabled="locked" @click="uploadExample">Upload</Button>
      </SectionHeader>
      <div v-if="example" class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-panel p-2">
        <div class="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
          <video
            v-if="example.preview"
            :src="example.preview"
            preload="metadata"
            muted
            class="absolute inset-0 size-full object-cover"
          />
          <Clapperboard v-else class="absolute inset-0 m-auto size-4 text-fg-subtle" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg" :title="example.label">{{ example.label }}</p>
          <p class="text-xs text-fg-subtle">{{ example.sub }}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Remove example"
          aria-label="Remove example"
          :disabled="locked"
          @click="removeExample"
        >
          <X />
        </Button>
      </div>
      <Input
        v-else
        :model-value="exampleUrl"
        type="url"
        class="text-xs"
        placeholder="Paste an X or YouTube link, or drop a video"
        :disabled="locked"
        @update:model-value="onExampleUrl"
      />
      <div v-if="analysis.exampleError" class="flex items-center gap-2">
        <span class="text-xs text-danger">{{ analysis.exampleError }}</span>
        <Button variant="link" size="xs" @click="project.retryExample()">Try again</Button>
      </div>
      <span v-else-if="exampleStatus" class="text-xs text-fg-subtle">{{ exampleStatus }}</span>
      <span v-else-if="!example" class="text-2xs text-fg-subtle">
        The AI copies how it's edited, never its footage or music.
      </span>
    </section>

    <section v-if="!hasExample" class="flex flex-col gap-2">
      <SectionHeader title="Shape" variant="eyebrow" class="min-h-5" />
      <SegmentedControl
        :model-value="aspect"
        :options="aspectOptions"
        size="sm"
        @update:model-value="project.setAspect"
      />
    </section>

    <section class="flex flex-col gap-2">
      <SectionHeader title="Motion graphics" variant="eyebrow" class="min-h-5" />
      <SegmentedControl
        :model-value="motionGraphics"
        :options="graphicsOptions"
        size="sm"
        @update:model-value="setGraphics"
      />
      <p class="text-2xs text-fg-subtle">
        None keeps the edit natural. Light adds occasional titles. Full uses designed animated scenes.
      </p>
    </section>

    <section class="flex flex-col gap-2">
      <SectionHeader title="Music" variant="eyebrow" class="min-h-5" />
      <div v-if="song" class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-panel p-2">
        <div class="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunken text-fg-subtle">
          <Music class="size-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg" :title="song.name">{{ song.name }}</p>
          <p class="tabular text-xs text-fg-subtle">{{ formatDuration(song.duration) }}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Remove song"
          aria-label="Remove song"
          :disabled="locked"
          @click="project.removeMedia(song.id)"
        >
          <X />
        </Button>
      </div>
      <template v-else>
        <div class="flex flex-wrap gap-1.5">
          <Button variant="secondary" size="xs" :disabled="locked" @click="uploadSong">
            <Upload />
            Upload
          </Button>
          <Button variant="secondary" size="xs" :disabled="locked" @click="picker = 'music'">
            <Library />
            Audio library
          </Button>
        </div>
        <span class="text-2xs text-fg-subtle">Without a song, your clips keep their own sound.</span>
      </template>
    </section>

    <LibraryPicker
      :open="!!picker"
      :title="picker === 'music' ? 'Add a song' : 'Add videos and images'"
      :sources="picker === 'music' ? MUSIC_SOURCES : FOOTAGE_SOURCES"
      :initial="picker === 'music' ? 'audio-library' : 'built-clips'"
      :multiple="picker !== 'music'"
      @close="picker = null"
      @pick="addPicked"
    />
  </div>
</template>
