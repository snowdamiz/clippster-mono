<script setup lang="ts">
  import { ref } from 'vue';
  import { Badge } from '@/components/ui/badge';
  import { MediaTile } from '@/components/ui/media-tile';
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
  <div class="circles-library flex flex-col gap-3">
    <p class="max-w-2xl text-xs text-fg-muted">
      Recorded Circles for clipping. Mock packages for now — Tokend recordings will replace these fixtures later.
    </p>

    <div class="card-grid">
      <MediaTile
        v-for="pkg in MOCK_CIRCLE_PACKAGES"
        :key="pkg.id"
        :title="pkg.room.title"
        :meta="[`@${pkg.room.creatorSlug}`]"
        @open="openStudio(pkg)"
      >
        <template #placeholder>
          <span
            class="grid size-12 place-items-center rounded-full border border-line-strong bg-surface-raised text-lg font-semibold text-fg-muted"
          >
            {{ pkg.room.creatorDisplayName?.charAt(0)?.toUpperCase() || 'C' }}
          </span>
        </template>
        <template #badges>
          <Badge variant="neutral" class="bg-surface-raised">
            {{ pkg.seedParticipants.length === 0 ? 'Empty' : 'Seeded' }}
          </Badge>
        </template>
      </MediaTile>
    </div>

    <CircleStudioDialog :open="studioOpen" :circle-package="selectedPackage" @close="closeStudio" />
  </div>
</template>
