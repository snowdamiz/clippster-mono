<script setup lang="ts">
  import { ref } from 'vue';
  import CircleStudioDialog from './CircleStudioDialog.vue';
  import { MOCK_CIRCLE_PACKAGES } from './mocks';
  import type { CirclePackage } from './types';

  const selectedPackage = ref<CirclePackage | null>(null);
  const studioOpen = ref(false);

  function openStudio(pkg: CirclePackage) {
    selectedPackage.value = pkg;
    studioOpen.value = true;
  }

  function closeStudio() {
    studioOpen.value = false;
    selectedPackage.value = null;
  }
</script>

<template>
  <div class="circles-library">
    <div class="circles-library__intro">
      <h3 class="circles-library__heading">Circles</h3>
      <p class="circles-library__copy">
        Recorded Circles for clipping. Mock packages for now — Tokend recordings will replace these fixtures later.
      </p>
    </div>

    <div class="circles-library__grid">
      <button
        v-for="pkg in MOCK_CIRCLE_PACKAGES"
        :key="pkg.id"
        type="button"
        class="circles-library__card"
        @click="openStudio(pkg)"
      >
        <div class="circles-library__thumb">
          <div class="circles-library__thumb-fallback">
            <span class="circles-library__thumb-letter">
              {{ pkg.room.creatorDisplayName?.charAt(0)?.toUpperCase() || 'C' }}
            </span>
          </div>
          <div class="circles-library__badge">
            {{ pkg.seedParticipants.length === 0 ? 'Empty' : 'Seeded' }}
          </div>
        </div>
        <div class="circles-library__meta">
          <h4 class="circles-library__title" :title="pkg.room.title">{{ pkg.room.title }}</h4>
          <p class="circles-library__slug">@{{ pkg.room.creatorSlug }}</p>
        </div>
      </button>
    </div>

    <CircleStudioDialog :open="studioOpen" :circle-package="selectedPackage" @close="closeStudio" />
  </div>
</template>

<style scoped>
  .circles-library {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .circles-library__heading {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--sidebar-text, #fafafa);
  }

  .circles-library__copy {
    margin: 0.35rem 0 0;
    max-width: 42rem;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--sidebar-text-muted, #a1a1aa);
  }

  .circles-library__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  .circles-library__card {
    display: flex;
    flex-direction: column;
    text-align: left;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.1));
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    transition:
      border-color 150ms ease,
      transform 150ms ease;
  }

  .circles-library__card:hover {
    border-color: var(--sidebar-accent);
    transform: translateY(-1px);
  }

  .circles-library__thumb {
    position: relative;
    aspect-ratio: 16 / 10;
    background: linear-gradient(145deg, rgba(14, 165, 233, 0.18), rgba(0, 0, 0, 0.45));
  }

  .circles-library__thumb-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #0a0a0b;
  }

  .circles-library__thumb-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 999px;
    background: #1a1a1c;
    color: #22d3ee;
    font-size: 1.5rem;
    font-weight: 700;
    box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.35);
  }

  .circles-library__badge {
    position: absolute;
    top: 0.6rem;
    left: 0.6rem;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: white;
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .circles-library__meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.85rem 0.9rem 1rem;
  }

  .circles-library__title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--sidebar-text, #fafafa);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .circles-library__slug {
    margin: 0;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted, #a1a1aa);
  }
</style>
