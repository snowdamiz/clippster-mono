<template>
  <div class="page-layout">
    <!-- Page Header -->
    <header v-if="showHeader" class="page-header">
      <div class="page-header__left">
        <div v-if="icon" class="page-header__icon">
          <!-- SVG file reference -->
          <img
            v-if="typeof icon === 'string' && icon.endsWith('.svg')"
            :src="icon"
            :alt="title"
            class="page-header__icon-img"
          />
          <!-- Component icon -->
          <component v-else-if="typeof icon !== 'string'" :is="icon" class="page-header__icon-component" />
          <!-- Fallback inline SVG path -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="page-header__icon-svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icon" />
          </svg>
        </div>
        <div class="page-header__info">
          <h1 class="page-header__title">{{ title }}</h1>
          <!-- <p class="page-header__description">{{ description }}</p> -->
        </div>
      </div>
      <div class="page-header__actions">
        <!-- <slot name="actions"></slot> -->
      </div>
    </header>
    <!-- Content -->
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';

  defineProps<{
    title: string;
    description: string;
    showHeader?: boolean;
    icon?: string | Component;
  }>();
</script>

<style scoped>
  /* ===== Page Layout Container ===== */
  .page-layout {
    width: 100%;
  }

  /* ===== Page Header ===== */
  .page-header {
    position: sticky;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem;
    border-bottom: 1px solid var(--page-header-border);
    background-color: var(--sidebar-bg);
  }

  .page-header__left {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.1rem;
  }

  /* ===== Icon Styles ===== */
  .page-header__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 8px;
    transition: background-color 150ms ease;
  }

  .page-header__icon-img {
    width: 18px;
    height: 18px;
    filter: invert(0);
  }

  .dark .page-header__icon-img {
    filter: invert(1);
  }

  .page-header__icon-component {
    width: 18px;
    height: 18px;
    color: var(--page-header-accent);
  }

  .page-header__icon-svg {
    width: 18px;
    height: 18px;
    color: var(--page-header-accent);
  }

  /* ===== Text Info ===== */
  .page-header__info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .page-header__title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--page-text);
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin: 0;
  }

  .page-header__description {
    font-size: 0.8125rem;
    color: var(--page-text-muted);
    line-height: 1.4;
    margin: 0;
  }

  /* ===== Actions Slot ===== */
  .page-header__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
</style>
