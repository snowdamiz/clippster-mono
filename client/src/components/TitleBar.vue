<template>
  <!-- Custom titlebar for all platforms with OS-specific styling -->
  <div
    class="titlebar"
    :class="{
      'titlebar-dark': isDark,
      'titlebar-linux': isLinux,
      'titlebar-windows': isWindows,
      'titlebar-macos': isMacOS,
    }"
  >
    <!-- Drag region -->
    <div class="titlebar-drag-region" data-tauri-drag-region>
      <!-- App logo -->
      <div class="titlebar-app-info">
        <img src="/logo.svg" alt="Clippster" class="titlebar-logo" />
      </div>
    </div>

    <!-- Window controls -->
    <div
      class="titlebar-controls"
      :class="{
        'titlebar-controls-linux': isLinux,
        'titlebar-controls-windows': isWindows,
        'titlebar-controls-macos': isMacOS,
      }"
    >
      <!-- macOS controls (left side) -->
      <template v-if="isMacOS">
        <button class="titlebar-button titlebar-close macos-close" @click="closeWindow" title="Close"></button>
        <button
          class="titlebar-button titlebar-minimize macos-minimize"
          @click="minimizeWindow"
          title="Minimize"
        ></button>
        <button
          class="titlebar-button titlebar-maximize macos-maximize"
          @click="toggleMaximize"
          :title="isMaximized ? 'Restore' : 'Maximize'"
        ></button>
      </template>

      <!-- Linux controls (right side) -->
      <template v-else-if="isLinux">
        <!-- Keyboard shortcuts button (left of normal controls) -->
        <button
          class="titlebar-button titlebar-keyboard-button linux-keyboard"
          @click="openKeyboardShortcuts"
          title="Keyboard Shortcuts"
        >
          <KeyboardIcon :size="14" />
        </button>

        <div class="titlebar-divider"></div>

        <button class="titlebar-button titlebar-minimize linux-minimize" @click="minimizeWindow" title="Minimize">
          <img src="/minimize.svg" alt="Minimize" class="titlebar-icon" />
        </button>

        <button
          class="titlebar-button titlebar-maximize linux-maximize"
          @click="toggleMaximize"
          :title="isMaximized ? 'Restore' : 'Maximize'"
        >
          <img v-if="!isMaximized" src="/maximize.svg" alt="Maximize" class="titlebar-icon" />
          <img v-else src="/shrink.svg" alt="Restore" class="titlebar-icon" />
        </button>

        <button class="titlebar-button titlebar-close linux-close" @click="closeWindow" title="Close">
          <img src="/close.svg" alt="Close" class="titlebar-icon" />
        </button>
      </template>

      <!-- Windows controls (right side) -->
      <template v-else>
        <!-- Keyboard shortcuts button (left of normal controls) -->
        <button
          class="titlebar-button titlebar-keyboard-button windows-keyboard"
          @click="openKeyboardShortcuts"
          :title="isDark ? 'Keyboard Shortcuts' : ''"
        >
          <KeyboardIcon :size="14" />
        </button>

        <div class="titlebar-divider windows-divider"></div>

        <button class="titlebar-button titlebar-minimize" @click="minimizeWindow" :title="isDark ? 'Minimize' : ''">
          <img src="/minimize.svg" alt="Minimize" class="titlebar-icon" />
        </button>

        <button
          class="titlebar-button titlebar-maximize"
          @click="toggleMaximize"
          :title="isDark ? (isMaximized ? 'Restore' : 'Maximize') : ''"
        >
          <img v-if="!isMaximized" src="/maximize.svg" alt="Maximize" class="titlebar-icon" />
          <img v-else src="/shrink.svg" alt="Restore" class="titlebar-icon" />
        </button>

        <button class="titlebar-button titlebar-close" @click="closeWindow" :title="isDark ? 'Close' : ''">
          <img src="/close.svg" alt="Close" class="titlebar-icon" />
        </button>
      </template>
    </div>

    <!-- macOS Keyboard shortcuts button (positioned at right edge) -->
    <button
      v-if="isMacOS"
      class="titlebar-button titlebar-keyboard-button macos-keyboard-edge"
      @click="openKeyboardShortcuts"
      title="Keyboard Shortcuts"
    >
      <KeyboardIcon :size="14" />
    </button>

    <!-- Keyboard Shortcuts Dialog -->
    <Teleport to="body">
      <div
        v-if="showKeyboardShortcuts"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="showKeyboardShortcuts = false"
      >
        <div
          class="bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-border">
            <h2 class="text-xl font-bold text-foreground">Keyboard Shortcuts</h2>
            <button @click="showKeyboardShortcuts = false" class="p-2 hover:bg-muted rounded-lg transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-foreground/70 hover:text-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <!-- Timeline Shortcuts -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-foreground mb-3">Timeline Editing</h3>
              <div class="grid grid-cols-1 gap-2">
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Activate Cut Tool</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">X</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Deactivate Cut Tool</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Esc</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Merge Selected Segments</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">J</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Move Segments Left/Right</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">← →</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Seek Playhead</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">← →</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Delete Selected Segments</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Backspace</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Multi-Select Segments</span>
                  <div class="flex gap-1">
                    <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Ctrl</kbd>
                    <span class="text-foreground/70">+</span>
                    <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Click</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- Timeline Navigation -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-foreground mb-3">Timeline Navigation</h3>
              <div class="grid grid-cols-1 gap-2">
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Horizontal Scroll</span>
                  <div class="flex gap-1">
                    <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Ctrl</kbd>
                    <span class="text-foreground/70">+</span>
                    <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Scroll</kbd>
                  </div>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Vertical Scroll</span>
                  <div class="flex gap-1">
                    <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Alt</kbd>
                    <span class="text-foreground/70">+</span>
                    <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Scroll</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- Video Player -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-foreground mb-3">Video Player</h3>
              <div class="grid grid-cols-1 gap-2">
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Play/Pause</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Space</kbd>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-border/50">
                  <span class="text-foreground">Close Video Player</span>
                  <kbd class="px-2 py-1 bg-muted text-foreground rounded text-sm font-mono">Esc</kbd>
                </div>
              </div>
            </div>

            <!-- Platform Notes -->
            <div class="mt-6 p-4 bg-muted/30 rounded-lg">
              <p class="text-sm text-muted-foreground">
                <strong>Note:</strong>
                <kbd>Ctrl</kbd>
                on Windows/Linux functions as
                <kbd>Cmd</kbd>
                on macOS for multi-selection and scrolling.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { invoke } from '@tauri-apps/api/core';
  import { KeyboardIcon } from 'lucide-vue-next';

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
  const showKeyboardShortcuts = ref(false);

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
        isMacOS.value = platform === 'darwin';
        isLinux.value = platform === 'linux';
        isWindows.value = platform === 'windows';
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

  // Cleanup event listener on unmount
  onUnmounted(() => {
    window.removeEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);
  });
