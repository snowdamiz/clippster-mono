<template>
  <div class="studio-panel">
    <h3 class="studio-panel__title">Branding</h3>

    <div class="studio-panel__field">
      <label class="studio-panel__label">Personal Studio profile</label>
      <div class="relative">
        <button
          type="button"
          class="studio-panel__select"
          @click="showDropdown = !showDropdown"
        >
          <span class="truncate">{{ selectedLabel }}</span>
          <ChevronDown
            class="h-4 w-4 transition-transform"
            :class="{ 'rotate-180': showDropdown }"
          />
        </button>
        <div v-if="showDropdown" class="studio-panel__dropdown">
          <button
            type="button"
            class="studio-panel__dropdown-item"
            :class="{ 'studio-panel__dropdown-item--selected': !selectedProfileId }"
            @click="selectProfile(null)"
          >
            None
          </button>
          <button
            v-for="profile in profiles"
            :key="profile.id"
            type="button"
            class="studio-panel__dropdown-item"
            :class="{ 'studio-panel__dropdown-item--selected': selectedProfileId === profile.id }"
            @click="selectProfile(profile.id)"
          >
            {{ profile.name }}
          </button>
        </div>
      </div>
      <p class="studio-panel__hint">
        Watermark appears live in the recording. Intro/outro are added when recording stops.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted, onUnmounted } from 'vue';
  import { ChevronDown } from 'lucide-vue-next';
  import type { CreatorProfileWithLinks } from '@/services/database/types';

  const selectedProfileId = defineModel<string | null>('selectedProfileId', { required: true });

  const props = defineProps<{
    profiles: CreatorProfileWithLinks[];
  }>();

  const emit = defineEmits<{
    (e: 'profile-selected', profileId: string | null): void;
  }>();

  const showDropdown = ref(false);

  const selectedLabel = computed(() => {
    if (!selectedProfileId.value) return 'None';
    const profile = props.profiles.find((p) => p.id === selectedProfileId.value);
    return profile?.name || 'Selected profile';
  });

  function selectProfile(id: string | null) {
    selectedProfileId.value = id;
    showDropdown.value = false;
    emit('profile-selected', id);
  }

  function onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.studio-panel__select') && !target.closest('.studio-panel__dropdown')) {
      showDropdown.value = false;
    }
  }

  onMounted(() => document.addEventListener('click', onDocClick));
  onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
  .studio-panel {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .studio-panel__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .studio-panel__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .studio-panel__label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .studio-panel__hint {
    font-size: 0.7rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .studio-panel__select {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .studio-panel__dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .studio-panel__dropdown-item {
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--sidebar-text);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .studio-panel__dropdown-item:hover {
    background: var(--sidebar-hover);
  }

  .studio-panel__dropdown-item--selected {
    color: var(--sidebar-accent);
    background: rgba(6, 182, 212, 0.08);
  }
</style>
