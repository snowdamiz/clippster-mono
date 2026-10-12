<template>
  <div class="relative" ref="pickerContainer">
    <!-- Color Preview Button -->
    <button
      ref="buttonRef"
      type="button"
      class="relative h-8 w-14 cursor-pointer overflow-hidden rounded-[var(--radius-control)] border border-line-strong transition-shadow hover:shadow-[0_0_0_2px_var(--brand-line)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
      :class="{ 'shadow-[0_0_0_2px_var(--brand-line)]': showPicker }"
      :style="{ backgroundColor: modelValue }"
      :title="modelValue"
      aria-label="Pick color"
      @click="togglePicker"
    ></button>

    <!-- Custom Color Picker Popup (Teleported to body) -->
    <Teleport to="body">
      <div
        v-if="showPicker"
        class="color-picker-popup fixed z-[10060] flex w-64 flex-col gap-3 rounded-lg bg-surface-raised p-3 shadow-[var(--shadow-md)]"
        :style="pickerPosition"
        @click.stop
      >
        <!-- Hex Input -->
        <Field label="Hex color">
          <Input
            v-model="hexInput"
            type="text"
            class="h-[var(--control-sm)] font-mono text-xs uppercase"
            placeholder="#FFFFFF"
            maxlength="7"
            @input="onHexInput"
          />
        </Field>

        <!-- Color Palette (preset swatches are user-facing colors) -->
        <Field label="Quick colors">
          <div class="grid grid-cols-8 gap-1.5">
            <button
              v-for="color in presetColors"
              :key="color"
              type="button"
              class="aspect-square w-full rounded-md border border-line transition-shadow hover:shadow-[0_0_0_2px_var(--line-strong)]"
              :class="{
                'shadow-[0_0_0_2px_var(--surface-raised),0_0_0_4px_var(--brand)] hover:shadow-[0_0_0_2px_var(--surface-raised),0_0_0_4px_var(--brand)]':
                  modelValue.toUpperCase() === color.toUpperCase(),
              }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="selectColor(color)"
            ></button>
          </div>
        </Field>

        <!-- RGB Sliders -->
        <Field label="RGB values">
          <div class="flex flex-col gap-2.5">
            <div v-for="channel in rgbChannels" :key="channel.key" class="flex items-center gap-2">
              <span class="w-3 text-2xs font-semibold text-fg-subtle">{{ channel.label }}</span>
              <div class="relative h-1.5 flex-1 rounded-full bg-line-strong">
                <div
                  class="absolute left-0 top-0 h-full rounded-full"
                  :style="{ width: `${(rgb[channel.key] / 255) * 100}%`, backgroundColor: channel.color }"
                ></div>
                <input
                  v-model.number="rgb[channel.key]"
                  type="range"
                  min="0"
                  max="255"
                  :aria-label="channel.name"
                  class="slider absolute inset-x-0 top-1/2 z-10 h-4 w-full -translate-y-1/2 cursor-pointer"
                  @input="onRgbChange"
                />
              </div>
              <span class="tabular w-7 text-right font-mono text-2xs text-fg-muted">{{ rgb[channel.key] }}</span>
            </div>
          </div>
        </Field>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';

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

  // Channel indicator colors for the RGB sliders
  const rgbChannels = [
    { key: 'r' as const, label: 'R', name: 'Red', color: '#ef4444' },
    { key: 'g' as const, label: 'G', name: 'Green', color: '#22c55e' },
    { key: 'b' as const, label: 'B', name: 'Blue', color: '#3b82f6' },
  ];

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
  /* Transparent range input over the painted channel track; only the thumb shows */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .slider::-webkit-slider-runnable-track {
    height: 6px;
    background: transparent;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -3px;
    border-radius: 50%;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .slider::-moz-range-track {
    height: 6px;
    border: none;
    background: transparent;
  }

  .slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
</style>
