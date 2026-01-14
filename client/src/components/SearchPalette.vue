<template>
  <Teleport to="body">
    <Transition name="palette-transition">
      <div v-if="modelValue" class="search-palette-overlay" @click.self="close">
        <div class="search-palette">
          <!-- Header with Search Input -->
          <div class="search-palette__header">
            <div class="search-palette__search-row">
              <div class="search-palette__search-icon-wrap">
                <Search class="search-palette__search-icon" />
              </div>
              <input
                ref="searchInputRef"
                :value="searchQuery"
                type="text"
                :placeholder="placeholder"
                class="search-palette__input"
                @input="onSearchInput"
                @keydown.esc="close"
              />
              <div class="search-palette__actions">
                <kbd class="search-palette__kbd">ESC</kbd>
                <button @click="close" class="search-palette__close-btn">
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Tabs -->
            <div v-if="tabs.length > 0" class="search-palette__tabs">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="selectTab(tab.id)"
                class="search-palette__tab"
                :class="{ 'search-palette__tab--active': activeTab === tab.id }"
              >
                <component v-if="tab.icon" :is="tab.icon" class="search-palette__tab-icon" />
                <span>{{ tab.label }}</span>
                <span v-if="tab.badge !== undefined && tab.badge > 0" class="search-palette__tab-badge">
                  {{ tab.badge }}
                </span>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="search-palette__body">
            <slot name="default" :search-query="searchQuery" :active-tab="activeTab"></slot>
          </div>

          <!-- Footer (optional) -->
          <div v-if="$slots.footer" class="search-palette__footer">
            <slot name="footer" :search-query="searchQuery" :active-tab="activeTab"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, nextTick, Teleport, Transition, type Component } from 'vue';
  import { Search, X } from 'lucide-vue-next';

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

<style scoped>
  /* ===== Search Palette - Enhanced Design ===== */
  .search-palette-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 60;
    padding-top: 10vh;
  }

  .search-palette {
    width: 92%;
    max-width: 680px;
    background: linear-gradient(180deg, rgba(30, 30, 35, 0.98) 0%, rgba(24, 24, 28, 0.99) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.3),
      0 24px 80px rgba(0, 0, 0, 0.6),
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 75vh;
  }

  /* Transition animations */
  .palette-transition-enter-active {
    transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .palette-transition-leave-active {
    transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .palette-transition-enter-from {
    opacity: 0;
  }

  .palette-transition-enter-from .search-palette {
    opacity: 0;
    transform: translateY(-16px) scale(0.98);
  }

  .palette-transition-leave-to {
    opacity: 0;
  }

  .palette-transition-leave-to .search-palette {
    opacity: 0;
    transform: translateY(-8px) scale(0.99);
  }

  /* Header */
  .search-palette__header {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }

  .search-palette__search-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
  }

  .search-palette__search-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .search-palette__search-icon {
    width: 18px;
    height: 18px;
    color: #06b6d4;
  }

  .search-palette__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 1.0625rem;
    color: var(--sidebar-text);
    font-weight: 450;
    letter-spacing: -0.01em;
    line-height: 1.4;
  }

  .search-palette__input::placeholder {
    color: rgba(255, 255, 255, 0.35);
    font-weight: 400;
  }

  .search-palette__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .search-palette__kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.02em;
    font-family: inherit;
  }

  .search-palette__close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .search-palette__close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  /* Tabs */
  .search-palette__tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 1.25rem 0.75rem;
  }

  .search-palette__tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .search-palette__tab:hover {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
  }

  .search-palette__tab--active {
    background: rgba(6, 182, 212, 0.12);
    border-color: rgba(6, 182, 212, 0.2);
    color: #06b6d4;
  }

  .search-palette__tab--active:hover {
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .search-palette__tab-icon {
    width: 14px;
    height: 14px;
    opacity: 0.8;
  }

  .search-palette__tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 0.375rem;
    background: rgba(6, 182, 212, 0.2);
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #06b6d4;
  }

  .search-palette__tab--active .search-palette__tab-badge {
    background: rgba(6, 182, 212, 0.3);
  }

  /* Body */
  .search-palette__body {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Footer */
  .search-palette__footer {
    padding: 0.875rem 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
  }
</style>
