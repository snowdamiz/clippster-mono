<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Text Overlays</h3>
      <p class="text-xs text-white/50 mb-4">Add text to your clip. Drag text in the preview to reposition.</p>
    </div>

    <!-- Add Text Button -->
    <button
      @click="showAddTextDialog = true"
      class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
    >
      <Plus :size="16" />
      Add Text
    </button>

    <!-- Text Overlays List -->
    <div v-if="textOverlays.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-white">Text Layers</h4>

      <div v-for="overlay in textOverlays" :key="overlay.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <Type :size="16" class="text-violet-400 flex-shrink-0" />
            <span class="text-sm text-white truncate">{{ overlay.text || 'Text' }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="selectOverlay(overlay.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              :class="selectedOverlayId === overlay.id ? 'bg-violet-500/20' : ''"
              title="Edit"
            >
              <Pencil :size="14" :class="selectedOverlayId === overlay.id ? 'text-violet-400' : 'text-white/50'" />
            </button>
            <button
              @click="emit('deleteText', overlay.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Remove"
            >
              <Trash2 :size="14" class="text-red-400" />
            </button>
          </div>
        </div>

        <!-- Quick Info -->
        <div class="flex items-center gap-3 text-xs text-white/40">
          <span>{{ formatTime(overlay.startTime) }} - {{ formatTime(overlay.endTime) }}</span>
          <span>{{ getStyleForRatio(overlay).fontSize }}px</span>
          <span>{{ getStyleForRatio(overlay).fontFamily }}</span>
          <span class="flex items-center gap-1" v-if="overlay.motionPreset && overlay.motionPreset !== 'none'">
            <Sparkles :size="12" class="text-amber-300" />
            <span>{{ motionPresetLabel(overlay.motionPreset) }}</span>
            <span class="text-white/30">({{ (overlay.motionDuration || 0.4).toFixed(1) }}s)</span>
          </span>
        </div>

        <!-- Aspect Ratio Configuration Buttons -->
        <div v-if="configuredAspectRatios.length > 0" class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-[10px] text-white/40 uppercase tracking-wide">Configure for:</span>
          <button
            @click="switchToRatio('16:9')"
            :class="[
              'px-2 py-1 rounded text-[10px] font-medium transition-all',
              previewAspectRatio === '16:9'
                ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
            ]"
          >
            16:9
          </button>
          <button
            v-for="ratio in configuredAspectRatios"
            :key="ratio"
            @click="switchToRatio(ratio)"
            :class="[
              'px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1',
              previewAspectRatio === ratio
                ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900'
                : overlay.perRatioConfigs?.[ratio]
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
            ]"
          >
            {{ ratio }}
            <span v-if="overlay.perRatioConfigs?.[ratio]" class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
          </button>
        </div>

        <!-- Expanded Edit Panel (when selected) -->
        <div v-if="selectedOverlayId === overlay.id" class="mt-4 pt-4 border-t border-white/10 space-y-4">
          <!-- Text Content -->
          <div>
            <label class="block text-xs text-white/50 mb-1">Text</label>
            <input
              type="text"
              :value="overlay.text"
              @input="(e) => updateOverlay('text', (e.target as HTMLInputElement).value)"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              placeholder="Enter your text..."
            />
          </div>

          <!-- Font Row -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Font Family -->
            <div>
              <label class="block text-xs text-white/50 mb-1">Font</label>
              <div class="relative">
                <button
                  @click="toggleFontDropdown(overlay.id)"
                  class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center justify-between"
                >
                  <span class="truncate" :style="{ fontFamily: getStyleForRatio(overlay).fontFamily }">
                    {{ getStyleForRatio(overlay).fontFamily }}
                  </span>
                  <ChevronDown
                    :size="14"
                    class="text-white/40 transition-transform flex-shrink-0 ml-2"
                    :class="{ 'rotate-180': activeFontDropdown === overlay.id }"
                  />
                </button>
                <div
                  v-if="activeFontDropdown === overlay.id"
                  class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="font in fontOptions"
                    :key="font"
                    @click="selectFont(font)"
                    class="block w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-sm text-white"
                    :class="{ 'bg-violet-500/20 text-violet-400': getStyleForRatio(overlay).fontFamily === font }"
                    :style="{ fontFamily: font }"
                  >
                    {{ font }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Font Size -->
            <div>
              <label class="block text-xs text-white/50 mb-1">Size</label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  :value="getStyleForRatio(overlay).fontSize"
                  @input="(e) => updateStyle('fontSize', parseInt((e.target as HTMLInputElement).value))"
                  min="12"
                  max="150"
                  class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
                />
                <span class="text-xs text-white/40">px</span>
              </div>
            </div>
          </div>

          <!-- Width Control -->
          <div>
            <label class="block text-xs text-white/50 mb-1">Width</label>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-2 flex-1">
                <button
                  @click="updateStyle('width', undefined)"
                  :class="[
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    !getStyleForRatio(overlay).width
                      ? 'bg-violet-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20',
                  ]"
                >
                  Auto
                </button>
                <input
                  type="number"
                  :value="getStyleForRatio(overlay).width || ''"
                  @input="
                    (e) => {
                      const val = parseInt((e.target as HTMLInputElement).value);
                      updateStyle('width', val > 0 ? val : undefined);
                    }
                  "
                  min="10"
                  max="100"
                  placeholder="Auto"
                  class="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm text-white"
                />
                <span class="text-xs text-white/40">%</span>
              </div>
            </div>
            <p class="text-[10px] text-white/30 mt-1">Drag resize handles in preview or set manually</p>
          </div>

          <!-- Color & Weight Row -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Text Color -->
            <div>
              <label class="block text-xs text-white/50 mb-1">Color</label>
              <div class="flex gap-2">
                <ColorPicker
                  :modelValue="getStyleForRatio(overlay).color"
                  @update:modelValue="(v) => updateStyle('color', v)"
                />
                <input
                  type="text"
                  :value="getStyleForRatio(overlay).color"
                  @input="(e) => updateStyle('color', (e.target as HTMLInputElement).value)"
                  class="flex-1 px-2 py-2 bg-white/5 border border-white/10 rounded-md text-xs text-white font-mono uppercase"
                />
              </div>
            </div>

            <!-- Font Weight -->
            <div>
              <label class="block text-xs text-white/50 mb-1">Weight</label>
              <select
                :value="getStyleForRatio(overlay).fontWeight"
                @change="(e) => updateStyle('fontWeight', parseInt((e.target as HTMLSelectElement).value))"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
              >
                <option value="100">Thin</option>
                <option value="300">Light</option>
                <option value="400">Normal</option>
                <option value="500">Medium</option>
                <option value="600">Semi Bold</option>
                <option value="700">Bold</option>
                <option value="900">Black</option>
              </select>
            </div>
          </div>

          <!-- Timing -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-white/50 mb-1">Start Time</label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  :value="overlay.startTime.toFixed(1)"
                  @input="(e) => updateOverlay('startTime', parseFloat((e.target as HTMLInputElement).value))"
                  step="0.1"
                  min="0"
                  :max="duration"
                  class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
                />
                <span class="text-xs text-white/40">s</span>
              </div>
            </div>
            <div>
              <label class="block text-xs text-white/50 mb-1">End Time</label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  :value="overlay.endTime.toFixed(1)"
                  @input="(e) => updateOverlay('endTime', parseFloat((e.target as HTMLInputElement).value))"
                  step="0.1"
                  :min="overlay.startTime"
                  :max="duration"
                  class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
                />
                <span class="text-xs text-white/40">s</span>
              </div>
            </div>
          </div>

          <!-- Effects Section -->
          <div class="space-y-3 pt-3 border-t border-white/10">
            <h5 class="text-xs font-medium text-white/70">Effects</h5>

            <!-- Outline Toggle -->
            <div class="flex items-center justify-between">
              <span class="text-xs text-white/50">Text Outline</span>
              <button
                @click="toggleBorder"
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                  getStyleForRatio(overlay).border1Width > 0 ? 'bg-violet-500' : 'bg-white/20',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                    getStyleForRatio(overlay).border1Width > 0 ? 'translate-x-[18px]' : 'translate-x-0.5',
                  ]"
                ></span>
              </button>
            </div>
            <div v-if="getStyleForRatio(overlay).border1Width > 0" class="flex gap-2">
              <ColorPicker
                :modelValue="getStyleForRatio(overlay).border1Color"
                @update:modelValue="(v) => updateStyle('border1Color', v)"
              />
              <input
                type="number"
                :value="getStyleForRatio(overlay).border1Width"
                @input="(e) => updateStyle('border1Width', parseFloat((e.target as HTMLInputElement).value))"
                min="0.5"
                max="10"
                step="0.5"
                class="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
              <span class="text-xs text-white/40 self-center">px</span>
            </div>

            <!-- Shadow Toggle -->
            <div class="flex items-center justify-between">
              <span class="text-xs text-white/50">Drop Shadow</span>
              <button
                @click="toggleShadow"
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                  getStyleForRatio(overlay).shadowEnabled ? 'bg-violet-500' : 'bg-white/20',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                    getStyleForRatio(overlay).shadowEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                  ]"
                ></span>
              </button>
            </div>
            <div v-if="getStyleForRatio(overlay).shadowEnabled" class="flex gap-2">
              <ColorPicker
                :modelValue="getStyleForRatio(overlay).shadowColor"
                @update:modelValue="(v) => updateStyle('shadowColor', v)"
              />
              <input
                type="number"
                :value="getStyleForRatio(overlay).shadowBlur"
                @input="(e) => updateStyle('shadowBlur', parseInt((e.target as HTMLInputElement).value))"
                min="0"
                max="20"
                class="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
                title="Blur"
              />
              <span class="text-xs text-white/40 self-center">blur</span>
            </div>

            <!-- Background Toggle -->
            <div class="flex items-center justify-between">
              <span class="text-xs text-white/50">Background</span>
              <button
                @click="updateStyle('backgroundEnabled', !getStyleForRatio(overlay).backgroundEnabled)"
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                  getStyleForRatio(overlay).backgroundEnabled ? 'bg-violet-500' : 'bg-white/20',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                    getStyleForRatio(overlay).backgroundEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                  ]"
                ></span>
              </button>
            </div>
            <div v-if="getStyleForRatio(overlay).backgroundEnabled" class="flex gap-2">
              <ColorPicker
                :modelValue="getStyleForRatio(overlay).backgroundColor || '#000000'"
                @update:modelValue="(v) => updateStyle('backgroundColor', v)"
              />
              <input
                type="text"
                :value="getStyleForRatio(overlay).backgroundColor"
                @input="(e) => updateStyle('backgroundColor', (e.target as HTMLInputElement).value)"
                class="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white font-mono"
              />
            </div>
          </div>

          <!-- Animation -->
          <div class="space-y-2 pt-3 border-t border-white/10">
            <label class="block text-xs text-white/50">Animation</label>
            <select
              :value="overlay.animation"
              @change="(e) => updateOverlay('animation', (e.target as HTMLSelectElement).value)"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
            >
              <option v-for="anim in animationOptions" :key="anim.value" :value="anim.value">
                {{ anim.label }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Text Dialog -->
    <Teleport to="body">
      <div
        v-if="showAddTextDialog"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-sm mx-4 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white">Add Text Overlay</h3>
            <button @click="showAddTextDialog = false" class="p-1 hover:bg-white/10 rounded transition-colors">
              <X :size="16" class="text-white/60" />
            </button>
          </div>
          <div class="p-4">
            <input
              ref="newTextInput"
              v-model="newText"
              type="text"
              placeholder="Enter your text..."
              class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              @keyup.enter="addText"
            />
            <div class="flex justify-end gap-2 mt-4">
              <button
                @click="showAddTextDialog = false"
                class="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                @click="addText"
                class="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                Add Text
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Save Preset Dialog -->
    <Teleport to="body">
      <div
        v-if="showSavePresetDialog"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-sm mx-4 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white">Save as Preset</h3>
            <button @click="showSavePresetDialog = false" class="p-1 hover:bg-white/10 rounded transition-colors">
              <X :size="16" class="text-white/60" />
            </button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-xs text-white/50 mb-1">Preset Name</label>
              <input
                v-model="newPresetName"
                type="text"
                placeholder="e.g., My Custom Style"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                @keydown.enter="handleSavePreset"
              />
            </div>
            <div>
              <label class="block text-xs text-white/50 mb-1">Description (optional)</label>
              <textarea
                v-model="newPresetDescription"
                placeholder="Optional description"
                rows="2"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
              ></textarea>
            </div>
            <div class="flex justify-end gap-2">
              <button
                @click="showSavePresetDialog = false"
                class="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleSavePreset"
                class="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import { Plus, Type, ChevronDown, Trash2, Pencil, X, Sparkles } from 'lucide-vue-next';
  import type { TextOverlay, TextOverlayStyle } from '@/types';
  import type { CustomSubtitlePreset } from '@/services/database';
  import {
    getAllCustomSubtitlePresets,
    createCustomSubtitlePreset,
    customPresetToSettings,
    getAllCustomFonts,
    type CustomFont,
  } from '@/services/database';
  import ColorPicker from '@/components/ColorPicker.vue';

  // Import type for framing configs
  import type { ManualFramingConfigs } from '@/types';

  const props = defineProps<{
    textOverlays: TextOverlay[];
    currentTime: number;
    duration: number;
    previewAspectRatio: string; // Currently previewed aspect ratio
    selectedAspectRatios: string[]; // All selected aspect ratios
    framingConfigs: ManualFramingConfigs; // Framing configurations per aspect ratio
  }>();

  const emit = defineEmits<{
    (e: 'addText', text: string, style: TextOverlayStyle): void;
    (e: 'updateText', overlayId: string, updates: Partial<TextOverlay>): void;
    (e: 'deleteText', overlayId: string): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // State
  const selectedOverlayId = ref<string | null>(null);
  const activeFontDropdown = ref<string | null>(null);
  const showAddTextDialog = ref(false);
  const showSavePresetDialog = ref(false);
  const newText = ref('');
  const newTextInput = ref<HTMLInputElement | null>(null);
  const newPresetName = ref('');
  const newPresetDescription = ref('');
  const customPresets = ref<CustomSubtitlePreset[]>([]);
  const customFonts = ref<CustomFont[]>([]);

  const baseFontOptions = [
    'Inter',
    'Montserrat',
    'Poppins',
    'Roboto',
    'Open Sans',
    'Oswald',
    'Lato',
    'Bangers',
    'Anton',
    'Nunito',
    'Arial',
    'Helvetica',
    'Impact',
    'Bebas Neue',
  ];

  const fontOptions = computed(() => {
    const customFontNames = customFonts.value.map((f) => f.name);
    return [...baseFontOptions, ...customFontNames];
  });

  const _quickStylePresets = [
    { id: 'title', name: 'Title', description: 'Large centered' },
    { id: 'lower-third', name: 'Lower Third', description: 'With background' },
    { id: 'caption', name: 'Caption', description: 'Subtitle style' },
    { id: 'quote', name: 'Quote', description: 'Stylized' },
  ];

  const animationOptions = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide-up', label: 'Slide Up' },
    { value: 'slide-down', label: 'Slide Down' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'pop', label: 'Pop' },
    { value: 'typewriter', label: 'Typewriter' },
    { value: 'bounce', label: 'Bounce' },
  ] as const;

  const motionPresets = [
    { value: 'none' as const, label: 'None', description: 'Static text' },
    { value: 'fade' as const, label: 'Fade', description: 'Soft fade in/out', duration: 0.4 },
    { value: 'slide-up' as const, label: 'Slide Up', description: 'Slide from bottom', duration: 0.5 },
    { value: 'pop' as const, label: 'Pop', description: 'Pop & scale', duration: 0.35 },
  ];

  const _quickPositions = [
    { id: 'top-left', label: 'TL', x: 15, y: 15 },
    { id: 'top-center', label: 'Top', x: 50, y: 15 },
    { id: 'top-right', label: 'TR', x: 85, y: 15 },
    { id: 'middle-left', label: 'Left', x: 15, y: 50 },
    { id: 'center', label: 'Center', x: 50, y: 50 },
    { id: 'middle-right', label: 'Right', x: 85, y: 50 },
    { id: 'bottom-left', label: 'BL', x: 15, y: 85 },
    { id: 'bottom-center', label: 'Bottom', x: 50, y: 85 },
    { id: 'bottom-right', label: 'BR', x: 85, y: 85 },
  ];

  const defaultStyle: TextOverlayStyle = {
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: null,
    backgroundEnabled: false,
    highlightColor: '#FFFF00',
    border1Width: 2,
    border1Color: '#000000',
    border2Width: 0,
    border2Color: '#000000',
    strokeEnabled: false,
    strokeColor: '#000000',
    strokeWidth: 1,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    borderRadius: 4,
    padding: 8,
    letterSpacing: 0,
    lineHeight: 1.2,
    wordSpacing: 0.35,
    textAlign: 'center',
    maxWidth: 90,
    width: undefined, // Auto-width by default
    textOffsetX: 0,
    textOffsetY: 0,
  };

  // Computed
  const selectedOverlay = computed(() => {
    if (!selectedOverlayId.value) return null;
    return props.textOverlays.find((o) => o.id === selectedOverlayId.value) || null;
  });

  // Get the style for the current preview aspect ratio
  const currentRatioStyle = computed(() => {
    if (!selectedOverlay.value) return null;
    const ratio = props.previewAspectRatio;
    const ratioConfig = selectedOverlay.value.perRatioConfigs?.[ratio];
    return ratioConfig?.style || selectedOverlay.value.style;
  });

  // Helper to get style for an overlay at current aspect ratio
  function getStyleForRatio(overlay: TextOverlay): TextOverlayStyle {
    const ratio = props.previewAspectRatio;
    const ratioConfig = overlay.perRatioConfigs?.[ratio];
    return ratioConfig?.style || overlay.style;
  }

  // Helper to get position for an overlay at current aspect ratio
  function getPositionForRatio(overlay: TextOverlay): { x: number; y: number } {
    const ratio = props.previewAspectRatio;
    const ratioConfig = overlay.perRatioConfigs?.[ratio];
    return ratioConfig?.position || overlay.position;
  }

  // Check if an aspect ratio has been configured with custom framing
  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return !!(config && config.regions && config.regions.length > 0);
  }

  // Get list of aspect ratios that have been configured with custom framing
  const configuredAspectRatios = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => isRatioConfigured(ratio));
  });

  // Switch preview to a specific aspect ratio
  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  // Watchers
  watch(
    () => props.textOverlays,
    (overlays) => {
      if (overlays.length > 0 && !selectedOverlayId.value) {
        selectedOverlayId.value = overlays[0].id;
      }
      if (selectedOverlayId.value && !overlays.find((o) => o.id === selectedOverlayId.value)) {
        selectedOverlayId.value = overlays.length > 0 ? overlays[0].id : null;
      }
    },
    { immediate: true }
  );

  watch(showAddTextDialog, (show) => {
    if (show) {
      nextTick(() => {
        newTextInput.value?.focus();
      });
    }
  });

  // Methods
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function selectOverlay(id: string) {
    selectedOverlayId.value = selectedOverlayId.value === id ? null : id;
  }

  function toggleFontDropdown(overlayId: string) {
    activeFontDropdown.value = activeFontDropdown.value === overlayId ? null : overlayId;
  }

  function addText() {
    if (newText.value.trim()) {
      emit('addText', newText.value.trim(), { ...defaultStyle });
      newText.value = '';
      showAddTextDialog.value = false;
    }
  }

  function updateOverlay(key: keyof TextOverlay, value: any) {
    if (!selectedOverlayId.value) return;
    emit('updateText', selectedOverlayId.value, { [key]: value });
  }

  function motionPresetLabel(preset: TextOverlay['motionPreset']): string {
    const found = motionPresets.find((p) => p.value === preset);
    return found?.label || 'None';
  }

  function applyMotionPreset(preset: TextOverlay['motionPreset']) {
    if (!selectedOverlayId.value) return;
    const defaultDuration = motionPresets.find((p) => p.value === preset)?.duration ?? 0.4;
    emit('updateText', selectedOverlayId.value, {
      motionPreset: preset,
      motionDuration: defaultDuration,
    });
  }

  function updateMotionDuration(duration: number) {
    if (!selectedOverlayId.value || Number.isNaN(duration) || duration <= 0) return;
    emit('updateText', selectedOverlayId.value, { motionDuration: duration });
  }

  function updateStyle(key: keyof TextOverlayStyle, value: any) {
    if (!selectedOverlay.value) return;
    const ratio = props.previewAspectRatio;
    const overlay = selectedOverlay.value;

    // Get current config for this ratio (or create from defaults)
    const perRatioConfigs = overlay.perRatioConfigs ? { ...overlay.perRatioConfigs } : {};
    const currentConfig = perRatioConfigs[ratio] || {
      position: { ...overlay.position },
      style: { ...overlay.style },
    };

    // Update the style for this ratio
    currentConfig.style = { ...currentConfig.style, [key]: value };
    perRatioConfigs[ratio] = currentConfig;

    emit('updateText', selectedOverlayId.value!, { perRatioConfigs });
  }

  function _setQuickPosition(x: number, y: number) {
    if (!selectedOverlay.value) return;
    const ratio = props.previewAspectRatio;
    const overlay = selectedOverlay.value;

    // Get current config for this ratio (or create from defaults)
    const perRatioConfigs = overlay.perRatioConfigs ? { ...overlay.perRatioConfigs } : {};
    const currentConfig = perRatioConfigs[ratio] || {
      position: { ...overlay.position },
      style: { ...overlay.style },
    };

    // Update the position for this ratio
    currentConfig.position = { x, y };
    perRatioConfigs[ratio] = currentConfig;

    emit('updateText', selectedOverlayId.value!, { perRatioConfigs });
  }

  function _isNearPosition(overlay: TextOverlay, x: number, y: number): boolean {
    const threshold = 10;
    const position = getPositionForRatio(overlay);
    return Math.abs(position.x - x) < threshold && Math.abs(position.y - y) < threshold;
  }

  function selectFont(font: string) {
    updateStyle('fontFamily', font);
    activeFontDropdown.value = null;
  }

  function toggleBorder() {
    if (!selectedOverlay.value || !currentRatioStyle.value) return;
    if (currentRatioStyle.value.border1Width > 0) {
      updateStyle('border1Width', 0);
    } else {
      updateStyle('border1Width', 2);
    }
  }

  function toggleShadow() {
    if (!selectedOverlay.value || !currentRatioStyle.value) return;
    const newEnabled = !currentRatioStyle.value.shadowEnabled;
    updateStyle('shadowEnabled', newEnabled);
    if (newEnabled && currentRatioStyle.value.shadowBlur === 0) {
      updateStyle('shadowBlur', 4);
    }
  }

  function _applyQuickPreset(preset: { id: string; name: string }) {
    if (!selectedOverlay.value) return;

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

    emit('updateText', selectedOverlayId.value!, { style });
  }

  function _applyCustomPreset(preset: CustomSubtitlePreset) {
    if (!selectedOverlay.value) return;

    const subtitleSettings = customPresetToSettings(preset);

    const style: TextOverlayStyle = {
      fontFamily: subtitleSettings.fontFamily,
      fontSize: subtitleSettings.fontSize,
      fontWeight: subtitleSettings.fontWeight,
      color: subtitleSettings.textColor,
      backgroundColor: subtitleSettings.backgroundColor,
      backgroundEnabled: subtitleSettings.backgroundEnabled,
      highlightColor: subtitleSettings.highlightColor,
      border1Width: subtitleSettings.border1Width,
      border1Color: subtitleSettings.border1Color,
      border2Width: subtitleSettings.border2Width,
      border2Color: subtitleSettings.border2Color,
      strokeEnabled: subtitleSettings.border1Width > 0,
      strokeColor: subtitleSettings.border1Color,
      strokeWidth: subtitleSettings.border1Width,
      shadowEnabled: subtitleSettings.shadowBlur > 0,
      shadowColor: subtitleSettings.shadowColor,
      shadowBlur: subtitleSettings.shadowBlur,
      shadowOffsetX: subtitleSettings.shadowOffsetX,
      shadowOffsetY: subtitleSettings.shadowOffsetY,
      borderRadius: subtitleSettings.borderRadius,
      padding: subtitleSettings.padding,
      letterSpacing: subtitleSettings.letterSpacing,
      lineHeight: subtitleSettings.lineHeight,
      wordSpacing: subtitleSettings.wordSpacing,
      textAlign: subtitleSettings.textAlign,
      maxWidth: subtitleSettings.maxWidth,
      textOffsetX: subtitleSettings.textOffsetX,
      textOffsetY: subtitleSettings.textOffsetY,
    };

    emit('updateText', selectedOverlayId.value!, { style });
  }

  function _saveCurrentAsPreset() {
    if (!selectedOverlay.value) return;
    showSavePresetDialog.value = true;
    newPresetName.value = '';
    newPresetDescription.value = '';
  }

  async function handleSavePreset() {
    if (!selectedOverlay.value || !newPresetName.value.trim()) return;

    try {
      const style = selectedOverlay.value.style;

      const settingsForStorage = {
        enabled: false,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        textColor: style.color,
        backgroundColor: style.backgroundColor || '#000000',
        backgroundEnabled: style.backgroundEnabled,
        border1Width: style.border1Width,
        border1Color: style.border1Color,
        border2Width: style.border2Width,
        border2Color: style.border2Color,
        shadowOffsetX: style.shadowOffsetX,
        shadowOffsetY: style.shadowOffsetY,
        shadowBlur: style.shadowBlur,
        shadowColor: style.shadowColor,
        position: 'middle' as const,
        positionPercentage: 50,
        maxWidth: style.maxWidth,
        animationStyle: 'none' as const,
        highlightColor: style.highlightColor,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlign,
        textOffsetX: style.textOffsetX,
        textOffsetY: style.textOffsetY,
        padding: style.padding,
        borderRadius: style.borderRadius,
        wordSpacing: style.wordSpacing,
      };

      await createCustomSubtitlePreset(
        newPresetName.value.trim(),
        newPresetDescription.value.trim(),
        settingsForStorage
      );
      await loadCustomPresets();
      showSavePresetDialog.value = false;
    } catch (error) {
      console.error('[TextOverlayTab] Failed to save preset:', error);
    }
  }

  async function loadCustomPresets() {
    try {
      customPresets.value = await getAllCustomSubtitlePresets();
    } catch (error) {
      console.error('[TextOverlayTab] Failed to load presets:', error);
    }
  }

  async function loadCustomFonts() {
    try {
      customFonts.value = await getAllCustomFonts();
      customFonts.value.forEach((font) => injectFontFace(font));
    } catch (error) {
      console.error('[TextOverlayTab] Failed to load custom fonts:', error);
    }
  }

  function injectFontFace(font: CustomFont) {
    const styleId = `custom-font-${font.id}`;
    if (document.getElementById(styleId)) return;

    const format = font.file_type === 'ttf' ? 'truetype' : font.file_type === 'otf' ? 'opentype' : font.file_type;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @font-face {
        font-family: '${font.name}';
        src: url('file://${font.file_path.replace(/\\/g, '/')}') format('${format}');
        font-weight: 100 900;
        font-style: normal;
      }
    `;
    document.head.appendChild(style);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (activeFontDropdown.value && !target.closest('.relative')) {
      activeFontDropdown.value = null;
    }
  }

  onMounted(async () => {
    await loadCustomPresets();
    await loadCustomFonts();
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<style scoped>
  select {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  select option {
    background-color: #18181b;
    color: white;
  }
</style>
