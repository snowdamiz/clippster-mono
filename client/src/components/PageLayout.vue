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
          <div class="page-header__title-row">
            <!-- Title slot for custom content -->
            <slot name="title">
              <!-- Breadcrumbs -->
              <nav v-if="breadcrumbs && breadcrumbs.length > 0" class="page-header__breadcrumbs">
                <template v-for="(crumb, index) in breadcrumbs" :key="index">
                  <!-- First breadcrumb slot for custom content (e.g., OrganizationSelector) -->
                  <slot v-if="index === 0" name="firstBreadcrumb">
                    <router-link v-if="crumb.path" :to="crumb.path" class="page-header__breadcrumb-link">
                      {{ crumb.label }}
                    </router-link>
                    <span v-else class="page-header__breadcrumb-text">{{ crumb.label }}</span>
                  </slot>
                  <!-- Regular breadcrumbs -->
                  <template v-else>
                    <router-link v-if="crumb.path" :to="crumb.path" class="page-header__breadcrumb-link">
                      {{ crumb.label }}
                    </router-link>
                    <span v-else class="page-header__breadcrumb-text">{{ crumb.label }}</span>
                  </template>
                  <ChevronRight v-if="index < breadcrumbs.length - 1" class="page-header__breadcrumb-separator" />
                </template>
              </nav>
              <!-- Simple title (when no breadcrumbs) -->
              <h1 v-else class="page-header__title">{{ title }}</h1>
            </slot>
            <slot name="badge"></slot>
          </div>
          <!-- <p class="page-header__description">{{ description }}</p> -->
        </div>
      </div>
      <div class="page-header__actions">
        <slot name="actions"></slot>
      </div>
    </header>
    <!-- Content -->
    <div class="page-layout__content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';
  import { ChevronRight } from 'lucide-vue-next';

  export interface BreadcrumbItem {
    label: string;
    path?: string;
  }

  defineProps<{
    title: string;
    description: string;
    showHeader?: boolean;
    icon?: string | Component;
    breadcrumbs?: BreadcrumbItem[];
  }>();
</script>

<style scoped>
  /* ===== Page Layout Container ===== */
  .page-layout {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .page-layout__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  /* ===== Page Header ===== */
  .page-header {
    flex-shrink: 0;
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

  .page-header__title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-header__title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--page-text);
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin: 0;
  }

  /* ===== Breadcrumbs ===== */
  .page-header__breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .page-header__breadcrumb-link {
    color: var(--page-text-muted);
    text-decoration: none;
    transition: color 150ms ease;
  }

  .page-header__breadcrumb-link:hover {
    color: var(--page-text);
  }

  .page-header__breadcrumb-text {
    color: var(--page-text);
  }

  .page-header__breadcrumb-separator {
    width: 14px;
    height: 14px;
    color: var(--page-text-muted);
    opacity: 0.5;
    flex-shrink: 0;
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
