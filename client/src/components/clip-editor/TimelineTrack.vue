<template>
  <div
    class="flex items-center h-12 relative group/track border-b border-white/[0.04]"
    :class="{
      'bg-violet-500/10': isDragTarget,
      'h-20': track.type === 'video' /* Taller for video tracks with thumbnails */,
      'h-12': track.type === 'audio',
    }"
    :data-track-id="track.id"
    :data-track-index="track.orderIndex"
  >
    <!-- Track Header/Label -->
    <div
      class="track-label w-[100px] h-full pl-2 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
    >
      <div
        class="flex items-center gap-1 text-white/50 mb-1 opacity-0 group-hover/track:opacity-100 transition-opacity"
      >
        <button
          @click.stop="$emit('toggleLock', track.id)"
          class="p-0.5 hover:text-white"
          :title="track.isLocked ? 'Unlock' : 'Lock'"
          :class="{ 'text-cyan-400': track.isLocked }"
        >
          <component :is="track.isLocked ? 'Lock' : 'Unlock'" :size="12" />
        </button>

        <button
          @click.stop="$emit('toggleVisible', track.id)"
          class="p-0.5 hover:text-white"
          :title="!track.isVisible ? 'Show' : 'Hide'"
          :class="{ 'text-cyan-400': !track.isVisible }"
        >
          <component :is="!track.isVisible ? 'EyeOff' : 'Eye'" :size="12" />
        </button>

        <button
          @click.stop="$emit('toggleMute', track.id)"
          class="p-0.5 hover:text-white"
          :title="track.isMuted ? 'Unmute' : 'Mute'"
          :class="{ 'text-cyan-400': track.isMuted }"
        >
          <component :is="track.isMuted ? 'VolumeX' : 'Volume2'" :size="12" />
        </button>
      </div>
      <span class="text-[11px] text-white/60 truncate" :title="track.name">{{ track.name }}</span>
    </div>

    <!-- Track Content -->
    <div
      class="flex-1 h-full relative overflow-hidden"
      @click="(e) => $emit('trackClick', e, track.id)"
      @dragover.prevent="(e) => $emit('trackDragOver', e, track.id)"
      @drop.prevent="(e) => $emit('trackDrop', e, track.id)"
    >
      <!-- Background grid/guides could go here -->

      <!-- Render Items -->
      <div
        v-for="item in track.items"
        :key="item.id"
        class="absolute top-1 bottom-1 rounded-md overflow-hidden group/item cursor-grab active:cursor-grabbing border border-white/10"
        :class="[getItemClasses(item), { 'ring-2 ring-white/50 z-10': isSelected(item.id) }]"
        :style="getItemStyle(item)"
        @mousedown.stop="(e) => $emit('itemMouseDown', e, item, track.id)"
      >
        <!-- Item Content -->
        <div class="absolute inset-0 flex items-center px-2 overflow-hidden bg-[#1a1a1a]">
          <!-- Background color based on type -->
          <div class="absolute inset-0 opacity-20" :class="getItemColorClass(item)"></div>

          <!-- Label -->
          <span class="relative z-10 text-[10px] font-medium truncate text-white/90 shadow-sm">
            {{ item.name }}
          </span>
        </div>

        <!-- Keyframe Indicators -->
        <div
          v-if="item.keyframes && item.keyframes.length > 0"
          class="absolute inset-x-0 bottom-0 h-3 pointer-events-none"
        >
          <div
            v-for="kf in item.keyframes"
            :key="kf.id"
            class="absolute bottom-0.5 w-2 h-2 bg-white rotate-45 transform -translate-x-1/2 shadow-sm border border-black/20 pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
            :class="{ 'bg-yellow-400': false /* TODO: isSelected */ }"
            :style="{ left: `${getKeyframePercent(kf, item)}%` }"
            @mousedown.stop="$emit('keyframeMouseDown', $event, kf, item)"
            title="Keyframe"
          ></div>
        </div>

        <!-- Resize Handles (only visible on hover/select) -->
        <div
          class="resize-handle-l absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/item:opacity-100 hover:bg-white/20 z-20"
          @mousedown.stop="(e) => $emit('resizeStart', e, item, 'left')"
        ></div>
        <div
          class="resize-handle-r absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/item:opacity-100 hover:bg-white/20 z-20"
          @mousedown.stop="(e) => $emit('resizeStart', e, item, 'right')"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Lock, Unlock, Eye, EyeOff, Volume2, VolumeX } from 'lucide-vue-next';
  import type { Track, TimelineItem, Keyframe } from '@/types/timeline-model';

  const props = defineProps<{
    track: Track;
    duration: number; // Total timeline duration in seconds
    zoomLevel: number; // Pixels per second (or whatever scale factor is used)
    pixelsPerSecond?: number; // Alternative scaling prop if needed
    selectedItemIds: Set<string>;
    isDragTarget?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'toggleLock', trackId: string): void;
    (e: 'toggleVisible', trackId: string): void;
    (e: 'toggleMute', trackId: string): void;
    (e: 'trackClick', event: MouseEvent, trackId: string): void;
    (e: 'trackDragOver', event: DragEvent, trackId: string): void;
    (e: 'trackDrop', event: DragEvent, trackId: string): void;
    (e: 'itemMouseDown', event: MouseEvent, item: TimelineItem, trackId: string): void;
    (e: 'resizeStart', event: MouseEvent, item: TimelineItem, side: 'left' | 'right'): void;
    (e: 'keyframeMouseDown', event: MouseEvent, keyframe: Keyframe, item: TimelineItem): void;
  }>();

  function isSelected(itemId: string) {
    return props.selectedItemIds.has(itemId);
  }

  function getItemStyle(item: TimelineItem) {
    const totalDuration = props.duration || 1;
    const leftPercent = (item.startTime / totalDuration) * 100;
    const widthPercent = (item.duration / totalDuration) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  }

  function getItemColorClass(item: TimelineItem) {
    switch (item.type) {
      case 'video':
        return 'bg-blue-500';
      case 'audio':
        return 'bg-emerald-500';
      case 'text':
        return 'bg-amber-500';
      case 'sticker':
        return 'bg-pink-500';
      case 'effect':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  }

  function getItemClasses(item: TimelineItem) {
    // Add specific classes if needed
    return [];
  }

  function getKeyframePercent(keyframe: Keyframe, item: TimelineItem) {
    if (item.duration <= 0) return 0;
    // Keyframe time is relative to item start
    return (keyframe.time / item.duration) * 100;
  }
</script>
