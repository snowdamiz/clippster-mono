<template>
  <Modal
    :open="modelValue"
    title="Search"
    size="lg"
    flush
    hide-close
    class="top-[12vh] translate-y-0 max-h-[min(560px,calc(88vh-2rem))]"
    @close="close"
  >
    <template #header>
      <div class="shrink-0 border-b border-line-subtle">
        <div class="flex h-12 items-center gap-2.5 pl-4 pr-3">
          <Search class="size-4 shrink-0 text-fg-subtle" />
          <input
            ref="searchInputRef"
            :value="searchQuery"
            type="text"
            :placeholder="placeholder"
            spellcheck="false"
            autocomplete="off"
            class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
            @input="onSearchInput"
          />
          <button
            type="button"
            class="h-5 shrink-0 rounded border border-line bg-surface-hover px-1.5 text-2xs font-medium text-fg-subtle transition-colors hover:text-fg"
            title="Close"
            aria-label="Close search"
            @click="close"
          >
            Esc
          </button>
        </div>

        <div v-if="tabs.length > 0" class="px-3 pb-2.5">
          <SegmentedControl
            :model-value="activeTab"
            :options="tabOptions"
            size="sm"
            @update:model-value="selectTab"
          />
        </div>
      </div>
    </template>

    <!-- Keyed by tab so each switch eases in -->
    <div :key="activeTab" class="animate-enter overscroll-contain">
      <slot name="default" :search-query="searchQuery" :active-tab="activeTab"></slot>
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" :search-query="searchQuery" :active-tab="activeTab"></slot>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  /**
   * Command-palette style search dialog (Video library, Built clips, Video
   * editor). Pages render their own results in the default slot; use
   * <SearchPaletteItem> for result rows and <EmptyState size="sm"> for empty
   * states.
   */
  import { ref, watch, nextTick, computed, type Component } from 'vue';
  import { Search } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

  export interface SearchPaletteTab {
    id: string;
    label: string;
    icon?: Component;
    badge?: number;
  }

  interface Props {
    modelValue: boolean;
    searchQuery?: string;
    activeTab?: string;
    placeholder?: string;
    tabs?: SearchPaletteTab[];
  }

  const props = withDefaults(defineProps<Props>(), {
    searchQuery: '',
    activeTab: '',
    placeholder: 'Search...',
    tabs: () => [],
  });

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'update:searchQuery', value: string): void;
    (e: 'update:activeTab', value: string): void;
    (e: 'close'): void;
  }>();

  const searchInputRef = ref<HTMLInputElement | null>(null);

  const tabOptions = computed((): SegmentedOption<string>[] =>
    props.tabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
      icon: tab.icon,
      count: tab.badge !== undefined && tab.badge > 0 ? tab.badge : undefined,
    }))
  );

  function close() {
    emit('update:modelValue', false);
    emit('close');
  }

  function onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:searchQuery', target.value);
  }

  function selectTab(tabId: string) {
    emit('update:activeTab', tabId);
  }

  // Focus input when palette opens
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        nextTick(() => {
          setTimeout(() => {
            searchInputRef.value?.focus();
          }, 100);
        });
      }
    }
  );
</script>
