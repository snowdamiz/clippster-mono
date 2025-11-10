<template>
  <!-- Custom titlebar for Windows/Linux, but hide on macOS where native titlebar is used -->
  <div v-if="!isMacOS" class="titlebar" :class="{ 'titlebar-dark': isDark }">
    <!-- Drag region -->
    <div class="titlebar-drag-region" data-tauri-drag-region>
      <!-- App logo -->
      <div class="titlebar-app-info">
        <img src="/logo.svg" alt="Clippster" class="titlebar-logo" />
      </div>
    </div>

    <!-- Window controls -->
    <div class="titlebar-controls">
      <button class="titlebar-button titlebar-minimize" @click="minimizeWindow" :title="isDark ? 'Minimize' : ''">
        <img src="/minimize.svg" alt="Minimize" class="titlebar-icon" />
      </button>

      <button
        class="titlebar-button titlebar-maximize"
        @click="toggleMaximize"
        :title="isDark ? (isMaximized ? 'Restore' : 'Maximize') : ''"
      >
        <!-- Maximize icon (square) -->
        <img v-if="!isMaximized" src="/maximize.svg" alt="Maximize" class="titlebar-icon" />
        <!-- Restore icon (overlapping squares) -->
        <img v-else src="/shrink.svg" alt="Restore" class="titlebar-icon" />
      </button>

      <button class="titlebar-button titlebar-close" @click="closeWindow" :title="isDark ? 'Close' : ''">
        <img src="/close.svg" alt="Close" class="titlebar-icon" />
      </button>
    </div>
  </div>

  <!-- Spacer for macOS to maintain proper layout -->
  <div v-else-if="isMacOS" class="macos-titlebar-spacer"></div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { invoke } from '@tauri-apps/api/core';

  // Props
  interface Props {
    darkMode?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    darkMode: true,
  });

  // Reactive state
  const isDark = ref(props.darkMode);
  const isMaximized = ref(false);
  const isMacOS = ref(false);
  const appWindow = getCurrentWebviewWindow();

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

  // Initialize window state
  onMounted(async () => {
    try {
      // Detect if running on macOS
      const platform = (await invoke('get_platform')) as string;
      isMacOS.value = platform === 'darwin';

      // On macOS, apply native window styling
      if (isMacOS.value) {
        await invoke('setup_macos_titlebar');
        // Update main content padding for macOS titlebar height
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
          mainContent.style.paddingTop = '28px'; // macOS titlebar is typically 28px
        }
      }

      // Check if window is maximized on mount
      isMaximized.value = await appWindow.isMaximized();

      // Listen for maximize state changes
      appWindow.listen('tauri://resize', async () => {
        isMaximized.value = await appWindow.isMaximized();
      });
    } catch (error) {
      console.error('Failed to initialize titlebar:', error);
    }
  });
</script>

<style scoped>
  .titlebar {
    height: 32px;
    background: #070707;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    border-bottom: 1px solid #333;
    box-sizing: border-box;
  }

  .titlebar-dark {
    background: #0f0f0f;
    border-bottom-color: #2a2a2a;
  }

  .titlebar-drag-region {
    flex: 1;
    display: flex;
    align-items: center;
    height: 100%;
    -webkit-app-region: drag;
  }

  .titlebar-app-info {
    display: flex;
    align-items: center;
    padding-left: 12px;
  }

  .titlebar-logo {
    height: 14px;
    width: auto;
    filter: brightness(0) invert(1); /* Make logo white for dark titlebar */
    opacity: 0.9;
  }

  .titlebar-controls {
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  .titlebar-button {
    width: 40px;
    height: 100%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s ease;
  }

  .titlebar-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 1);
  }

  .titlebar-close:hover {
    background: #e81123;
    color: white;
  }

  .titlebar-minimize:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .titlebar-maximize:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .titlebar-icon {
    width: 10px;
    height: 10px;
    filter: brightness(0) invert(1);
    opacity: 0.7;
    transition: all 0.1s ease;
  }

  .titlebar-button:hover .titlebar-icon {
    opacity: 1;
  }

  /* Windows-specific styling */
  @media (any-hover: none) {
    .titlebar-button {
      width: 46px;
    }
  }

  /* macOS-specific adjustments */
  @media (prefers-color-scheme: dark) {
    .titlebar {
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(20px);
    }
  }

  /* macOS spacer - transparent area to maintain layout */
  .macos-titlebar-spacer {
    height: 28px; /* Standard macOS titlebar height */
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9998;
    -webkit-app-region: drag;
  }
</style>