</script>

<style scoped>
  .titlebar-divider {
    width: 1px;
    height: 16px;
    background-color: #3c3c3c;
    margin-right: 6px;
  }

  .titlebar-divider.windows-divider {
    margin-left: 6px;
  }

  .titlebar {
    height: 32px;
    background: #202020;
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
    border-bottom: 1px solid #3c3c3c;
    box-sizing: border-box;
  }

  .titlebar-dark {
    background: #070707;
    border-bottom-color: #333;
  }

  /* Linux-specific styling */
  .titlebar-linux {
    background: #202020;
    border-bottom: 1px solid #3c3c3c;
    height: 32px;
  }

  .titlebar-linux.titlebar-dark {
    background: #070707;
    border-bottom-color: #333;
  }

  /* macOS-specific styling */
  .titlebar-macos {
    background: #202020;
    border-bottom: 1px solid #3c3c3c;
    height: 32px;
    margin-right: -12px;
  }

  .titlebar-macos.titlebar-dark {
    background: #070707;
    border-bottom-color: #333;
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

  /* macOS app info positioning - center content and avoid window controls */
  .titlebar-macos .titlebar-app-info {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    padding-left: 0;
  }

  .titlebar-logo {
    height: 14px;
    width: auto;
    filter: brightness(0) invert(1); /* Make logo white for dark titlebar */
    opacity: 0.9;
  }

  .titlebar-keyboard-button {
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.1s ease;
  }

  .titlebar-keyboard-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 1);
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

  /* Linux window controls styling */
  .titlebar-controls-linux {
    gap: 6px;
    padding-right: 12px;
    align-items: center;
  }

  .linux-keyboard {
    margin-right: -6px;
  }

  .linux-minimize {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #efbf5c;
    border: none;
    position: relative;
  }

  .linux-minimize:hover {
    background: #f5ca6b;
  }

  .linux-maximize {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #57c255;
    border: none;
    position: relative;
  }

  .linux-maximize:hover {
    background: #6dd36a;
  }

  .linux-close {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff5f56;
    border: none;
    position: relative;
  }

  .linux-close:hover {
    background: #ff7b75;
  }

  /* Linux icons should be hidden and use CSS for shapes */
  .linux-minimize .titlebar-icon,
  .linux-maximize .titlebar-icon,
  .linux-close .titlebar-icon {
    display: none;
  }

  /* Windows-specific styling */
  .titlebar-windows {
    background: #202020;
    border-bottom: 1px solid #3c3c3c;
  }

  .titlebar-windows.titlebar-dark {
    background: #070707;
    border-bottom-color: #333;
  }

  .titlebar-controls-windows {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* macOS window controls styling */
  .titlebar-controls-macos {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 8px;
    padding: 0;
    -webkit-app-region: no-drag;
    height: auto;
  }

  /* macOS keyboard button positioned on the right edge of titlebar */
  .macos-keyboard-edge {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
  }

  /* macOS traffic light buttons */
  .macos-close,
  .macos-minimize,
  .macos-maximize {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .macos-close {
    background: #ff5f57;
    border: 1px solid #e0443e;
  }

  .macos-close:hover {
    background: #ff6b63;
    border-color: #e8554e;
  }

  .macos-minimize {
    background: #ffbd2e;
    border: 1px solid #dea123;
  }

  .macos-minimize:hover {
    background: #ffca42;
    border-color: #e5a923;
  }

  .macos-maximize {
    background: #28ca42;
    border: 1px solid #12ac28;
  }

  .macos-maximize:hover {
    background: #3dd659;
    border-color: #2bc245;
  }

  @media (any-hover: none) {
    .titlebar-button {
      width: 46px;
    }
  }

  /* macOS-specific adjustments for better theme integration */
  @media (prefers-color-scheme: dark) {
    .titlebar-macos:not(.titlebar-dark) {
      background: #070707;
      border-bottom-color: #333;
    }
  }

  @media (prefers-color-scheme: light) {
    .titlebar-macos:not(.titlebar-dark) {
      background: rgba(248, 248, 248, 0.9);
      border-bottom-color: rgba(0, 0, 0, 0.15);
    }
  }
</style>
