<template>
  <!-- Custom window chrome. Shares the canvas color with the sidebar so the
       content panel reads as a single inset surface. -->
  <div
    class="titlebar fixed inset-x-0 top-0 z-[99999] flex h-[var(--titlebar-height)] select-none items-center bg-canvas text-fg-muted"
    :class="{ 'titlebar-macos': isMacOS, 'titlebar-windows': isWindows, 'titlebar-linux': isLinux }"
  >
    <!-- Left cluster: traffic lights (macOS) + sidebar toggle -->
    <div class="no-drag relative z-10 flex h-full items-center gap-1" :class="isMacOS ? 'pl-3' : 'pl-2'">
      <div v-if="isMacOS" class="traffic-lights mr-3 flex items-center gap-2">
        <button class="traffic-light traffic-light--close" title="Close" @click="closeWindow"></button>
        <button class="traffic-light traffic-light--minimize" title="Minimize" @click="minimizeWindow"></button>
        <button
          class="traffic-light traffic-light--maximize"
          :title="isMaximized ? 'Restore' : 'Zoom'"
          @click="toggleMaximize"
        ></button>
      </div>
      <button
        class="chrome-btn"
        :title="isCollapsed ? 'Show sidebar' : 'Hide sidebar'"
        :aria-label="isCollapsed ? 'Show sidebar' : 'Hide sidebar'"
        @click="toggleSidebar"
      >
        <PanelLeft v-if="isCollapsed" :size="15" />
        <PanelLeftClose v-else :size="15" />
      </button>
    </div>

    <!-- Drag region with centered brand -->
    <div class="absolute inset-0 flex items-center justify-center" data-tauri-drag-region>
      <AppBrand class="pointer-events-none opacity-80" />
    </div>

    <!-- Right cluster: utilities + window controls (Windows/Linux) -->
    <div class="no-drag relative z-10 ml-auto flex h-full items-center">
      <ChatFab v-if="showChatButton" compact class="mr-0.5" />
      <button
        v-if="!isFullScreenEditor"
        class="chrome-btn mr-1"
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
        @click="openKeyboardShortcuts"
      >
        <KeyboardIcon :size="15" />
      </button>
      <template v-if="!isMacOS">
        <div class="mx-1 h-4 w-px bg-line"></div>
        <button class="window-btn" title="Minimize" aria-label="Minimize" @click="minimizeWindow">
          <Minus :size="14" />
        </button>
        <button
          class="window-btn"
          :title="isMaximized ? 'Restore' : 'Maximize'"
          :aria-label="isMaximized ? 'Restore' : 'Maximize'"
          @click="toggleMaximize"
        >
          <Copy v-if="isMaximized" :size="12" class="-scale-x-100" />
          <Square v-else :size="12" />
        </button>
        <button class="window-btn window-btn--close" title="Close" aria-label="Close" @click="closeWindow">
          <X :size="15" />
        </button>
      </template>
      <div v-else class="w-2"></div>
    </div>

    <KeyboardShortcutsDialog v-model:open="showKeyboardShortcuts" />
  </div>
</template>

