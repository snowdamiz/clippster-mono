<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-zinc-100 m-0">Intro & Outro</h3>
    </div>

    <!-- Intro Section -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-sm font-semibold text-white/90 pb-2 border-b border-white/10">
        <Video :size="16" />
        <span>Intro Video</span>
      </div>

      <div v-if="creatorDefaultIntro" class="flex flex-col gap-3 p-3 bg-white/3 border border-white/8 rounded-md">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-10 h-10 bg-indigo-500/20 border border-indigo-500/30 rounded-md text-indigo-400"
          >
            <Video :size="20" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <span class="text-sm font-medium text-zinc-100">{{ creatorDefaultIntro.name }}</span>
            <span class="text-xs text-white/50 tabular-nums">
              {{ formatDuration(creatorDefaultIntro.duration || 0) }}
            </span>
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-white/90 cursor-pointer">
          <input v-model="introEnabled" type="checkbox" class="w-[18px] h-[18px] cursor-pointer" />
          <span>Use Intro</span>
        </label>
      </div>

      <div
        v-else
        class="p-4 bg-white/2 border border-dashed border-white/10 rounded-md text-center text-xs text-white/50"
      >
        <p class="m-0">No intro video configured in creator profile</p>
      </div>
    </div>

    <!-- Outro Section -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-sm font-semibold text-white/90 pb-2 border-b border-white/10">
        <Video :size="16" />
        <span>Outro Video</span>
      </div>

      <div v-if="creatorDefaultOutro" class="flex flex-col gap-3 p-3 bg-white/3 border border-white/8 rounded-md">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-10 h-10 bg-indigo-500/20 border border-indigo-500/30 rounded-md text-indigo-400"
          >
            <Video :size="20" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <span class="text-sm font-medium text-zinc-100">{{ creatorDefaultOutro.name }}</span>
            <span class="text-xs text-white/50 tabular-nums">
              {{ formatDuration(creatorDefaultOutro.duration || 0) }}
            </span>
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-white/90 cursor-pointer">
          <input v-model="outroEnabled" type="checkbox" class="w-[18px] h-[18px] cursor-pointer" />
          <span>Use Outro</span>
        </label>
      </div>

      <div
        v-else
        class="p-4 bg-white/2 border border-dashed border-white/10 rounded-md text-center text-xs text-white/50"
      >
        <p class="m-0">No outro video configured in creator profile</p>
      </div>
    </div>

    <!-- Info -->
    <div class="flex gap-2 p-3 bg-white/3 border border-white/8 rounded-md text-xs text-white/60 leading-6">
      <Info :size="14" />
      <p class="m-0">Intro and outro videos are automatically added from your creator profile settings.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Video, Info } from 'lucide-vue-next';
  import type { IntroOutroRef } from '@/types';

  const props = defineProps<{
    creatorDefaultIntro: IntroOutroRef | null;
    creatorDefaultOutro: IntroOutroRef | null;
  }>();

  const emit = defineEmits<{
    (e: 'introToggled', enabled: boolean): void;
    (e: 'outroToggled', enabled: boolean): void;
  }>();

  const introEnabled = ref(!!props.creatorDefaultIntro);
  const outroEnabled = ref(!!props.creatorDefaultOutro);

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>
