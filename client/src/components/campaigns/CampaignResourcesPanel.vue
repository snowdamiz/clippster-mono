<template>
  <div v-if="resources.length > 0" class="campaign-resources-panel">
    <h4 class="campaign-resources-panel__title">Source Content</h4>
    <p class="campaign-resources-panel__subtitle">
      Download source video/audio or review campaign instructions before clipping.
    </p>

    <div class="campaign-resources-panel__list">
      <div v-for="(resource, index) in resources" :key="resource.id ?? resource.title ?? index" class="campaign-resources-panel__item">
        <div class="campaign-resources-panel__meta">
          <span class="campaign-resources-panel__type">{{ formatType(resource.resource_type) }}</span>
          <strong>{{ resource.title || resource.url || 'Untitled material' }}</strong>
          <p v-if="resource.description" class="campaign-resources-panel__desc">{{ resource.description }}</p>
        </div>

        <div class="campaign-resources-panel__actions">
          <button
            v-if="resource.download_target"
            type="button"
            class="campaign-resources-panel__btn"
            @click="openDownload(resource.download_target!)"
          >
            Open in app
          </button>
          <a
            v-else-if="resource.url"
            :href="resource.url"
            target="_blank"
            rel="noopener noreferrer"
            class="campaign-resources-panel__link"
          >
            Open link
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router';
  import type { CampaignResource } from '@/services/campaignApi';

  defineProps<{
    resources: CampaignResource[];
  }>();

  const router = useRouter();

  function formatType(type: CampaignResource['resource_type']) {
    switch (type) {
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'reference_link':
        return 'Reference';
      case 'brief':
        return 'Brief';
      default:
        return 'Material';
    }
  }

  function openDownload(target: string) {
    router.push(target);
  }
</script>

<style scoped>
  .campaign-resources-panel {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .campaign-resources-panel__title {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    color: var(--sidebar-text);
  }

  .campaign-resources-panel__subtitle {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-resources-panel__list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .campaign-resources-panel__item {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: var(--sidebar-surface);
  }

  .campaign-resources-panel__type {
    display: inline-block;
    margin-bottom: 0.25rem;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sidebar-text-muted);
  }

  .campaign-resources-panel__desc {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-resources-panel__btn,
  .campaign-resources-panel__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 110px;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    border: 1px solid rgba(34, 211, 238, 0.35);
    background: rgba(34, 211, 238, 0.08);
    color: #67e8f9;
    font-size: 0.75rem;
    text-decoration: none;
    cursor: pointer;
  }
</style>
