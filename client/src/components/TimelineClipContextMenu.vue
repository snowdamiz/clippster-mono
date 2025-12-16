<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="show"
        ref="menuRef"
        class="timeline-context-menu fixed z-[100] min-w-[160px] rounded-lg border border-white/10 bg-[#1a1a1a]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
        :style="menuStyle"
        @contextmenu.prevent
      >
        <!-- Menu Header -->
        <div class="px-3 py-2 border-b border-white/5 bg-white/[0.02]">
          <div class="text-xs font-medium text-white/60 truncate">{{ clipTitle }}</div>
        </div>

        <!-- Menu Items -->
        <div class="py-1">
          <button
            class="context-menu-item w-full px-3 py-2 flex items-center gap-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors duration-150"
            @click="handlePlayClip"
          >
            <Play :size="16" class="flex-shrink-0 opacity-70" />
            <span class="flex-1 text-left">Play Clip</span>
          </button>

          <div class="h-px bg-white/5 mx-2 my-1"></div>

          <button
            class="context-menu-item w-full px-3 py-2 flex items-center gap-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors duration-150"
            @click="handleEditClip"
          >
            <Edit :size="16" class="flex-shrink-0 opacity-70" />
            <span class="flex-1 text-left">Edit Clip</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Backdrop for closing menu -->
    <div v-if="show" class="fixed inset-0 z-[99]" @click="emit('close')" @contextmenu.prevent="emit('close')"></div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { Play, Edit } from 'lucide-vue-next';
  import type { ClipContextMenuInfo } from '../types';

  const props = defineProps<{
    show: boolean;
    info: ClipContextMenuInfo | null;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'playClip', clipId: string): void;
    (e: 'editClip', clipId: string): void;
  }>();

  const menuRef = ref<HTMLElement | null>(null);

  // Extract info for display
  const clipTitle = computed(() => props.info?.clipTitle || 'Clip');

  // Calculate menu position to stay within viewport
  const menuStyle = computed(() => {
    if (!props.info) return {};

    const padding = 8;
    const menuWidth = 180;
    const menuHeight = 100; // Approximate height

    let x = props.info.x;
    let y = props.info.y;

    // Adjust if menu would go off screen
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    // Ensure minimum position
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    return {
      left: `${x}px`,
      top: `${y}px`,
    };
  });

  // Handle play clip action
  function handlePlayClip() {
    if (!props.info) return;
    emit('playClip', props.info.clipId);
    emit('close');
  }

  // Handle edit clip action
  function handleEditClip() {
    if (!props.info) return;
    emit('editClip', props.info.clipId);
    emit('close');
  }

  // Handle keyboard events
  function handleKeyDown(event: KeyboardEvent) {
    if (!props.show) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      emit('close');
    }
  }

  // Setup and cleanup keyboard listener
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Close menu on scroll
  watch(
    () => props.show,
    (show) => {
      if (show) {
        const handleScroll = () => emit('close');
        window.addEventListener('scroll', handleScroll, true);

        // Cleanup when menu closes
        watch(
          () => props.show,
          (stillShow) => {
            if (!stillShow) {
              window.removeEventListener('scroll', handleScroll, true);
            }
          },
          { once: true }
        );
      }
    }
  );
</script>

<style scoped>
  /* Context menu entrance animation */
  .context-menu-enter-active {
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .context-menu-leave-active {
    transition: all 0.1s ease-in;
  }

  .context-menu-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }

  .context-menu-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Menu container styling */
  .timeline-context-menu {
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 10px 40px -10px rgba(0, 0, 0, 0.5),
      0 20px 60px -20px rgba(0, 0, 0, 0.4);
  }

  /* Menu item hover effect */
  .context-menu-item {
    position: relative;
  }

  .context-menu-item::before {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    top: 0;
    bottom: 0;
    border-radius: 4px;
    background: transparent;
    transition: background-color 0.15s ease;
    z-index: -1;
  }

  .context-menu-item:hover:not(:disabled)::before {
    background: rgba(255, 255, 255, 0.08);
  }

  .context-menu-item:active:not(:disabled)::before {
    background: rgba(255, 255, 255, 0.12);
  }
</style>
