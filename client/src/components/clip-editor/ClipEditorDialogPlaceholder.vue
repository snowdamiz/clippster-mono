<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div class="bg-zinc-900 border border-white/10 rounded-xl p-8 max-w-md text-center">
        <h2 class="text-xl font-semibold text-white mb-2">Editor Removed</h2>
        <p class="text-zinc-400 mb-4">The clip editor is being rebuilt from scratch.</p>
        <button @click="close" class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
          Close
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  clipId?: string;
  videoSrc?: string | null;
  clipStartTime?: number;
  clipEndTime?: number;
  clipTitle?: string;
  clipSegments?: any[];
  creatorProfileWatermarkSettings?: any;
  editorMode?: boolean;
  editorProjectId?: string | null;
  editorProjectName?: string;
  creatorWatermarkId?: string | null;
  creatorWatermarkSettings?: string | null;
  creatorDefaultIntro?: any;
  creatorDefaultOutro?: any;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', clipId: string): void;
  (e: 'editorSave', projectId: string): void;
}>();

function close() {
  emit('update:modelValue', false);
}
</script>


