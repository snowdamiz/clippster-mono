<template>
  <div class="relative inline-block w-full">
    <button
      type="button"
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

    const spaceBelow = viewportHeight - rect.bottom - spacing;
    const spaceAbove = rect.top - spacing;

    // Decide direction: open above if not enough room below and more room above
    const openAbove = spaceBelow < 150 && spaceAbove > spaceBelow;

    if (openAbove) {
      const maxHeight = Math.min(300, spaceAbove);
      dropdownPosition.value = {
        top: 'auto',
        left: `${rect.left}px`,
        width: 'auto',
        minWidth: `${rect.width}px`,
        maxHeight: `${maxHeight}px`,
      };
    } else {
      const maxHeight = Math.min(300, spaceBelow);
      dropdownPosition.value = {
        top: `${rect.bottom + spacing}px`,
        left: `${rect.left}px`,
        width: 'auto',
        minWidth: `${rect.width}px`,
        maxHeight: `${maxHeight}px`,
      };
    }

    return openAbove;
  }

  function toggleDropdown() {
    if (isOpen.value) {
      isOpen.value = false;
    } else {
      isOpen.value = true;
      const openAbove = updatePosition();
      // After render, position above precisely using actual dropdown height
      nextTick(() => {
        if (openAbove && dropdownRef.value && triggerRef.value) {
          const triggerRect = triggerRef.value.getBoundingClientRect();
          const dropdownHeight = dropdownRef.value.offsetHeight;
          dropdownPosition.value = {
            ...dropdownPosition.value,
            top: `${triggerRect.top - dropdownHeight - 4}px`,
          };
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
