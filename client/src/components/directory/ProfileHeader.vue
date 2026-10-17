<script setup lang="ts">
  /**
   * Identity block at the top of profile / detail pages (clipper, organization,
   * campaign): avatar, name with status badges, a muted subtitle, a meta row
   * and tags. Flat — it sits on the panel, no card, banner or gradient. Same
   * proportions as the "My profile" header (40px avatar, 15px name).
   *
   *   <ProfileHeader :name="org.name" :avatar="org.logo_url" shape="square" :subtitle="org.description"
   *     class="border-b border-line-subtle pb-4">
   *     <template #badges><Badge variant="success">Hiring</Badge></template>
   *     <template #meta>...</template>
   *     <Badge v-for="tag in tags">{{ tag }}</Badge>
   *     <template #aside><StatGrid size="sm" :items="stats" class="w-full max-w-[440px] shrink-0 self-center" /></template>
   *   </ProfileHeader>
   *
   * `aside` sits to the right of the identity block (key figures) and wraps
   * under it on narrow windows; `actions` sit at the end of the identity row.
   */
  import type { Component } from 'vue';
  import { Check } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';

  defineProps<{
    name: string;
    avatar?: string | null;
    avatarIcon?: Component;
    shape?: 'circle' | 'square';
    subtitle?: string | null;
    verified?: boolean;
  }>();
</script>

<template>
  <section class="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-4">
    <div class="flex min-w-0 flex-[1_1_360px] items-start gap-4">
      <div class="relative shrink-0">
        <Avatar :src="avatar" :name="name" :icon="avatarIcon" size="lg" :shape="shape ?? 'circle'" />
        <span
          v-if="verified"
          class="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-brand text-brand-fg ring-2 ring-panel"
          title="Verified"
        >
          <Check class="size-3" :stroke-width="3" />
        </span>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h2 class="min-w-0 truncate text-base font-semibold text-fg">{{ name }}</h2>
          <slot name="badges" />
        </div>
        <div v-if="$slots.meta" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <slot name="meta" />
        </div>
        <p v-if="subtitle" class="max-w-[640px] whitespace-pre-line text-sm text-fg-muted">{{ subtitle }}</p>
        <div v-if="$slots.default" class="flex flex-wrap items-center gap-1">
          <slot />
        </div>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot name="aside" />
  </section>
</template>
