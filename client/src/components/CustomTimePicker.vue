<template>
  <PopoverRoot v-model:open="showDropdown">
    <PopoverTrigger as-child>
      <button
        type="button"
        :disabled="disabled"
        class="flex h-[var(--control-md)] w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-left text-sm text-fg transition-[border-color,box-shadow] hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-line-strong"
      >
        <Clock class="size-3.5 shrink-0 text-fg-subtle" />
        <span class="tabular min-w-0 flex-1 truncate">{{ displayValue }}</span>
        <ChevronDown class="size-3.5 shrink-0 text-fg-subtle transition-transform" :class="{ 'rotate-180': showDropdown }" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="4"
        class="z-[10060] w-[var(--reka-popover-trigger-width)] min-w-[180px] overflow-hidden rounded-lg bg-surface-raised p-1 shadow-[var(--shadow-md)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        @open-auto-focus="onOpen"
      >
        <div ref="columnsRef" class="grid grid-cols-3 gap-1">
          <!-- Hours -->
          <div class="flex max-h-[200px] flex-col gap-px overflow-y-auto">
            <button
              v-for="h in hours"
              :key="h"
              type="button"
              class="tabular h-7 shrink-0 rounded-md text-sm transition-colors"
              :class="optionClass(h === selectedHour)"
              :data-selected="h === selectedHour || undefined"
              @click="selectHour(h)"
            >
              {{ h.toString().padStart(2, '0') }}
            </button>
          </div>

          <!-- Minutes -->
          <div class="flex max-h-[200px] flex-col gap-px overflow-y-auto">
            <button
              v-for="m in minutes"
              :key="m"
              type="button"
              class="tabular h-7 shrink-0 rounded-md text-sm transition-colors"
              :class="optionClass(m === selectedMinute)"
              :data-selected="m === selectedMinute || undefined"
              @click="selectMinute(m)"
            >
              {{ m.toString().padStart(2, '0') }}
            </button>
          </div>

          <!-- AM/PM -->
          <div class="flex flex-col gap-px">
            <button
              v-for="period in (['AM', 'PM'] as const)"
              :key="period"
              type="button"
              class="h-7 shrink-0 rounded-md text-sm transition-colors"
              :class="optionClass(selectedPeriod === period)"
              @click="selectPeriod(period)"
            >
              {{ period }}
            </button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Clock, ChevronDown } from 'lucide-vue-next';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';

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
const columnsRef = ref<HTMLElement | null>(null);
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

function optionClass(selected: boolean) {
  return selected ? 'bg-brand-soft font-semibold text-brand' : 'text-fg-muted hover:bg-surface-hover hover:text-fg';
}

/** Keep focus on the trigger and bring the current hour/minute into view. */
function onOpen(event: Event) {
  event.preventDefault();
  nextTick(() => {
    columnsRef.value?.querySelectorAll<HTMLElement>('[data-selected]').forEach((el) => {
      el.scrollIntoView({ block: 'center' });
    });
  });
}

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

watch(() => props.modelValue, (newValue) => {
  parseValue(newValue);
}, { immediate: true });
</script>
