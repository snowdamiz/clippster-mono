<template>
  <div class="custom-time-picker">
    <button
      type="button"
      @click="showDropdown = !showDropdown"
      class="custom-time-picker__trigger"
      :disabled="disabled"
    >
      <Clock :size="16" class="custom-time-picker__icon" />
      <span>{{ displayValue }}</span>
      <ChevronDown
        :size="16"
        class="custom-time-picker__chevron"
        :class="{ 'custom-time-picker__chevron--open': showDropdown }"
      />
    </button>

    <!-- Dropdown -->
    <div v-if="showDropdown" class="custom-time-picker__dropdown">
      <div class="custom-time-picker__columns">
        <!-- Hours -->
        <div class="custom-time-picker__column">
          <button
            v-for="h in hours"
            :key="h"
            type="button"
            @click="selectHour(h)"
            class="custom-time-picker__option"
            :class="{ 'custom-time-picker__option--selected': h === selectedHour }"
          >
            {{ h.toString().padStart(2, '0') }}
          </button>
        </div>

        <!-- Minutes -->
        <div class="custom-time-picker__column">
          <button
            v-for="m in minutes"
            :key="m"
            type="button"
            @click="selectMinute(m)"
            class="custom-time-picker__option"
            :class="{ 'custom-time-picker__option--selected': m === selectedMinute }"
          >
            {{ m.toString().padStart(2, '0') }}
          </button>
        </div>

        <!-- AM/PM -->
        <div class="custom-time-picker__column">
          <button
            type="button"
            @click="selectPeriod('AM')"
            class="custom-time-picker__option"
            :class="{ 'custom-time-picker__option--selected': selectedPeriod === 'AM' }"
          >
            AM
          </button>
          <button
            type="button"
            @click="selectPeriod('PM')"
            class="custom-time-picker__option"
            :class="{ 'custom-time-picker__option--selected': selectedPeriod === 'PM' }"
          >
            PM
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Clock, ChevronDown } from 'lucide-vue-next';

interface Props {
  modelValue: string; // HH:MM format (24-hour)
  disabled?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const showDropdown = ref(false);
const selectedHour = ref(10);
const selectedMinute = ref(30);
const selectedPeriod = ref<'AM' | 'PM'>('PM');

// Generate hours (1-12)
const hours = Array.from({ length: 12 }, (_, i) => i + 1);

// Generate minutes (0-59)
const minutes = Array.from({ length: 60 }, (_, i) => i);

const displayValue = computed(() => {
  if (!props.modelValue) return '10:30 PM';
  
  const [hours24, mins] = props.modelValue.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  
  return `${hours12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
});

function selectHour(hour: number) {
  selectedHour.value = hour;
  emitValue();
}

function selectMinute(minute: number) {
  selectedMinute.value = minute;
  emitValue();
}

function selectPeriod(period: 'AM' | 'PM') {
  selectedPeriod.value = period;
  emitValue();
}

function emitValue() {
  // Convert 12-hour to 24-hour format
  let hours24 = selectedHour.value;
  if (selectedPeriod.value === 'PM' && hours24 !== 12) {
    hours24 += 12;
  } else if (selectedPeriod.value === 'AM' && hours24 === 12) {
    hours24 = 0;
  }
  
  const timeString = `${hours24.toString().padStart(2, '0')}:${selectedMinute.value.toString().padStart(2, '0')}`;
  emit('update:modelValue', timeString);
}

// Parse initial value
function parseValue(value: string) {
  if (!value) {
    selectedHour.value = 10;
    selectedMinute.value = 30;
    selectedPeriod.value = 'PM';
    return;
  }
  
  const [hours24, mins] = value.split(':').map(Number);
  selectedPeriod.value = hours24 >= 12 ? 'PM' : 'AM';
  selectedHour.value = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  selectedMinute.value = mins;
}

// Close dropdown when clicking outside
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.closest('.custom-time-picker')) {
    showDropdown.value = false;
  }
}

watch(() => props.modelValue, (newValue) => {
  parseValue(newValue);
}, { immediate: true });

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.custom-time-picker {
  position: relative;
  width: 100%;
}

.custom-time-picker__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  cursor: pointer;
  transition: all 150ms ease;
}

.custom-time-picker__trigger:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.1);
}

.custom-time-picker__trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-time-picker__icon {
  color: white;
  flex-shrink: 0;
}

.custom-time-picker__trigger span {
  flex: 1;
  text-align: left;
}

.custom-time-picker__chevron {
  flex-shrink: 0;
  transition: transform 150ms ease;
}

.custom-time-picker__chevron--open {
  transform: rotate(180deg);
}

.custom-time-picker__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 100;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.custom-time-picker__columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background-color: var(--sidebar-border);
}

.custom-time-picker__column {
  display: flex;
  flex-direction: column;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--sidebar-surface);
}

.custom-time-picker__column::-webkit-scrollbar {
  width: 6px;
}

.custom-time-picker__column::-webkit-scrollbar-track {
  background: transparent;
}

.custom-time-picker__column::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.custom-time-picker__option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 0.5rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.custom-time-picker__option:hover {
  background-color: var(--sidebar-hover);
}

.custom-time-picker__option--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  font-weight: 600;
}
</style>
