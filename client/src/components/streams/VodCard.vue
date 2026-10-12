<script setup lang="ts">
  /**
   * Result card for the Download video / Download audio grids: 16:9
   * thumbnail with platform + duration chips, title and meta below, a
   * hover checkbox for multi-select and a download action.
   * Pass `skeleton` to render the loading placeholder with the same footprint
   * (delayed like every skeleton, so fast loads never flash it).
   */
  import type { Component } from 'vue'
  import { Check, Clock, Download, Video } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Checkbox } from '@/components/ui/checkbox'
  import { PlatformLogo } from '@/components/ui/platform-logo'

  withDefaults(
    defineProps<{
      title?: string
      thumbnailUrl?: string
      platform?: string | null
      duration?: string | null
      /** Meta line items, joined with dots (uploader, date, relative time). */
      meta?: (string | null | undefined)[]
      /** Tooltip for the meta line (e.g. the absolute date). Defaults to the meta text. */
      metaTitle?: string
      selectable?: boolean
      selected?: boolean
      downloaded?: boolean
      downloadDisabled?: boolean
      downloadLabel?: string
      placeholderIcon?: Component
      skeleton?: boolean
    }>(),
    {
      title: '',
      platform: null,
      duration: null,
      meta: () => [],
      selectable: true,
      downloadLabel: 'Download',
      placeholderIcon: () => Video,
    }
  )

  const emit = defineEmits<{
    click: []
    'toggle-select': []
    download: []
  }>()
</script>

<template>
  <div v-if="skeleton" class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface">
    <div class="skeleton aspect-video rounded-none" />
    <div class="flex flex-col gap-2 p-3">
      <div class="skeleton h-3.5 w-4/5" />
      <div class="skeleton h-3 w-1/2" />
    </div>
  </div>

  <article
    v-else
    class="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors"
    :class="selected ? 'border-brand-line shadow-[0_0_0_1px_var(--brand-line)]' : 'border-line-subtle hover:border-line'"
    @click="emit('click')"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-video overflow-hidden bg-surface-sunken">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        alt=""
        loading="lazy"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div v-else class="grid size-full place-items-center text-fg-disabled">
        <component :is="placeholderIcon" class="size-7" />
      </div>

      <!-- Select -->
      <div
        v-if="selectable"
        class="absolute top-2 left-2 grid place-items-center rounded-[5px] bg-black/50 p-0.5 transition-opacity"
        :class="selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'"
        @click.stop
      >
        <Checkbox
          :model-value="selected"
          aria-label="Select"
          @update:model-value="emit('toggle-select')"
        />
      </div>

      <PlatformLogo v-if="platform" :platform="platform" size="sm" class="absolute top-2 right-2" />

      <div class="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
        <Badge v-if="downloaded" variant="success" class="bg-canvas/85">
          <Check />
          Downloaded
        </Badge>
        <span v-else />
        <span
          v-if="duration"
          class="tabular inline-flex h-[18px] items-center gap-1 rounded-md bg-black/75 px-1.5 text-2xs font-medium text-white"
        >
          <Clock class="size-3 opacity-70" />
          {{ duration }}
        </span>
      </div>
    </div>

    <!-- Body -->
    <div class="flex min-w-0 items-start gap-2 px-3 pt-2.5 pb-3">
      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-2 text-sm font-medium leading-5 text-fg" :title="title">{{ title }}</h3>
        <p class="mt-1 truncate text-xs text-fg-muted" :title="metaTitle || meta.filter(Boolean).join(' · ')">
          <template v-for="(item, index) in meta.filter(Boolean)" :key="index">
            <span v-if="index > 0" class="mx-1 text-fg-disabled">·</span>{{ item }}
          </template>
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="-mr-1 shrink-0"
        :disabled="downloadDisabled"
        :title="downloadLabel"
        :aria-label="downloadLabel"
        @click.stop="emit('download')"
      >
        <Download />
      </Button>
    </div>
  </article>
</template>
