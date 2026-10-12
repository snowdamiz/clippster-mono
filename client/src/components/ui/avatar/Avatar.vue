<script setup lang="ts">
  /**
   * Avatar for people, organizations, campaigns and conversations: the image
   * when there is one (falls back if it fails to load), otherwise `icon`,
   * otherwise initials from `name`, on a neutral tile.
   *
   *   <Avatar :src="user.avatar_url" :name="user.name || user.email" size="sm" />
   *   <Avatar :src="org.logo_url" :name="org.name" :icon="Building2" shape="square" size="lg" />
   *   <Avatar :icon="Sparkles" tone="ai" size="sm" />        (assistant mark)
   *   <Avatar :src="url" :name="name" tone="brand">{{ customInitials }}</Avatar>
   *
   * The default slot replaces the icon/initials fallback. `tone="brand"`
   * tints the fallback (messaging, account menu); `tone="ai"` marks the AI
   * assistant. Initials: first + last word (emails use the part before `@`);
   * one letter at `xs`.
   *
   * Dependency-free (no cn()/reka) so the browser app (`apps/web`) can use it
   * too — extra classes are appended through attribute fallthrough, so don't
   * pass classes that fight the built-in size/shape (use `size` instead).
   */
  import type { Component } from 'vue';
  import { computed, ref, watch } from 'vue';

  const props = withDefaults(
    defineProps<{
      src?: string | null;
      name?: string | null;
      /** Shown instead of initials when there is no image. */
      icon?: Component;
      /** xs 20 · sm 28 · md 36 · lg 44 · xl 64 */
      size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
      shape?: 'circle' | 'square';
      tone?: 'neutral' | 'brand' | 'ai';
    }>(),
    { src: null, name: null, size: 'md', shape: 'circle', tone: 'neutral' }
  );

  const failed = ref(false);
  watch(
    () => props.src,
    () => (failed.value = false)
  );
  const showImage = computed(() => !!props.src && !failed.value);

  const initials = computed(() => {
    const raw = (props.name || '').trim();
    const local = /^[^\s@]+@[^\s@]+$/.test(raw) ? raw.slice(0, raw.indexOf('@')) : raw;
    const parts = local.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = Array.from(parts[0])[0] ?? '';
    const last = parts.length > 1 && props.size !== 'xs' ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
    return (first + last).toUpperCase();
  });

  const SIZE = {
    xs: 'size-5 text-[9px] [&_svg]:size-3',
    sm: 'size-7 text-2xs [&_svg]:size-3.5',
    md: 'size-9 text-xs [&_svg]:size-4',
    lg: 'size-11 text-sm [&_svg]:size-5',
    xl: 'size-16 text-lg [&_svg]:size-7',
  } as const;

  const SQUARE_RADIUS = {
    xs: 'rounded-[4px]',
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-[10px]',
    xl: 'rounded-xl',
  } as const;

  const TONE = {
    neutral: 'border border-line-subtle bg-surface-raised text-fg-muted',
    brand: 'bg-brand-soft text-brand',
    ai: 'border border-[var(--ai-line)] bg-ai-soft text-ai',
  } as const;

  const classes = computed(() => [
    'inline-grid shrink-0 select-none place-items-center overflow-hidden font-semibold',
    SIZE[props.size],
    props.shape === 'circle' ? 'rounded-full' : SQUARE_RADIUS[props.size],
    TONE[props.tone],
  ]);
</script>

<template>
  <span :class="classes" :title="name || undefined">
    <img
      v-if="showImage"
      :src="src!"
      :alt="name || ''"
      class="size-full object-cover"
      referrerpolicy="no-referrer"
      draggable="false"
      @error="failed = true"
    />
    <slot v-else>
      <component :is="icon" v-if="icon" :class="tone === 'neutral' ? 'text-fg-subtle' : undefined" aria-hidden="true" />
      <span v-else class="leading-none">{{ initials || '?' }}</span>
    </slot>
  </span>
</template>
