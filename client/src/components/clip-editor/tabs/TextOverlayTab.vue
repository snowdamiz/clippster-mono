<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Text Overlays</h3>
      <p class="text-xs text-white/50 mb-4">Add titles, captions, and custom text to your clip.</p>
    </div>

    <!-- Add Text Button -->
    <button
      @click="showAddTextDialog = true"
      class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
    >
      <Plus :size="16" />
      Add Text
    </button>

    <!-- Style Presets -->
    <div>
      <h4 class="text-sm font-medium text-white mb-3">Style Presets</h4>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="preset in stylePresets"
          :key="preset.id"
          @click="applyPreset(preset)"
          class="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
        >
          <div class="text-sm font-medium text-white mb-1">{{ preset.name }}</div>
          <div class="text-xs text-white/50">{{ preset.description }}</div>
        </button>
      </div>
    </div>

    <!-- Text Overlays List -->
    <div v-if="textOverlays.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-white">Your Text Overlays</h4>

      <div v-for="overlay in textOverlays" :key="overlay.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white truncate">{{ overlay.text }}</div>
            <div class="text-xs text-white/50 mt-1">
              {{ formatTime(overlay.startTime) }} - {{ formatTime(overlay.endTime) }}
            </div>
          </div>
          <button @click="emit('deleteText', overlay.id)" class="p-1.5 rounded hover:bg-white/10 transition-colors">
            <Trash2 :size="14" class="text-red-400" />
          </button>
        </div>

        <!-- Text Input -->
        <div class="mb-3">
          <label class="block text-xs text-white/60 mb-1">Text</label>
          <input
            type="text"
            :value="overlay.text"
            @input="(e) => updateText(overlay.id, 'text', (e.target as HTMLInputElement).value)"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          />
        </div>

        <!-- Timing -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Start</label>
            <input
              type="number"
              :value="overlay.startTime"
              @input="(e) => updateText(overlay.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))"
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
              :value="overlay.endTime"
              @input="(e) => updateText(overlay.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              :min="overlay.startTime"
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
              :value="overlay.position.x"
              @input="(e) => updatePosition(overlay.id, 'x', parseFloat((e.target as HTMLInputElement).value))"
              min="0"
              max="100"
              class="w-full accent-violet-500"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">Y Position (%)</label>
            <input
              type="range"
              :value="overlay.position.y"
              @input="(e) => updatePosition(overlay.id, 'y', parseFloat((e.target as HTMLInputElement).value))"
              min="0"
              max="100"
              class="w-full accent-violet-500"
            />
          </div>
        </div>

        <!-- Animation -->
        <div>
          <label class="block text-xs text-white/60 mb-1">Animation</label>
          <select
            :value="overlay.animation"
            @change="(e) => updateText(overlay.id, 'animation', (e.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
          >
            <option value="none">None</option>
            <option value="fade">Fade</option>
            <option value="slide-up">Slide Up</option>
            <option value="slide-down">Slide Down</option>
            <option value="typewriter">Typewriter</option>
            <option value="bounce">Bounce</option>
            <option value="zoom">Zoom</option>
            <option value="pop">Pop</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Add Text Dialog -->
    <div
      v-if="showAddTextDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showAddTextDialog = false"
    >
      <div class="bg-[#1a1a1a] rounded-lg p-4 w-96 border border-white/10">
        <h3 class="text-sm font-medium text-white mb-4">Add Text Overlay</h3>
        <input
          v-model="newText"
          type="text"
          placeholder="Enter your text..."
          class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white mb-4"
          @keyup.enter="addText"
        />
        <div class="flex justify-end gap-2">
          <button @click="showAddTextDialog = false" class="px-4 py-2 text-sm text-white/60 hover:text-white">
            Cancel
          </button>
          <button @click="addText" class="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-sm text-white rounded-lg">
            Add
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Plus, Trash2 } from 'lucide-vue-next';
  import type { TextOverlay, TextOverlayStyle } from '@/types';

  const props = defineProps<{
    textOverlays: TextOverlay[];
    currentTime: number;
    duration: number;
  }>();

  const emit = defineEmits<{
    (e: 'addText', text: string, style: TextOverlayStyle): void;
    (e: 'updateText', overlayId: string, updates: Partial<TextOverlay>): void;
    (e: 'deleteText', overlayId: string): void;
  }>();

  const showAddTextDialog = ref(false);
  const newText = ref('');

  const stylePresets = [
    { id: 'title', name: 'Title', description: 'Large centered text' },
    { id: 'lower-third', name: 'Lower Third', description: 'Professional lower text' },
    { id: 'caption', name: 'Caption', description: 'Subtitle style text' },
    { id: 'quote', name: 'Quote', description: 'Stylized quote text' },
  ];

  const defaultStyle: TextOverlayStyle = {
    fontFamily: 'sans-serif',
    fontSize: 24,
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: null,
    backgroundEnabled: false,
    borderRadius: 4,
    padding: 8,
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlign: 'center',
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    strokeEnabled: false,
    strokeColor: '#000000',
    strokeWidth: 1,
  };

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function addText() {
    if (newText.value.trim()) {
      emit('addText', newText.value.trim(), { ...defaultStyle });
      newText.value = '';
      showAddTextDialog.value = false;
    }
  }

  function applyPreset(preset: { id: string; name: string }) {
    const style = { ...defaultStyle };

    switch (preset.id) {
      case 'title':
        style.fontSize = 48;
        style.fontWeight = 700;
        break;
      case 'lower-third':
        style.fontSize = 20;
        style.backgroundEnabled = true;
        style.backgroundColor = 'rgba(0,0,0,0.7)';
        style.padding = 12;
        break;
      case 'caption':
        style.fontSize = 18;
        style.backgroundEnabled = true;
        style.backgroundColor = 'rgba(0,0,0,0.8)';
        style.borderRadius = 2;
        break;
      case 'quote':
        style.fontSize = 28;
        style.fontWeight = 400;
        style.letterSpacing = 1;
        break;
    }

    emit('addText', `${preset.name} Text`, style);
  }

  function updateText(overlayId: string, key: string, value: any) {
    emit('updateText', overlayId, { [key]: value });
  }

  function updatePosition(overlayId: string, axis: 'x' | 'y', value: number) {
    const overlay = props.textOverlays.find((o) => o.id === overlayId);
    if (overlay) {
      emit('updateText', overlayId, {
        position: { ...overlay.position, [axis]: value },
      });
    }
  }
</script>
