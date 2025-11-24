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

  function calculateDropdownPosition() {
    if (!triggerRef.value) return;

    const rect = triggerRef.value.getBoundingClientRect();
    const dropdownHeight = 300; // max-height estimate or limit
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spacing = 4;

    // Check if there's enough space below
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: string;
    let maxHeight = '300px';

    // If not enough space below but enough space above, show above
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      // Position above
      // We can't know the exact height before rendering, but we can set bottom or max-height
      // For simplicity with the existing logic, let's just try to fit it above
      const availableHeight = spaceAbove - spacing;
      maxHeight = `${Math.min(dropdownHeight, availableHeight)}px`;

      // We need to wait for render to know height if we want to position 'top' correctly relative to height
      // But since we use fixed positioning, we can just set 'bottom' relative to viewport if we wanted
      // However, existing logic uses top.

      // Let's use a smarter approach: set top based on estimated height, or better, use nextTick if we can.
      // Since we can't easily await render in this sync function, we'll just set max height and position above if strictly necessary
      // But actually, the original code had this logic:
      // top = `${rect.top - dropdownHeight - spacing}px`;
      // This assumes the dropdown IS dropdownHeight tall. If it's shorter, it floats high.

      // Better logic: Position it below by default, only flip if strictly needed and constrain height.
      if (spaceBelow < 200) {
        // arbitrary threshold
        // Position above
        // We'll set 'bottom' instead of 'top' for better behavior if height varies
        // But the style binding uses top. Let's stick to top/left for now but maybe calculate after open?
        // Let's stick to "below" with max-height constraint for simplicity unless it's really tight
        if (spaceBelow < 100) {
          // Force above?
          // For now, let's just constrain height below
          maxHeight = `${Math.max(100, spaceBelow - spacing)}px`;
          top = `${rect.bottom + spacing}px`;
        } else {
          maxHeight = `${spaceBelow - spacing}px`;
          top = `${rect.bottom + spacing}px`;
        }
      } else {
        top = `${rect.bottom + spacing}px`;
        maxHeight = `${Math.min(dropdownHeight, spaceBelow - spacing)}px`;
      }
    } else {
      // Show below
      top = `${rect.bottom + spacing}px`;
      // If it would go off the bottom, limit the height
      if (rect.bottom + spacing + dropdownHeight > viewportHeight) {
        maxHeight = `${spaceBelow - spacing}px`;
      }
    }

    // Handle horizontal positioning
    let left = `${rect.left}px`;
    let width = 'auto';
    let minWidth = `${rect.width}px`;

    // Check if it would go off the right edge
    if (rect.left + rect.width > viewportWidth) {
      left = `${viewportWidth - rect.width - spacing}px`;
    }

    // Check if it would go off the left edge
    if (rect.left < 0) {
      left = `${spacing}px`;
    }

    dropdownPosition.value = {
      top,
      left,
      width,
      minWidth,
      maxHeight,
    };
  }

  // Improved position calculation that runs after open
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
