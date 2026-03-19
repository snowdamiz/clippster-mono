<template>
  <div class="relative inline-block w-full">
    <button
      type="button"
      ref="triggerRef"
      @click="toggleDropdown"
      class="custom-dropdown__trigger"
      :class="triggerClass"
    >
      <span class="truncate">
        {{ selectedLabel || placeholder }}
      </span>
      <ChevronDown
        class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ml-2"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="custom-dropdown__menu"
        :style="{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          bottom: dropdownPosition.bottom,
          width: dropdownPosition.width,
          minWidth: dropdownPosition.minWidth,
          maxHeight: dropdownPosition.maxHeight,
        }"
        @click.stop
      >
        <div
          v-for="option in options"
          :key="option.value"
          class="custom-dropdown__item-wrapper"
          :class="{ 'custom-dropdown__item-wrapper--selected': modelValue === option.value }"
        >
          <button
            @click="selectOption(option)"
            class="custom-dropdown__item"
            :class="{ 'custom-dropdown__item--selected': modelValue === option.value }"
          >
            {{ option.label }}
          </button>
          <button
            v-if="showDelete"
            @click="handleDelete(option, $event)"
            class="custom-dropdown__delete-btn"
            title="Delete template"
          >
            <XCircle :size="16" />
          </button>
        </div>
        <div v-if="options.length === 0" class="custom-dropdown__empty">No options</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
  import { ChevronDown, XCircle } from 'lucide-vue-next';

  export interface DropdownOption {
    label: string;
    value: any;
  }

  const props = defineProps<{
    modelValue: any;
    options: DropdownOption[];
    placeholder?: string;
    triggerClass?: string;
    showDelete?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: any];
    'delete': [value: any, event: Event];
  }>();

  const isOpen = ref(false);
  const triggerRef = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const dropdownPosition = ref({
    top: '0px',
    left: '0px',
    bottom: 'auto',
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
        bottom: 'auto',
        width: 'auto',
        minWidth: `${rect.width}px`,
        maxHeight: `${maxHeight}px`,
      };
    } else {
      const maxHeight = Math.min(300, spaceBelow);
      dropdownPosition.value = {
        top: `${rect.bottom + spacing}px`,
        left: `${rect.left}px`,
        bottom: 'auto',
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

  function handleDelete(option: DropdownOption, event: Event) {
    event.stopPropagation();
    emit('delete', option.value, event);
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
  /* ===== Trigger Button ===== */
  .custom-dropdown__trigger {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    text-align: left;
  }

  .custom-dropdown__trigger:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* ===== Dropdown Menu ===== */
  .custom-dropdown__menu {
    position: fixed;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10002;
    overflow-y: auto;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
  }

  .custom-dropdown__menu::-webkit-scrollbar {
    width: 6px;
  }

  .custom-dropdown__menu::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-dropdown__menu::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Dropdown Item Wrapper ===== */
  .custom-dropdown__item-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background-color 150ms ease;
  }

  .custom-dropdown__item-wrapper:hover {
    background-color: var(--sidebar-hover);
  }

  .custom-dropdown__item-wrapper--selected {
    background-color: rgba(6, 182, 212, 0.15);
  }

  /* ===== Dropdown Item ===== */
  .custom-dropdown__item {
    flex: 1;
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .custom-dropdown__item--selected {
    color: var(--sidebar-accent);
  }

  /* ===== Delete Button ===== */
  .custom-dropdown__delete-btn {
    padding: 0.625rem 0.75rem;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 150ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .custom-dropdown__delete-btn:hover {
    color: #ef4444;
  }

  /* ===== Empty State ===== */
  .custom-dropdown__empty {
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    text-align: center;
    color: var(--sidebar-text-muted);
  }
</style>
