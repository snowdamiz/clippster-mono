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
          backgroundRepeat: 'no-repeat',
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
          <Video class="h-14 w-14 text-white/60" />
        </div>
        <!-- Hover Overlay -->
        <div
          class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity"
        >
          <button
            class="p-2.5 bg-white/90 hover:bg-white rounded-md transition-colors"
            title="Download"
            @click.stop="downloadClip"
          >
            <Download class="h-5 w-5 text-black" />
          </button>
        </div>
      </div>
    </div>
    <!-- Info -->
    <div
      :class="[
        'px-4 py-3 border-t',
        clip.thumbnailUrl ? 'border-white/10 bg-black/20 backdrop-blur-sm' : 'border-border bg-card',
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
  import { computed } from 'vue';
  import { formatDuration, formatRelativeTime, type PumpFunClip } from '@/services/pumpfun';
  import { Video, Download } from 'lucide-vue-next';

  interface Props {
    clip: PumpFunClip;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    click: [clip: PumpFunClip];
    download: [clip: PumpFunClip];
  }>();

  const formattedDuration = computed(() => formatDuration(props.clip.duration));
  const formattedTime = computed(() => formatRelativeTime(props.clip.createdAt));

  function downloadClip() {
    emit('download', props.clip);
  }
</script>
