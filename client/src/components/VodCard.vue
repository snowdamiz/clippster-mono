<template>
  <div class="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 cursor-pointer">
    <!-- Thumbnail -->
    <div class="aspect-video bg-muted/50 relative">
      <img
        v-if="clip.thumbnailUrl && !imageError"
        :src="clip.thumbnailUrl"
        :alt="clip.title"
        class="w-full h-full object-cover"
        @error="handleImageError"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- Duration Badge -->
      <div v-if="clip.duration" class="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded-md backdrop-blur-sm">
        {{ formattedDuration }}
      </div>

      <!-- Clip Type Badge -->
      <div class="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium" :class="clipTypeBadgeClass">
        {{ clip.clipType === 'COMPLETE' ? 'VOD' : 'Highlight' }}
      </div>

      <!-- Hover Overlay -->
      <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
        <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Download" @click.stop="downloadClip">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="p-4">
      <h4 class="font-semibold text-foreground truncate mb-1">{{ clip.title }}</h4>
      <p class="text-xs text-muted-foreground mb-2" v-if="clip.duration">Duration: {{ Math.round(clip.duration) }}s</p>
      <p class="text-xs text-muted-foreground" v-if="clip.createdAt">Added {{ formattedTime }}</p>
      <p class="text-xs text-muted-foreground" v-else>Clip ID: {{ truncatedClipId }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDuration, formatRelativeTime, type PumpFunClip } from '@/services/pumpfun'

interface Props {
  clip: PumpFunClip
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: [clip: PumpFunClip]
  download: [clip: PumpFunClip]
}>()

const imageError = ref(false)

const formattedDuration = computed(() => formatDuration(props.clip.duration))
const formattedTime = computed(() => formatRelativeTime(props.clip.createdAt))

const truncatedClipId = computed(() => {
  const id = props.clip.clipId
  if (!id) return ''
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}...${id.slice(-4)}`
})

const clipTypeBadgeClass = computed(() => {
  return props.clip.clipType === 'COMPLETE'
    ? 'bg-purple-500/80 text-white'
    : 'bg-indigo-500/80 text-white'
})

function handleImageError() {
  imageError.value = true
}

function downloadClip() {
  emit('download', props.clip)
}
</script>
