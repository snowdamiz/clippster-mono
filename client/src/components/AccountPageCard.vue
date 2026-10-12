<script setup lang="ts">
  /**
   * Centered card for standalone account pages that open from email links
   * (reset password, email change verification, organization invitation).
   * Fills whatever container the router renders it in and mirrors the Modal
   * header/body/footer layout.
   *
   *   <AccountPageCard title="Email verified" :icon="CheckCircle" tone="success" description="...">
   *     ...body...
   *     <template #footer><Button variant="primary">Continue</Button></template>
   *   </AccountPageCard>
   */
  import type { Component } from 'vue';
  import type { IconTileVariants } from '@/components/ui/icon-tile';
  import { Loader2 } from 'lucide-vue-next';
  import { IconTile } from '@/components/ui/icon-tile';

  withDefaults(
    defineProps<{
      title?: string;
      description?: string;
      icon?: Component;
      tone?: IconTileVariants['tone'];
      /** Replaces the card content with a spinner row. */
      loading?: boolean;
      loadingText?: string;
    }>(),
    { tone: 'neutral', loading: false, loadingText: 'Loading…' }
  );
</script>

<template>
  <div class="flex min-h-full w-full items-center justify-center px-5 py-10">
    <div class="flex w-full max-w-[420px] flex-col items-center gap-6">
      <div class="flex items-center gap-2.5">
        <img src="/logo-titlebar.svg" alt="" class="size-8 rounded-[9px]" />
        <img src="/logo.svg" alt="Clippster" class="h-6 w-auto brightness-0 invert" />
      </div>

      <!-- Each page state renders its own card, so it eases in; the spinner waits out fast loads. -->
      <section
        class="w-full overflow-hidden rounded-xl border border-line-subtle bg-surface"
        :class="loading ? 'skeleton-group' : 'animate-enter'"
      >
        <div v-if="loading" class="flex items-center gap-3 px-5 py-5 text-sm text-fg-muted" role="status">
          <Loader2 class="size-4 animate-spin text-brand" />
          {{ loadingText }}
        </div>

        <template v-else>
          <header class="flex items-start gap-3 px-5 pt-5" :class="{ 'pb-5': !$slots.default && !$slots.footer }">
            <slot name="media">
              <IconTile v-if="icon" :icon="icon" :tone="tone" size="md" class="mt-0.5" />
            </slot>
            <div class="min-w-0 flex-1">
              <h1 class="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-fg">{{ title }}</h1>
              <p v-if="description || $slots.description" class="mt-0.5 text-sm text-fg-muted">
                <slot name="description">{{ description }}</slot>
              </p>
            </div>
          </header>

          <div v-if="$slots.default" class="px-5 pt-4 pb-5">
            <slot />
          </div>
          <div v-else-if="$slots.footer" class="pb-5" />

          <footer
            v-if="$slots.footer"
            class="flex items-center justify-end gap-2 border-t border-line-subtle bg-surface-sunken/40 px-5 py-3"
          >
            <slot name="footer" />
          </footer>
        </template>
      </section>

      <slot name="after" />
    </div>
  </div>
</template>
