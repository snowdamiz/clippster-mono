<script setup lang="ts">
  /** Pick finished media from the app's libraries (built clips, projects, image and audio libraries). */
  import { computed, ref, watch } from 'vue';
  import { Film, Image as ImageIcon, Music, SearchX } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { MediaTile } from '@/components/ui/media-tile';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import type { MediaFile } from '../analysis/media';
  import { formatDuration } from '../format';
  import { LIBRARY_SOURCES, type LibraryItem, type LibrarySource, libraryThumbnail, loadLibrary } from '../library';

  const props = defineProps<{
    open: boolean;
    title: string;
    sources: LibrarySource[];
    /** Tab shown when the picker opens. */
    initial: LibrarySource;
    multiple: boolean;
  }>();

  const emit = defineEmits<{ close: []; pick: [files: MediaFile[]] }>();

  const ICONS: Record<LibrarySource, typeof Film> = {
    'built-clips': Film,
    projects: Film,
    'image-library': ImageIcon,
    'audio-library': Music,
  };

  const active = ref<LibrarySource>(props.initial);
  const search = ref('');
  const items = ref<Partial<Record<LibrarySource, LibraryItem[]>>>({});
  const errors = ref<Partial<Record<LibrarySource, string>>>({});
  const thumbnails = ref<Record<string, string | null>>({});
  const selected = ref(new Map<string, LibraryItem>());

  const tabs = computed(() =>
    props.sources.map((source) => ({ value: source, label: LIBRARY_SOURCES[source].label, icon: ICONS[source], count: items.value[source]?.length }))
  );
  const loading = computed(() => !items.value[active.value] && !errors.value[active.value]);
  const visible = computed(() => {
    const query = search.value.trim().toLowerCase();
    const list = items.value[active.value] ?? [];
    return query ? list.filter((item) => item.name.toLowerCase().includes(query)) : list;
  });

  const selectionKey = (item: LibraryItem) => `${active.value}:${item.key}`;

  async function load(source: LibrarySource) {
    if (items.value[source]) return;
    try {
      const loaded = await loadLibrary(source);
      items.value = { ...items.value, [source]: loaded };
      for (const item of loaded) {
        if (!item.thumbnail || item.thumbnail in thumbnails.value) continue;
        thumbnails.value = { ...thumbnails.value, [item.thumbnail]: null };
        const key = item.thumbnail;
        void libraryThumbnail(key).then((url) => (thumbnails.value = { ...thumbnails.value, [key]: url }));
      }
    } catch (error) {
      errors.value = { ...errors.value, [source]: error instanceof Error ? error.message : String(error) };
    }
  }

  watch(
    () => props.open,
    (open) => {
      if (!open) return;
      active.value = props.initial;
      search.value = '';
      selected.value = new Map();
      items.value = {};
      errors.value = {};
      void load(active.value);
    },
    { immediate: true }
  );
  watch(active, (source) => void load(source));

  function toggle(item: LibraryItem) {
    const key = selectionKey(item);
    const next = new Map(props.multiple ? selected.value : []);
    if (selected.value.has(key)) next.delete(key);
    else next.set(key, item);
    selected.value = next;
  }

  function confirm() {
    emit(
      'pick',
      [...selected.value.values()].map((item) => ({ path: item.path, name: item.name }))
    );
  }
</script>

<template>
  <Modal :open="open" :title="title" size="xl" flush body-class="flex min-h-0 flex-col" @close="emit('close')">
    <div class="flex shrink-0 items-center gap-3 border-b border-line-subtle px-5 pb-3 pt-2">
      <SegmentedControl v-if="sources.length > 1" v-model="active" :options="tabs" size="sm" />
      <SearchField v-model="search" placeholder="Search…" class="ml-auto w-56" />
    </div>

    <div class="min-h-[360px] flex-1 overflow-y-auto px-5 py-4">
      <div v-if="loading" class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
        <div v-for="i in 8" :key="i" class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <div class="skeleton aspect-video rounded-none" />
          <div class="px-3 py-2.5"><div class="skeleton h-3.5 w-2/3 rounded" /></div>
        </div>
      </div>

      <EmptyState
        v-else-if="errors[active]"
        size="sm"
        :icon="ICONS[active]"
        :title="`Couldn't load ${LIBRARY_SOURCES[active].label.toLowerCase()}`"
        :description="errors[active]"
      />

      <EmptyState
        v-else-if="!visible.length"
        size="sm"
        :icon="search ? SearchX : ICONS[active]"
        :title="search ? 'Nothing matches your search' : `No ${LIBRARY_SOURCES[active].label.toLowerCase()} yet`"
        :description="search ? 'Try a different name.' : LIBRARY_SOURCES[active].empty"
      />

      <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
        <MediaTile
          v-for="item in visible"
          :key="item.key"
          :title="item.name"
          :thumbnail="item.thumbnail ? thumbnails[item.thumbnail] : null"
          :icon="ICONS[active]"
          :meta="[item.meta, item.duration ? formatDuration(item.duration) : null]"
          selectable
          :selected="selected.has(selectionKey(item))"
          @open="toggle(item)"
          @toggle-select="toggle(item)"
        />
      </div>
    </div>

    <template #footer>
      <span class="mr-auto text-xs text-fg-muted">
        <span class="tabular">{{ selected.size }}</span> selected
      </span>
      <Button variant="ghost" @click="emit('close')">Cancel</Button>
      <Button variant="primary" :disabled="!selected.size" @click="confirm">
        Add{{ multiple && selected.size > 1 ? ` ${selected.size}` : '' }}
      </Button>
    </template>
  </Modal>
</template>
