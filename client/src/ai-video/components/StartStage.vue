<script setup lang="ts">
  /** Setup screen: videos, images, the example video, optional music, the request and Go. */
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { Film } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { SectionCard } from '@/components/ui/section-card';
  import { Textarea } from '@/components/ui/textarea';
  import { AUDIO_EXTENSIONS, PHOTO_EXTENSIONS, VIDEO_EXTENSIONS, type MediaFile, fileExtension, fileName, mediaThumbnail } from '../analysis/media';
  import { formatDuration } from '../format';
  import { LIBRARY_SOURCES, type LibrarySource } from '../library';
  import { useProject } from '../projectContext';
  import LibraryPicker from './LibraryPicker.vue';
  import MediaThumb from './MediaThumb.vue';

  const { session, clips, song, exampleDraft, request, policy, goCost, hasExample, document, editingSetup, ...project } = useProject();

  const VIDEO_SOURCES: LibrarySource[] = ['built-clips', 'projects'];
  const IMAGE_SOURCES: LibrarySource[] = ['image-library'];
  const MUSIC_SOURCES: LibrarySource[] = ['audio-library'];

  const exampleCard = ref<HTMLElement | null>(null);
  const dragging = ref(false);
  const thumbnails = ref<Record<string, string | null>>({});
  const exampleUrl = ref(exampleDraft.value?.kind === 'url' ? exampleDraft.value.value : (session.value?.reference?.sourceUrl ?? ''));
  const picker = ref<{ title: string; sources: LibrarySource[]; initial: LibrarySource; multiple: boolean } | null>(null);

  const videos = computed(() => clips.value.filter((item) => item.kind === 'video'));
  const photos = computed(() => clips.value.filter((item) => item.kind === 'photo'));

  const reference = computed(() => session.value?.reference ?? null);
  const example = computed(() => {
    const draft = exampleDraft.value;
    if (draft?.kind === 'upload') return { label: fileName(draft.value), sub: 'new', preview: null };
    if (draft?.kind === 'url') return { label: 'Example from your link', sub: 'new', preview: null };
    if (reference.value) {
      return { label: reference.value.displayName, sub: formatDuration(reference.value.duration), preview: `${convertFileSrc(reference.value.path)}#t=1` };
    }
    return null;
  });
  const canGo = computed(() => clips.value.length > 0 && hasExample.value && !project.running.value);
  const maxSeconds = computed(() => policy.value?.max_output_seconds ?? 60);

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

  function onExampleUrl(value: string | number) {
    exampleUrl.value = String(value);
    project.setExampleUrl(exampleUrl.value);
  }

  async function pick(extensions: string[], multiple: boolean, name: string): Promise<string[]> {
    const selected = await openDialog({ multiple, filters: [{ name, extensions }] });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  }

  const toFiles = (paths: string[]): MediaFile[] => paths.map((path) => ({ path }));

  async function uploadVideos() {
    await project.addMedia(toFiles(await pick(VIDEO_EXTENSIONS, true, 'Videos')));
  }

  async function uploadImages() {
    await project.addMedia(toFiles(await pick(PHOTO_EXTENSIONS, true, 'Images')));
  }

  async function uploadSong() {
    await project.addMedia(toFiles(await pick(AUDIO_EXTENSIONS, false, 'Song')));
  }

  function openLibrary(title: string, sources: LibrarySource[], initial: LibrarySource, multiple = true) {
    picker.value = { title, sources, initial, multiple };
  }

  function addFromLibrary(files: MediaFile[]) {
    picker.value = null;
    void project.addMedia(files);
  }

  async function chooseExampleFile() {
    const [path] = await pick(VIDEO_EXTENSIONS, false, 'Example video');
    if (path) useExampleFile(path);
  }

  function useExampleFile(path: string) {
    exampleUrl.value = '';
    project.setExampleFile(path);
  }

  function overExample(position: { x: number; y: number }) {
    const rect = exampleCard.value?.getBoundingClientRect();
    if (!rect) return false;
    const x = position.x / window.devicePixelRatio;
    const y = position.y / window.devicePixelRatio;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function onDrop(paths: string[], position: { x: number; y: number }) {
    const video = paths.length === 1 && VIDEO_EXTENSIONS.includes(fileExtension(paths[0]));
    if (video && overExample(position)) useExampleFile(paths[0]);
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
  <div class="mx-auto flex w-full max-w-[1100px] flex-col gap-5 p-6">
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold text-fg">Make a video like this one</h2>
      <p class="text-sm text-fg-muted">Drop in your clips, show an example, press Go. No settings needed.</p>
    </div>

    <div class="grid grid-cols-[3fr_2fr] gap-4">
      <div class="flex flex-col gap-4">
        <SectionCard title="Videos" :class="dragging && 'border-brand-line'">
          <template #actions>
            <span class="text-xs text-fg-subtle">{{ videos.length }} {{ videos.length === 1 ? 'video' : 'videos' }}</span>
          </template>
          <div class="flex flex-col gap-3">
            <div v-if="videos.length" class="grid grid-cols-4 gap-2">
              <MediaThumb
                v-for="item in videos"
                :key="item.id"
                :label="item.name"
                :sub="formatDuration(item.duration)"
                :thumbnail="thumbnails[item.contentHash]"
                removable
                @remove="project.removeMedia(item.id)"
              />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" @click="uploadVideos">Upload</Button>
              <Button
                v-for="source in VIDEO_SOURCES"
                :key="source"
                variant="secondary"
                size="sm"
                @click="openLibrary('Add videos', VIDEO_SOURCES, source)"
              >
                {{ LIBRARY_SOURCES[source].label }}
              </Button>
              <span class="text-xs text-fg-subtle">or drag files here</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Images" :class="dragging && 'border-brand-line'">
          <template #actions>
            <span class="text-xs text-fg-subtle">{{ photos.length }} {{ photos.length === 1 ? 'image' : 'images' }}</span>
          </template>
          <div class="flex flex-col gap-3">
            <div v-if="photos.length" class="grid grid-cols-4 gap-2">
              <MediaThumb
                v-for="item in photos"
                :key="item.id"
                :label="item.name"
                :sub="`${item.width}×${item.height}`"
                :thumbnail="thumbnails[item.contentHash]"
                removable
                @remove="project.removeMedia(item.id)"
              />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" @click="uploadImages">Upload</Button>
              <Button
                v-for="source in IMAGE_SOURCES"
                :key="source"
                variant="secondary"
                size="sm"
                @click="openLibrary('Add images', IMAGE_SOURCES, source)"
              >
                {{ LIBRARY_SOURCES[source].label }}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <div class="flex flex-col gap-4">
        <div ref="exampleCard">
          <SectionCard title="Example video">
            <template #actions>
              <Button variant="ghost" size="xs" @click="chooseExampleFile">Upload</Button>
            </template>
            <div class="flex flex-col gap-2">
              <Input :model-value="exampleUrl" type="url" placeholder="Paste an X or YouTube link, or drop a video" @update:model-value="onExampleUrl" />
              <MediaThumb v-if="example" :label="example.label" :sub="example.sub">
                <template #preview>
                  <video v-if="example.preview" :src="example.preview" preload="metadata" muted class="absolute inset-0 size-full object-cover" />
                  <Film v-else class="absolute inset-0 m-auto size-6 text-fg-subtle" :stroke-width="1.5" />
                </template>
              </MediaThumb>
              <p class="text-xs text-fg-subtle">The AI copies how it's edited. It never reuses its footage or music.</p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Music">
          <template #actions><span class="text-xs text-fg-subtle">optional</span></template>
          <div v-if="song" class="flex items-center gap-2">
            <span class="min-w-0 truncate text-xs text-fg" :title="song.name">{{ song.name }}</span>
            <span class="tabular text-xs text-fg-subtle">{{ formatDuration(song.duration) }}</span>
            <Button variant="ghost" size="sm" class="ml-auto" @click="project.removeMedia(song.id)">Remove</Button>
          </div>
          <div v-else class="flex flex-col gap-2">
            <span class="text-xs text-fg-subtle">No song added. Your clips' own audio will be used.</span>
            <div class="flex items-center gap-2">
              <Button variant="secondary" size="sm" @click="uploadSong">Upload</Button>
              <Button variant="secondary" size="sm" @click="openLibrary('Add a song', MUSIC_SOURCES, 'audio-library', false)">
                {{ LIBRARY_SOURCES['audio-library'].label }}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>

    <LibraryPicker
      :open="!!picker"
      :title="picker?.title ?? ''"
      :sources="picker?.sources ?? []"
      :initial="picker?.initial ?? 'built-clips'"
      :multiple="picker?.multiple ?? true"
      @close="picker = null"
      @pick="addFromLibrary"
    />

    <div class="flex flex-col gap-2">
      <Textarea v-model="request" rows="2" class="min-h-0" />
      <div class="flex items-center gap-3">
        <Button variant="primary" :disabled="!canGo" @click="project.go()">Go</Button>
        <Button v-if="document" variant="ghost" @click="editingSetup = false">Back to my video</Button>
        <span class="text-xs text-fg-subtle">
          <template v-if="goCost !== null">Uses {{ goCost }} credits. </template>Finished videos are up to {{ maxSeconds }} seconds.
        </span>
      </div>
    </div>
  </div>
</template>
