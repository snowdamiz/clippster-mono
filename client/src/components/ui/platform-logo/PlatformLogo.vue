<script setup lang="ts">
  /**
   * A platform's logo on its brand-colored tile (Kick green, Twitch purple,
   * YouTube red, ...). The one way to show "which platform is this" — in
   * section headers, avatars, inputs, chips, result cards, directory and
   * clipper-profile lists and the video library. Never write another
   * platform icon component.
   *
   *   <PlatformLogo platform="kick" size="sm" />
   *   <PlatformLogo :platform="streamer.platform" size="lg" shape="circle" />
   *
   * Known: kick, twitch, youtube, rumble, x/twitter, pumpfun, tokend,
   * tiktok (+ tiktok_business), instagram, facebook, snapchat and `manual`
   * (local uploads, neutral tile) — any casing. Unknown platforms fall back
   * to a neutral tile with the name's initial (or a globe when empty).
   *
   * Brand colors are platform identity, not UI chrome, so they are allowed
   * here (see DESIGN_SYSTEM.md).
   *
   * Dependency-free (no cn()/reka) so the browser app can use it too — extra
   * classes are appended through attribute fallthrough, so don't pass classes
   * that fight the built-in size/shape/position (use `size` instead).
   */
  import { computed } from 'vue';
  import { Facebook, Ghost, Globe, Instagram, Monitor } from 'lucide-vue-next';
  import { normalizePlatform, platformLabel, platformLogoSrc } from './platforms';

  const props = withDefaults(
    defineProps<{
      platform?: string | null;
      /** xs 16 · sm 20 · md 24 · lg 32 · xl 40 */
      size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
      shape?: 'rounded' | 'circle';
    }>(),
    { platform: null, size: 'sm', shape: 'rounded' }
  );

  const key = computed(() => normalizePlatform(props.platform));
  const src = computed(() => platformLogoSrc(props.platform));
  const label = computed(() => platformLabel(props.platform));
  const GLYPHS = { instagram: Instagram, facebook: Facebook, snapchat: Ghost, manual: Monitor } as const;
  const glyph = computed(() => (key.value && key.value in GLYPHS ? GLYPHS[key.value as keyof typeof GLYPHS] : null));
  const initial = computed(() => (props.platform || '').trim().charAt(0).toUpperCase());

  const SIZE = {
    xs: 'size-4 text-[8px]',
    sm: 'size-5 text-[10px]',
    md: 'size-6 text-[11px]',
    lg: 'size-8 text-xs',
    xl: 'size-10 text-sm',
  } as const;
  const RADIUS = {
    xs: 'rounded-[4px]',
    sm: 'rounded-[5px]',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-[10px]',
  } as const;

  const classes = computed(() => [
    'platform-logo inline-grid shrink-0 place-items-center overflow-hidden font-semibold leading-none',
    SIZE[props.size],
    props.shape === 'circle' ? 'rounded-full' : RADIUS[props.size],
    key.value ? `platform-logo--${key.value}` : 'platform-logo--unknown',
  ]);
</script>

<template>
  <span :class="classes" :title="label || undefined" role="img" :aria-label="label || 'Platform'">
    <img v-if="src" :src="src" alt="" class="platform-logo__glyph" draggable="false" />
    <component :is="glyph" v-else-if="glyph" class="platform-logo__icon" :stroke-width="2.25" />
    <span v-else-if="initial" class="text-fg-muted">{{ initial }}</span>
    <Globe v-else class="platform-logo__icon text-fg-subtle" />
  </span>
</template>

<style scoped>
  .platform-logo {
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .platform-logo__glyph {
    width: 62%;
    height: 62%;
    object-fit: contain;
    /* Most source glyphs are black — render them white on the brand tile. */
    filter: brightness(0) invert(1);
  }
  .platform-logo__icon {
    width: 62%;
    height: 62%;
    color: #fff;
  }

  .platform-logo--kick {
    background: #53fc18;
    box-shadow: none;
  }
  .platform-logo--kick .platform-logo__glyph {
    width: 78%;
    filter: brightness(0);
  }
  .platform-logo--twitch {
    background: #9146ff;
    box-shadow: none;
  }
  .platform-logo--youtube {
    background: #e62117;
    box-shadow: none;
  }
  .platform-logo--rumble {
    background: #85c742;
    box-shadow: none;
  }
  .platform-logo--x,
  .platform-logo--tiktok {
    background: #000;
  }
  .platform-logo--x .platform-logo__glyph {
    width: 52%;
    height: 52%;
  }
  .platform-logo--pumpfun {
    background: #10b981;
    box-shadow: none;
  }
  .platform-logo--instagram {
    /* Instagram's brand mark is its gradient. */
    background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285aeb 90%);
    box-shadow: none;
  }
  .platform-logo--facebook {
    background: #1877f2;
    box-shadow: none;
  }
  .platform-logo--snapchat {
    background: #fffc00;
    box-shadow: none;
  }
  .platform-logo--snapchat .platform-logo__icon {
    color: #000;
  }
  /* Local uploads: neutral tile, muted glyph. */
  .platform-logo--manual .platform-logo__icon {
    color: var(--fg-muted);
  }
  .platform-logo--tokend {
    background: #000;
  }
  .platform-logo--tokend .platform-logo__glyph {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: none;
  }
</style>
