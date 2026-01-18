<template>
  <div class="vod-card group">
    <!-- Thumbnail background -->
    <div v-if="clip.thumbnailUrl" class="vod-card__thumbnail" :style="{ backgroundImage: `url(${clip.thumbnailUrl})` }">
      <div class="vod-card__vignette"></div>
    </div>

    <!-- Empty state background -->
    <div v-else class="vod-card__thumbnail vod-card__thumbnail--empty">
      <div class="vod-card__thumbnail-gradient"></div>
      <div class="vod-card__empty-icon">
        <Video class="vod-card__placeholder-icon" />
      </div>
    </div>

    <!-- Duration Badge -->
    <div v-if="clip.duration" class="vod-card__badge vod-card__badge--duration">
      <Clock class="vod-card__badge-icon" />
      <span>{{ formattedDuration }}</span>
    </div>

    <!-- Bottom Info Overlay -->
    <div class="vod-card__bottom">
      <h3 class="vod-card__title" :title="clip.title">
        {{ clip.title }}
      </h3>
      <div class="vod-card__meta">
        <span class="vod-card__meta-text">Added {{ formattedTime }}</span>
      </div>
    </div>

    <!-- Hover Actions Overlay -->
    <div class="vod-card__hover-actions">
      <button class="vod-card__action-btn" title="Download" @click.stop="downloadClip">
        <Download class="vod-card__action-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { formatDuration, formatRelativeTime, type PumpFunClip } from '@/services/pumpfun';
  import { Video, Download, Clock } from 'lucide-vue-next';

  interface Props {
    clip: PumpFunClip;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    click: [clip: PumpFunClip];
    download: [clip: PumpFunClip];
  }>();

  const formattedDuration = computed(() => formatDuration(props.clip.duration));
  const formattedTime = computed(() => formatRelativeTime(props.clip.createdAt));

  function downloadClip() {
    emit('download', props.clip);
  }
</script>

<style scoped>
  /* ===== VOD Card ===== */
  .vod-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .vod-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  /* Thumbnail */
  .vod-card__thumbnail {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .vod-card__vignette {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.6) 35%, rgba(0, 0, 0, 0.2) 60%, transparent 100%),
      linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, transparent 30%);
  }

  .vod-card__thumbnail--empty {
    background-color: var(--sidebar-hover);
  }

  .vod-card__thumbnail-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.5) 100%);
  }

  /* Empty State Icon */
  .vod-card__empty-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.2;
  }

  .vod-card__placeholder-icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text);
  }

  /* Duration Badge */
  .vod-card__badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3125rem 0.5rem;
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .vod-card__badge--duration {
    background-color: rgba(14, 165, 233, 0.3);
    color: #7dd3fc;
  }

  .vod-card__badge-icon {
    width: 10px;
    height: 10px;
  }

  /* Bottom Info Overlay */
  .vod-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 1rem;
    padding-top: 7rem;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.95) 0%,
      rgba(0, 0, 0, 0.8) 40%,
      rgba(0, 0, 0, 0.4) 70%,
      transparent 100%
    );
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .vod-card__title {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
    line-height: 1.3;
    transition: color 150ms ease;
  }

  .vod-card:hover .vod-card__title {
    color: rgba(255, 255, 255, 0.9);
  }

  .vod-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    flex-wrap: wrap;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .vod-card__meta-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Hover Actions Overlay */
  .vod-card__hover-actions {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .vod-card:hover .vod-card__hover-actions {
    opacity: 1;
  }

  .vod-card__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 9999px;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .vod-card__action-btn:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .vod-card__action-icon {
    width: 20px;
    height: 20px;
  }
</style>
