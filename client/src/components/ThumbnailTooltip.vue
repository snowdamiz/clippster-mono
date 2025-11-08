<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed z-50 pointer-events-none"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
      }"
    >
      <div class="bg-black/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl p-2 mb-2">
        <!-- Thumbnail Image -->
        <div class="relative min-w-[200px] min-h-[112px]">
          <div v-if="loading" class="w-[200px] h-[112px] bg-muted/50 rounded-md flex items-center justify-center">
            <div class="flex flex-col items-center gap-2">
              <svg
                class="animate-spin h-6 w-6 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span class="text-xs text-muted-foreground">Loading...</span>
            </div>
          </div>
          <img
            v-else-if="thumbnailUrl && !hasError"
            :src="thumbnailUrl"
            alt="Video thumbnail"
            class="w-[200px] h-[112px] object-cover rounded-md"
          />
          <div v-else class="w-[200px] h-[112px] bg-muted/50 rounded-md flex items-center justify-center">
            <div class="text-center" :class="hasError ? 'text-red-400/60' : 'text-muted-foreground/40'">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8 mx-auto mb-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p class="text-xs">{{ hasError ? 'Failed to load' : 'No thumbnail' }}</p>
            </div>
          </div>
        </div>

        <!-- Time Display -->
        <div class="mt-2 text-center">
          <span class="text-white text-sm font-medium">
            {{ formattedTime }}
          </span>
        </div>
      </div>

      <!-- Arrow pointer -->
      <div class="relative">
        <div
          class="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black/95"
        ></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  interface Props {
    show: boolean;
    position: { x: number; y: number };
    thumbnailUrl: string | null;
    time: number;
    loading: boolean;
    hasError?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    hasError: false,
  });

  // Format time for display
  const formattedTime = computed(() => {
    const h = Math.floor(props.time / 3600);
    const m = Math.floor((props.time % 3600) / 60);
    const s = Math.floor(props.time % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  });
</script>

<style scoped>
  /* Ensure smooth transitions */
  .fixed {
    transition: none;
  }
</style>
