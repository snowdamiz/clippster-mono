<template>
  <div class="bg-card border border-border rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group cursor-pointer">
    <!-- Thumbnail -->
    <div class="relative aspect-video bg-muted overflow-hidden">
      <img 
        v-if="clip.thumbnailUrl"
        :src="clip.thumbnailUrl" 
        :alt="clip.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        @error="handleImageError"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      
      <!-- Duration Badge -->
      <div v-if="clip.duration" class="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white">
        {{ formattedDuration }}
      </div>
      
      <!-- Clip Type Badge -->
      <div class="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium" :class="clipTypeBadgeClass">
        {{ clip.clipType === 'COMPLETE' ? 'VOD' : 'Highlight' }}
      </div>
    </div>

    <!-- Content -->
    <div class="p-4">
      <h3 class="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">
        {{ clip.title }}
      </h3>
      
      <div class="flex items-center gap-4 text-xs text-muted-foreground">
        <span v-if="clip.createdAt" class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ formattedTime }}
        </span>
        
        <span v-if="clip.clipId" class="flex items-center gap-1 font-mono">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          {{ truncatedClipId }}
        </span>
      </div>
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
</script>
