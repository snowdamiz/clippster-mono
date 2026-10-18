<template>
  <div class="page-layout flex h-full min-h-0 w-full min-w-0 flex-col">
    <!-- Page header: title on the left, primary actions on the right -->
    <header
      v-if="showHeader"
      class="page-header relative z-20 flex h-[var(--page-header-height)] shrink-0 items-center gap-4 border-b border-line-subtle px-5"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <span v-if="icon" class="grid size-5 shrink-0 place-items-center text-fg-subtle">
          <img
            v-if="typeof icon === 'string' && icon.endsWith('.svg')"
            :src="icon"
            :alt="title"
            class="size-4 opacity-70 invert"
          />
          <component :is="icon" v-else-if="typeof icon !== 'string'" class="size-4" />
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icon" />
          </svg>
        </span>
        <div class="flex min-w-0 items-center gap-2">
          <slot name="title">
            <nav
              v-if="breadcrumbs && breadcrumbs.length > 0"
              class="flex min-w-0 items-center gap-1 text-sm font-semibold"
              aria-label="Breadcrumb"
            >
              <template v-for="(crumb, index) in breadcrumbs" :key="index">
                <slot v-if="index === 0" name="firstBreadcrumb">
                  <component
                    :is="breadcrumbLink"
                    v-if="crumb.path"
                    :to="breadcrumbLink !== 'a' ? crumb.path : undefined"
                    :href="breadcrumbLink === 'a' ? crumb.path : undefined"
                    class="min-w-0 max-w-[12rem] shrink truncate text-fg-muted transition-colors hover:text-fg"
                  >
                    {{ crumb.label }}
                  </component>
                  <span v-else class="min-w-0 shrink-[0.5] truncate text-fg">{{ crumb.label }}</span>
                </slot>
                <template v-else>
                  <component
                    :is="breadcrumbLink"
                    v-if="crumb.path"
                    :to="breadcrumbLink !== 'a' ? crumb.path : undefined"
                    :href="breadcrumbLink === 'a' ? crumb.path : undefined"
                    class="min-w-0 max-w-[12rem] shrink truncate text-fg-muted transition-colors hover:text-fg"
                  >
                    {{ crumb.label }}
                  </component>
                  <span v-else class="min-w-0 shrink-[0.5] truncate text-fg">{{ crumb.label }}</span>
                </template>
                <ChevronRight v-if="index < breadcrumbs.length - 1" class="size-3.5 shrink-0 text-fg-disabled" />
              </template>
            </nav>
            <h1 v-else class="min-w-0 truncate text-sm font-semibold tracking-[-0.005em] text-fg">{{ title }}</h1>
          </slot>
          <slot name="badge"></slot>
        </div>
      </div>
      <div class="page-header__actions flex shrink-0 items-center justify-end gap-2">
        <slot name="actions"></slot>
      </div>
    </header>

    <!-- Optional secondary row for filters, view switches and tabs -->
    <div
      v-if="$slots.toolbar"
      class="page-toolbar flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line-subtle px-5 py-2"
    >
      <slot name="toolbar"></slot>
    </div>

    <div class="page-layout__content flex min-h-0 flex-1 flex-col overflow-y-auto">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="shrink-0"><slot name="footer" /></div>
  </div>
</template>

<script setup lang="ts">
  import { getCurrentInstance, type Component } from 'vue';
  import { ChevronRight } from 'lucide-vue-next';

  const breadcrumbLink = getCurrentInstance()?.appContext.components.RouterLink || 'a';

  export interface BreadcrumbItem {
    label: string;
    path?: string;
  }

  withDefaults(
    defineProps<{
      title: string;
      /** Kept for context/accessibility; not rendered (the sidebar already labels the page). */
      description?: string;
      showHeader?: boolean;
      icon?: string | Component;
      breadcrumbs?: BreadcrumbItem[];
    }>(),
    { showHeader: true }
  );
</script>
