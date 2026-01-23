<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-2 pb-3 border-b border-white/10 text-amber-400">
      <Type :size="18" />
      <h4 class="text-sm font-semibold text-zinc-100 m-0">Text Overlay</h4>
    </div>

    <!-- Text Content -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Text</label>
      <textarea
        :value="textOverlay.text"
        class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 resize-y font-inherit focus:border-amber-400/50 focus:bg-white/[0.08]"
        placeholder="Enter text..."
        rows="3"
        @input="updateProperty('text', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Font Settings -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Font Family</label>
      <select
        :value="style.fontFamily"
        class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
        @change="handleStyleUpdate('fontFamily', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="font in fontFamilies" :key="font.value" :value="font.value">
          {{ font.label }}
        </option>
      </select>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Size</label>
        <input
          :value="style.fontSize"
          type="number"
          :min="constraints.fontSize.min"
          :max="constraints.fontSize.max"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
          @input="handleStyleUpdate('fontSize', parseInt(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Weight</label>
        <select
          :value="style.fontWeight"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
          @change="handleStyleUpdate('fontWeight', parseInt(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="weight in fontWeights" :key="weight.value" :value="weight.value">
            {{ weight.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Color Settings -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Text Color</label>
      <input
        :value="style.color"
        type="color"
        class="w-full h-10 p-1 bg-white/[0.05] border border-white/10 rounded-lg cursor-pointer"
        @input="handleStyleUpdate('color', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Position -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">X Position (%)</label>
        <input
          :value="textOverlay.position_x"
          type="number"
          :min="constraints.position.min"
          :max="constraints.position.max"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
          @input="updateProperty('position_x', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Y Position (%)</label>
        <input
          :value="textOverlay.position_y"
          type="number"
          :min="constraints.position.min"
          :max="constraints.position.max"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
          @input="updateProperty('position_y', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Animation -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Animation</label>
      <select
        :value="textOverlay.animation"
        class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
        @change="updateProperty('animation', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="anim in textAnimations" :key="anim.value" :value="anim.value">
          {{ anim.label }}
        </option>
      </select>
    </div>

    <!-- Time Range -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Start (s)</label>
        <input
          :value="textOverlay.start_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
          @input="updateProperty('start_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">End (s)</label>
        <input
          :value="textOverlay.end_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-amber-400/50 focus:bg-white/[0.08]"
          @input="updateProperty('end_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Delete Button -->
    <div class="flex flex-col gap-2">
      <button
        class="flex items-center justify-center gap-2 px-2.5 py-2.5 bg-red-500/[0.15] border border-red-500/30 rounded-lg text-red-400 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-red-500/[0.25] hover:border-red-500/50"
        @click="$emit('delete')"
      >
        <Trash2 :size="16" />
        <span>Delete Text</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, toRef } from 'vue';
  import { Type, Trash2 } from 'lucide-vue-next';
  import type { VideoEditorTextOverlayRecord } from '@/services/database/video-editor-edits';
  import {
    useTextInspectorLogic,
    mergeStyle,
    serializeStyle,
    type TextStyle,
  } from '@/composables/clip-editor';

  const props = defineProps<{
    textOverlay: VideoEditorTextOverlayRecord;
  }>();

  const emit = defineEmits<{
    (e: 'update', property: string, value: any): void;
    (e: 'delete'): void;
  }>();

  // Use composable for style parsing and constants
  const styleDataRef = computed(() => props.textOverlay.style_data);
  const { style, fontFamilies, fontWeights, textAnimations, constraints } = useTextInspectorLogic({
    styleData: styleDataRef,
  });

  function updateProperty(property: string, value: any) {
    emit('update', property, value);
  }

  function handleStyleUpdate(property: keyof TextStyle, value: any) {
    const newStyle = mergeStyle(style.value, property, value);
    emit('update', 'style_data', serializeStyle(newStyle));
  }
</script>
