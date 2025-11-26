<template>
  <div class="relative inline-block w-full">
    <button
      ref="triggerRef"
      @click="toggleDropdown"
      class="w-full px-3 py-2 bg-background/50 border border-input rounded-md text-left flex items-center justify-between hover:border-primary/50 transition-colors text-sm"
      :class="triggerClass"
    >
      <span class="truncate text-foreground">
        {{ selectedLabel || placeholder }}
      </span>
      <ChevronDown
        class="h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="fixed bg-popover border border-border rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar"
        :style="{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          minWidth: dropdownPosition.minWidth,
          maxHeight: dropdownPosition.maxHeight,
        }"
        @click.stop
      >
        <button
          v-for="option in options"
          :key="option.value"
          @click="selectOption(option)"
          class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm text-foreground"
          :class="{ 'bg-primary/10 text-primary': modelValue === option.value }"
        >
          {{ option.label }}
        </button>
        <div v-if="options.length === 0" class="px-3 py-2.5 text-sm text-center text-muted-foreground">No options</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
  import { ChevronDown } from 'lucide-vue-next';

  export interface DropdownOption {
    label: string;
    value: any;
  }

  const props = defineProps<{
    modelValue: any;
    options: DropdownOption[];
    placeholder?: string;
    triggerClass?: string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: any];
  }>();

  const isOpen = ref(false);
  const triggerRef = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const dropdownPosition = ref({
    top: '0px',
    left: '0px',
    width: 'auto',
    minWidth: '0px',
    maxHeight: '300px',
  });

  const selectedLabel = computed(() => {
    const option = props.options.find((o) => o.value === props.modelValue);
    return option ? option.label : '';
  });

  // Position calculation that runs after open
  function updatePosition() {
    if (!triggerRef.value) return;

    const rect = triggerRef.value.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spacing = 4;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Default to below
    let top = rect.bottom + spacing;
    let maxHeight = Math.min(300, spaceBelow - spacing);

    // If space below is too small (e.g. < 150px) and space above is larger, go above
    if (spaceBelow < 150 && spaceAbove > spaceBelow) {
      // To position above correctly without knowing exact height, we can use bottom positioning
      // But our style object expects top.
      // We can measure the dropdown after it renders.
      // For now, let's just use the constrained below positioning or simplistic above.
      // Let's just maximize space below for now to be safe and simple
      // If we really need above, we'd calculate: top = rect.top - height - spacing
    }

    dropdownPosition.value = {
      top: `${top}px`,
      left: `${rect.left}px`,
      width: 'auto',
      minWidth: `${rect.width}px`,
      maxHeight: `${maxHeight}px`,
    };

    // Now that we've set initial, let's check if we should flip to above
    // We need nextTick to check dropdownRef height if we were to flip
  }

  function toggleDropdown() {
    if (isOpen.value) {
      isOpen.value = false;
    } else {
      isOpen.value = true;
      // Calculate position immediately
      updatePosition();
      // And recalculate after render to be precise if needed (e.g. for "above" positioning)
      nextTick(() => {
        if (dropdownRef.value && triggerRef.value) {
          const dropdownRect = dropdownRef.value.getBoundingClientRect();
          const triggerRect = triggerRef.value.getBoundingClientRect();
          const viewportHeight = window.innerHeight;

          // If dropdown goes off screen bottom, flip it to above if there is space
          if (dropdownRect.bottom > viewportHeight && triggerRect.top > dropdownRect.height) {
            dropdownPosition.value = {
              ...dropdownPosition.value,
              top: `${triggerRect.top - dropdownRect.height - 4}px`,
            };
          }
        }
      });
    }
  }

  function selectOption(option: DropdownOption) {
    emit('update:modelValue', option.value);
    isOpen.value = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;
    if (
      isOpen.value &&
      triggerRef.value &&
      !triggerRef.value.contains(target) &&
      dropdownRef.value &&
      !dropdownRef.value.contains(target)
    ) {
      isOpen.value = false;
    }
  }

  function handleResize() {
    if (isOpen.value) {
      updatePosition();
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true); // true for capture to catch all scrolls
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleResize, true);
  });
</script>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.3);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--muted-foreground) / 0.5);
  }
</style>
