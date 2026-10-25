<script setup lang="ts">
  /**
   * Card for a monitored channel on the Live streams page (also used for the
   * tour's demo streamer): identity, status and watch action in the header,
   * an overflow menu and a footer row for settings/recording actions.
   */
  import { PlatformLogo, platformLabel } from '@/components/ui/platform-logo'

  withDefaults(
    defineProps<{
      name: string
      platform: string
      avatarUrl?: string | null
      /** Highlight while recording / detecting. */
      active?: boolean
    }>(),
    { avatarUrl: null, active: false }
  )
</script>

<template>
  <div
    class="flex min-w-0 flex-col rounded-xl border bg-surface transition-colors"
    :class="active ? 'border-brand-line' : 'border-line-subtle hover:border-line'"
  >
    <div class="flex min-w-0 items-start gap-3 px-3.5 py-2.5">
      <span class="relative mt-0.5 shrink-0">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt=""
          class="size-8 rounded-full bg-surface-sunken object-cover"
        />
        <PlatformLogo v-else :platform="platform" size="lg" shape="circle" />
        <PlatformLogo
          v-if="avatarUrl"
          :platform="platform"
          size="xs"
          shape="circle"
          class="absolute -right-0.5 -bottom-0.5 ring-2 ring-[var(--surface)]"
        />
      </span>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-fg" :title="name">{{ name }}</p>
        <div class="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          <span class="truncate">{{ platformLabel(platform) }}</span>
          <slot name="meta" />
        </div>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <slot name="status" />
          <slot name="header-actions" />
        </div>
      </div>

      <div class="flex shrink-0 items-center">
        <slot name="menu" />
      </div>
    </div>

    <div class="flex min-h-10 min-w-0 items-center gap-2 border-t border-line-subtle px-3.5 py-1.5">
      <slot name="footer-start" />
      <div class="ml-auto flex shrink-0 items-center gap-1.5">
        <slot name="footer-end" />
      </div>
    </div>
  </div>
</template>
