<script setup lang="ts">
  /**
   * Identity header for admin detail pages (user, affiliate, organization):
   * optional back link, avatar (image → initials → icon), title with inline
   * badges, a one-line subtitle, a meta row, key figures (`stats`, a
   * frameless `StatGrid size="sm"`) and right-aligned actions. Sits directly
   * on the page panel — no card — with a hairline below it (the PageLayout
   * header still holds the breadcrumb title).
   *
   *   <AdminDetailHeader
   *     :title="user.name"
   *     :subtitle="user.email"
   *     :avatar-url="user.avatar"
   *     :icon="User"
   *     back-to="/admin/users"
   *     back-label="All users"
   *     :stats="[{ label: 'Credits', value: '1,240 min' }, { label: 'Used', value: '560 min' }]"
   *   >
   *     <template #badges><Badge variant="brand">Pro</Badge></template>
   *     <template #meta>
   *       <span>Joined 3 months ago</span>
   *       <span>Last active 2h ago</span>
   *     </template>
   *     <template #actions><Button size="sm">Edit</Button></template>
   *   </AdminDetailHeader>
   *
   * Items in `#meta` are separated with a dot automatically.
   */
  import type { Component, HTMLAttributes } from 'vue';
  import { ArrowLeft } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';
  import { buttonVariants } from '@/components/ui/button';
  import { StatGrid, type StatItem } from '@/components/ui/stat-card';
  import { cn } from '@/lib/utils';

  const props = withDefaults(
    defineProps<{
      title: string;
      subtitle?: string | null;
      avatarUrl?: string | null;
      /** Fallback icon when there is no avatar image (initials are used when omitted). */
      icon?: Component;
      avatarShape?: 'circle' | 'square';
      backTo?: string;
      backLabel?: string;
      /** Key figures shown beside the identity (frameless `StatGrid size="sm"`). */
      stats?: StatItem[];
      class?: HTMLAttributes['class'];
    }>(),
    { avatarShape: 'circle', backLabel: 'Back' }
  );
</script>

<template>
  <header :class="cn('flex min-w-0 flex-col gap-3 border-b border-line-subtle pb-4', props.class)">
    <router-link
      v-if="backTo"
      :to="backTo"
      :class="cn(buttonVariants({ variant: 'ghost', size: 'xs' }), '-ml-2 self-start text-fg-muted')"
    >
      <ArrowLeft />
      {{ backLabel }}
    </router-link>

    <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
      <div class="flex min-w-[min(100%,320px)] flex-1 items-center gap-3.5">
        <slot name="avatar">
          <Avatar :src="avatarUrl" :name="title" :icon="icon" :shape="avatarShape" size="lg" />
        </slot>

        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 class="truncate text-base font-semibold tracking-[-0.01em] text-fg">{{ title }}</h2>
            <slot name="badges" />
          </div>
          <p v-if="subtitle || $slots.subtitle" class="mt-0.5 truncate text-sm text-fg-muted">
            <slot name="subtitle">{{ subtitle }}</slot>
          </p>
          <div
            v-if="$slots.meta"
            class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle [&>*:not(:first-child)]:before:mr-2 [&>*:not(:first-child)]:before:content-['·']"
          >
            <slot name="meta" />
          </div>
        </div>
      </div>

      <!-- Figures and actions wrap together under the identity on narrow windows.
           ~120px per figure so two or three figures don't stretch. -->
      <div v-if="stats?.length || $slots.actions" class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <StatGrid
          v-if="stats?.length"
          size="sm"
          :items="stats"
          class="max-w-full"
          :style="{ width: `${stats.length * 120}px` }"
        />
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </header>
</template>
