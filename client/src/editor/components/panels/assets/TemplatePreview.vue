<script setup lang="ts">
import { computed } from 'vue';
import { templatePreviewLook, type TemplateManifest } from '@clippster/template-schema';

const props = defineProps<{
  manifest: TemplateManifest;
  featured?: boolean;
}>();

const look = computed(() => templatePreviewLook(props.manifest));

const titleClass = computed(() => {
  const style = look.value.titleStyle;
  if (style === 'bold' || style === 'neon') return 'font-black tracking-wide uppercase';
  if (style === 'documentary') return 'font-semibold uppercase tracking-[0.18em]';
  if (style === 'label') return 'rounded-sm px-1 font-bold uppercase';
  return 'font-semibold';
});

const titleTop = computed(() => {
  if (look.value.titlePosition === 'top') return '12%';
  if (look.value.titlePosition === 'bottom') return '72%';
  return '42%';
});
</script>

<template>
  <div
    class="relative overflow-hidden bg-zinc-950"
    :class="featured ? 'aspect-video' : 'aspect-[4/3]'"
    :style="{ background: `linear-gradient(160deg, ${look.gradientFrom}, ${look.gradientTo})` }"
  >
    <div
      class="absolute inset-0 opacity-80"
      :style="{ filter: look.cssFilter }"
    >
      <div
        class="absolute left-1/2 top-[18%] h-[38%] w-[34%] -translate-x-1/2 rounded-full"
        :style="{ background: `${look.accentColor}33` }"
      />
      <div class="absolute inset-x-[18%] bottom-[22%] h-[28%] rounded-t-[40%] bg-black/35" />
      <div
        v-if="look.plateCount > 1"
        class="absolute inset-x-1.5 bottom-1.5 flex h-2.5 gap-0.5"
      >
        <span
          v-for="index in look.plateCount"
          :key="index"
          class="h-full flex-1 rounded-[2px] bg-white/25"
          :style="{ opacity: 0.35 + index * 0.12 }"
        />
      </div>
    </div>
    <div
      v-if="look.effectLabel === 'Vignette'"
      class="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_12px_rgba(0,0,0,0.55)]"
    />
    <div
      class="absolute inset-x-1 text-center text-white drop-shadow"
      :class="titleClass"
      :style="{
        top: titleTop,
        fontSize: featured ? '11px' : '8px',
        backgroundColor: look.titleStyle === 'label' ? look.accentColor : undefined,
      }"
    >
      {{ look.titleText }}
    </div>
    <div
      class="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded bg-black/55 px-1 py-0.5 text-[8px] text-white/90"
    >
      {{ look.actionLabel }}
    </div>
  </div>
</template>
