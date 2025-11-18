<template>
  <div class="relative" ref="pickerContainer">
    <!-- Color Preview Button -->
    <button
      ref="buttonRef"
      @click="togglePicker"
      class="h-10 w-16 rounded-lg border-2 border-border cursor-pointer relative overflow-hidden transition-all hover:border-border/80"
      :style="{ backgroundColor: modelValue }"
      type="button"
    >
      <div class="absolute inset-0 rounded-lg pointer-events-none border border-black/10"></div>
    </button>

    <!-- Custom Color Picker Popup (Teleported to body) -->
    <Teleport to="body">
      <div
        v-if="showPicker"
        class="color-picker-popup fixed z-[9999] bg-card border-2 border-border rounded-xl shadow-2xl p-4 w-64"
        :style="pickerPosition"
        @click.stop
      >
        <!-- Hex Input -->
        <div class="mb-3">
          <label class="text-xs font-medium text-muted-foreground mb-1 block">Hex Color</label>
          <input
            type="text"
            v-model="hexInput"
            @input="onHexInput"
            class="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 uppercase"
            placeholder="#FFFFFF"
            maxlength="7"
          />
        </div>

        <!-- Color Palette -->
        <div class="mb-3">
          <label class="text-xs font-medium text-muted-foreground mb-2 block">Quick Colors</label>
          <div class="grid grid-cols-8 gap-1.5">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="selectColor(color)"
              class="w-6 h-6 rounded-md border-2 transition-all hover:scale-110"
              :class="modelValue.toUpperCase() === color.toUpperCase() ? 'border-primary' : 'border-border/30'"
              :style="{ backgroundColor: color }"
              type="button"
            ></button>
          </div>
        </div>

        <!-- RGB Sliders -->
        <div class="space-y-3">
          <label class="text-xs font-medium text-muted-foreground block">RGB Values</label>

          <!-- Red -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-red-400 w-4 font-medium">R</span>
            <div class="relative flex-1 h-2 bg-muted-foreground/30 rounded-lg">
              <div
                class="absolute left-0 top-0 h-full bg-red-500 rounded-lg transition-all duration-200"
                :style="{ width: `${(rgb.r / 255) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="rgb.r"
                @input="onRgbChange"
                min="0"
                max="255"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
            <span class="text-xs text-foreground w-8 text-right font-mono">{{ rgb.r }}</span>
          </div>

          <!-- Green -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-green-400 w-4 font-medium">G</span>
            <div class="relative flex-1 h-2 bg-muted-foreground/30 rounded-lg">
              <div
                class="absolute left-0 top-0 h-full bg-green-500 rounded-lg transition-all duration-200"
                :style="{ width: `${(rgb.g / 255) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="rgb.g"
                @input="onRgbChange"
                min="0"
                max="255"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
            <span class="text-xs text-foreground w-8 text-right font-mono">{{ rgb.g }}</span>
          </div>

          <!-- Blue -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-blue-400 w-4 font-medium">B</span>
            <div class="relative flex-1 h-2 bg-muted-foreground/30 rounded-lg">
              <div
                class="absolute left-0 top-0 h-full bg-blue-500 rounded-lg transition-all duration-200"
                :style="{ width: `${(rgb.b / 255) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="rgb.b"
                @input="onRgbChange"
                min="0"
                max="255"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
            <span class="text-xs text-foreground w-8 text-right font-mono">{{ rgb.b }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted } from 'vue';

  interface Props {
    modelValue: string;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
  }>();

  const showPicker = ref(false);
  const hexInput = ref(props.modelValue);
  const pickerContainer = ref<HTMLElement | null>(null);
  const buttonRef = ref<HTMLElement | null>(null);
  const pickerPosition = ref({ top: '0px', left: '0px' });

  const rgb = ref({
    r: 255,
    g: 255,
    b: 255,
  });

  const presetColors = [
    '#FFFFFF',
    '#000000',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#F0F0F0',
    '#333333',
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#DDA0DD',
    '#98D8C8',
    '#E0E0E0',
    '#666666',
    '#FF4757',
    '#26DE81',
    '#2E86DE',
    '#FFD700',
    '#9B59B6',
    '#1ABC9C',
    '#B0B0B0',
    '#999999',
    '#EE5A6F',
    '#20BF6B',
    '#4B7BEC',
    '#FFC312',
    '#8E44AD',
    '#16A085',
  ];

  function togglePicker() {
    showPicker.value = !showPicker.value;

    if (showPicker.value && buttonRef.value) {
      // Calculate position based on button location
      const rect = buttonRef.value.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const pickerWidth = 256; // w-64 = 16rem = 256px

      let left = rect.left;

      // If picker would go off the right edge, align to the right of the button
      if (left + pickerWidth > windowWidth) {
        left = rect.right - pickerWidth;
      }

      // Ensure it doesn't go off the left edge
      if (left < 8) {
        left = 8;
      }

      pickerPosition.value = {
        top: `${rect.bottom + 8}px`,
        left: `${left}px`,
      };
    }
  }

  function closePicker() {
    showPicker.value = false;
  }

  function selectColor(color: string) {
    emit('update:modelValue', color.toUpperCase());
    hexInput.value = color.toUpperCase();
    updateRgbFromHex(color);
  }

  function onHexInput() {
    let hex = hexInput.value.trim();
    if (!hex.startsWith('#')) {
      hex = '#' + hex;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      emit('update:modelValue', hex.toUpperCase());
      updateRgbFromHex(hex);
    }
  }

  function onRgbChange() {
    const hex = rgbToHex(rgb.value.r, rgb.value.g, rgb.value.b);
    hexInput.value = hex;
    emit('update:modelValue', hex);
  }

  function updateRgbFromHex(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      rgb.value = {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      };
    }
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
        .toUpperCase()
    );
  }

  function getContrastColor(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '#000000';

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  // Close picker when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Check if click is outside both the button and the picker
    if (showPicker.value) {
      const isClickInsideButton = buttonRef.value?.contains(target);
      const isClickInsidePicker = target.closest('.color-picker-popup');

      if (!isClickInsideButton && !isClickInsidePicker) {
        showPicker.value = false;
      }
    }
  }

  onMounted(() => {
    updateRgbFromHex(props.modelValue);
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  watch(
    () => props.modelValue,
    (newValue) => {
      hexInput.value = newValue;
      updateRgbFromHex(newValue);
    }
  );
</script>

<style scoped>
  .slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .slider::-webkit-slider-track {
    background: transparent;
    height: 100%;
    border-radius: 0.5rem;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
  }

  .slider::-moz-range-track {
    background: transparent;
    height: 100%;
    border-radius: 0.5rem;
    border: none;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
  }
</style>