<script setup lang="ts">
  import AppBrand from './AppBrand.vue';
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { invoke } from '@tauri-apps/api/core';
  import { KeyboardIcon, PanelLeftClose, PanelLeft, Minus, Square, Copy, X } from 'lucide-vue-next';
  import KeyboardShortcutsDialog from './KeyboardShortcutsDialog.vue';
  import ChatFab from './chat/ChatFab.vue';
  import { useChatPopout } from '@/composables/useChatPopout';
  import { useSidebarState } from '@/composables/useSidebarState';

  // Props
  interface Props {
    darkMode?: boolean;
    platformOverride?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    darkMode: true,
    platformOverride: 'auto',
  });

  // Reactive state
  const isDark = ref(props.darkMode);
  const isMaximized = ref(false);
  const isMacOS = ref(false);
  const isLinux = ref(false);
  const isWindows = ref(false);
  const platformOverride = ref(props.platformOverride);
  const appWindow = getCurrentWebviewWindow();
  let resizeUnlisten: (() => void) | null = null;
  let maximizeStateSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let maximizeStateSyncInFlight = false;
  let maximizeStateSyncQueued = false;
  const showKeyboardShortcuts = ref(false);
  const { isVisible: isChatVisible, showFab } = useChatPopout();
  // Full-screen editors render their own chat and shortcuts buttons in their header.
  const isFullScreenEditor = computed(() => !showFab.value);
  const showChatButton = computed(() => isChatVisible.value && !isFullScreenEditor.value);
  const { isCollapsed, toggle: toggleSidebar } = useSidebarState();

  // Window control functions
  async function minimizeWindow() {
    try {
      await appWindow.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  }

  async function toggleMaximize() {
    try {
      const currentlyMaximized = await appWindow.isMaximized();

      if (currentlyMaximized) {
        await appWindow.unmaximize();
        isMaximized.value = false;
      } else {
        await appWindow.maximize();
        isMaximized.value = true;
      }
    } catch (error) {
      console.error('Failed to toggle maximize:', error);
    }
  }

  async function closeWindow() {
    try {
      await appWindow.close();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }

  function openKeyboardShortcuts() {
    showKeyboardShortcuts.value = true;
  }

  // Function to update platform flags based on current override or detected platform
  const updatePlatformFlags = (overridePlatform: string) => {
    if (overridePlatform === 'auto') {
      // Use auto-detection (will be set asynchronously)
      return;
    }

    console.log(`🎨 TitleBar - Using platform override: ${overridePlatform}`);

    // Reset all platform flags first
    isMacOS.value = false;
    isLinux.value = false;
    isWindows.value = false;

    // Set the override platform
    switch (overridePlatform) {
      case 'macos':
        isMacOS.value = true;
        break;
      case 'linux':
        isLinux.value = true;
        break;
      case 'windows':
        isWindows.value = true;
        break;
      default:
        console.warn(`Unknown platform override: ${overridePlatform}`);
    }
  };

  // Initialize window state
  const handlePlatformOverride = (event: CustomEvent) => {
    const { platform } = event.detail;
    platformOverride.value = platform;
    updatePlatformFlags(platform);
  };

  async function syncMaximizeState() {
    if (maximizeStateSyncInFlight) {
      maximizeStateSyncQueued = true;
      return;
    }

    maximizeStateSyncInFlight = true;

    try {
      isMaximized.value = await appWindow.isMaximized();
    } catch (error) {
      console.error('Failed to sync maximize state:', error);
    } finally {
      maximizeStateSyncInFlight = false;

      if (maximizeStateSyncQueued) {
        maximizeStateSyncQueued = false;
        scheduleMaximizeStateSync(0);
      }
    }
  }

  function scheduleMaximizeStateSync(delayMs = 120) {
    if (maximizeStateSyncTimer !== null) {
      clearTimeout(maximizeStateSyncTimer);
    }

    maximizeStateSyncTimer = setTimeout(() => {
      maximizeStateSyncTimer = null;
      void syncMaximizeState();
    }, delayMs);
  }

  onMounted(async () => {
    try {
      // Add event listener for platform override
      window.addEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);

      // Apply initial platform override if set
      if (platformOverride.value !== 'auto') {
        updatePlatformFlags(platformOverride.value);
      } else {
        // Detect platform only if no override is set
        const platform = (await invoke('get_platform')) as string;
        isMacOS.value = platform === 'macos';
        isLinux.value = platform === 'linux';
        isWindows.value = platform === 'windows';
      }

      // Check if window is maximized on mount
      await syncMaximizeState();

      // macOS can get drag jitter if we poll maximize state during/after resize.
      // Restrict resize-driven maximize sync to non-macOS platforms.
      if (!isMacOS.value) {
        resizeUnlisten = await appWindow.onResized(() => {
          scheduleMaximizeStateSync();
        });
      }
    } catch (error) {
      console.error('Failed to initialize titlebar:', error);
    }
  });

  // Cleanup event listener on unmount
  onUnmounted(() => {
    window.removeEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);

    if (maximizeStateSyncTimer !== null) {
      clearTimeout(maximizeStateSyncTimer);
      maximizeStateSyncTimer = null;
    }

    if (resizeUnlisten) {
      resizeUnlisten();
      resizeUnlisten = null;
    }
  });
</script>

<style scoped>
  .no-drag {
    -webkit-app-region: no-drag;
  }

  [data-tauri-drag-region] {
    -webkit-app-region: drag;
  }

  .chrome-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 24px;
    border-radius: 6px;
    color: var(--fg-subtle);
    transition: background-color 120ms ease,
      color 120ms ease;
  }

  .chrome-btn:hover {
    background: var(--surface-hover);
    color: var(--fg);
  }

  .window-btn {
    display: grid;
    place-items: center;
    width: 44px;
    height: 100%;
    color: var(--fg-muted);
    transition: background-color 120ms ease,
      color 120ms ease;
  }

  .window-btn:hover {
    background: var(--surface-active);
    color: var(--fg);
  }

  .window-btn--close:hover {
    background: #e81123;
    color: #fff;
  }

  /* macOS traffic lights: neutral until the cluster is hovered */
  .traffic-light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #2c3039;
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.35);
    transition: background-color 120ms ease;
  }

  .traffic-lights:hover .traffic-light--close {
    background: #ff5f57;
  }

  .traffic-lights:hover .traffic-light--minimize {
    background: #febc2e;
  }

  .traffic-lights:hover .traffic-light--maximize {
    background: #28c840;
  }
</style>
