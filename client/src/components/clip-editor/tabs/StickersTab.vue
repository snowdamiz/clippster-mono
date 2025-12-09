<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Stickers & Emojis</h3>
      <p class="text-xs text-white/50 mb-4">Add emojis, stickers, and images to your clip.</p>
    </div>

    <!-- Emoji Picker -->
    <div>
      <h4 class="text-sm font-medium text-white mb-3">Popular Emojis</h4>
      <div class="grid grid-cols-8 gap-1">
        <button
          v-for="emoji in popularEmojis"
          :key="emoji"
          @click="emit('addSticker', emoji, 'emoji')"
          class="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-lg transition-colors"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <!-- Upload Custom -->
    <div>
      <h4 class="text-sm font-medium text-white mb-3">Custom Sticker</h4>
      <button
        @click="fileInputRef?.click()"
        class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
      >
        <Upload :size="16" />
        Upload Image
      </button>
      <input ref="fileInputRef" type="file" accept="image/*,.gif" class="hidden" @change="onFileSelected" />
    </div>

    <!-- Stickers List -->
    <div v-if="stickers.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-white">Your Stickers</h4>

      <div v-for="sticker in stickers" :key="sticker.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 flex items-center justify-center bg-white/5 rounded">
              <span v-if="sticker.stickerType === 'emoji'" class="text-2xl">
                {{ sticker.stickerPath }}
              </span>
              <img v-else :src="sticker.stickerPath" class="w-full h-full object-contain" alt="Sticker" />
            </div>
            <div>
              <div class="text-sm text-white">
                {{ sticker.stickerType === 'emoji' ? 'Emoji' : 'Sticker' }}
              </div>
              <div class="text-xs text-white/50">
                {{ formatTime(sticker.startTime) }} - {{ formatTime(sticker.endTime) }}
              </div>
            </div>
          </div>
          <button @click="emit('deleteSticker', sticker.id)" class="p-1.5 rounded hover:bg-white/10 transition-colors">
            <Trash2 :size="14" class="text-red-400" />
          </button>
        </div>

        <!-- Timing -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Start</label>
            <input
              type="number"
              :value="sticker.startTime"
              @input="(e) => updateSticker(sticker.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              min="0"
              :max="duration"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">End</label>
            <input
              type="number"
              :value="sticker.endTime"
              @input="(e) => updateSticker(sticker.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              :min="sticker.startTime"
              :max="duration"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
          </div>
        </div>

        <!-- Position -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">X Position (%)</label>
            <input
              type="range"
              :value="sticker.position.x"
              @input="(e) => updatePosition(sticker.id, 'x', parseFloat((e.target as HTMLInputElement).value))"
              min="0"
              max="100"
              class="w-full accent-violet-500"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">Y Position (%)</label>
            <input
              type="range"
              :value="sticker.position.y"
              @input="(e) => updatePosition(sticker.id, 'y', parseFloat((e.target as HTMLInputElement).value))"
              min="0"
              max="100"
              class="w-full accent-violet-500"
            />
          </div>
        </div>

        <!-- Scale & Rotation -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Scale ({{ sticker.scale.toFixed(1) }}x)</label>
            <input
              type="range"
              :value="sticker.scale"
              @input="(e) => updateSticker(sticker.id, 'scale', parseFloat((e.target as HTMLInputElement).value))"
              min="0.1"
              max="3"
              step="0.1"
              class="w-full accent-violet-500"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">Rotation ({{ sticker.rotation }}°)</label>
            <input
              type="range"
              :value="sticker.rotation"
              @input="(e) => updateSticker(sticker.id, 'rotation', parseFloat((e.target as HTMLInputElement).value))"
              min="-180"
              max="180"
              step="1"
              class="w-full accent-violet-500"
            />
          </div>
        </div>

        <!-- Animation -->
        <div>
          <label class="block text-xs text-white/60 mb-1">Animation</label>
          <select
            :value="sticker.animation"
            @change="(e) => updateSticker(sticker.id, 'animation', (e.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
          >
            <option value="none">None</option>
            <option value="bounce">Bounce</option>
            <option value="spin">Spin</option>
            <option value="pulse">Pulse</option>
            <option value="shake">Shake</option>
            <option value="float">Float</option>
            <option value="fade">Fade</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Upload, Trash2 } from 'lucide-vue-next';
  import type { Sticker } from '@/types';

  const props = defineProps<{
    stickers: Sticker[];
    currentTime: number;
    duration: number;
  }>();

  const emit = defineEmits<{
    (e: 'addSticker', stickerPath: string, type: 'emoji' | 'image' | 'gif'): void;
    (e: 'updateSticker', stickerId: string, updates: Partial<Sticker>): void;
    (e: 'deleteSticker', stickerId: string): void;
  }>();

  const fileInputRef = ref<HTMLInputElement | null>(null);

  const popularEmojis = [
    '😀',
    '😂',
    '🤣',
    '😍',
    '🥰',
    '😎',
    '🤩',
    '🥳',
    '🔥',
    '💯',
    '⭐',
    '✨',
    '💫',
    '🎉',
    '🎊',
    '🏆',
    '❤️',
    '💜',
    '💙',
    '💚',
    '💛',
    '🧡',
    '🖤',
    '💗',
    '👍',
    '👏',
    '🙌',
    '💪',
    '🤝',
    '✌️',
    '🤟',
    '👊',
  ];

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function onFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      // Create object URL for preview
      const url = URL.createObjectURL(file);
      const type = file.type.includes('gif') ? 'gif' : 'image';
      emit('addSticker', url, type);
      target.value = '';
    }
  }

  function updateSticker(stickerId: string, key: string, value: any) {
    emit('updateSticker', stickerId, { [key]: value });
  }

  function updatePosition(stickerId: string, axis: 'x' | 'y', value: number) {
    const sticker = props.stickers.find((s) => s.id === stickerId);
    if (sticker) {
      emit('updateSticker', stickerId, {
        position: { ...sticker.position, [axis]: value },
      });
    }
  }
</script>
