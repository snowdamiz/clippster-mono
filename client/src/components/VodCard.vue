<template>
  <div
    class="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 cursor-pointer"
  >
    <!-- Thumbnail with vignette background -->
    <div class="aspect-video bg-muted/50 relative">
      <!-- Thumbnail background with vignette -->
      <div
        v-if="clip.thumbnailUrl"
        class="absolute inset-0 z-0"
        :style="{
          backgroundImage: `url(${clip.thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }"
      >
        <!-- Dark vignette overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/80"></div>
      </div>
      <!-- Content overlay -->
      <div class="relative z-10 h-full flex flex-col">
        <!-- Duration Badge -->
        <div
          v-if="clip.duration"
          class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm"
        >
          {{ formattedDuration }}
        </div>
        <!-- Center placeholder if no thumbnail -->
        <div v-if="!clip.thumbnailUrl" class="flex-1 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-14 w-14 text-white/60"
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
        </div>
        <!-- Hover Overlay -->
        <div
          class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity"
        >
          <button
            class="p-2.5 bg-white/90 hover:bg-white rounded-lg transition-colors"
            title="Download"
            @click.stop="downloadClip"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <!-- Info -->
    <div
      :class="[
        'px-4 py-3 border-t',
        clip.thumbnailUrl ? 'border-white/10 bg-black/20 backdrop-blur-sm' : 'border-border bg-card'
      ]"
    >
      <h4 :class="['font-semibold truncate mb-1', clip.thumbnailUrl ? 'text-white' : 'text-foreground']">
        {{ clip.title }}
      </h4>

      <p :class="['text-xs mb-2', clip.thumbnailUrl ? 'text-white/80' : 'text-muted-foreground']">
        Added {{ formattedTime }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { formatDuration, formatRelativeTime, type PumpFunClip } from '@/services/pumpfun'

  interface Props {
    clip: PumpFunClip
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    click: [clip: PumpFunClip]
    download: [clip: PumpFunClip]
  }>()

  const formattedDuration = computed(() => formatDuration(props.clip.duration))
  const formattedTime = computed(() => formatRelativeTime(props.clip.createdAt))

  function downloadClip() {
    emit('download', props.clip)
  }
</script>
