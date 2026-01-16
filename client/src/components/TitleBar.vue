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
        <img src="/logo-titlebar.svg" alt="Clippster Logo Icon" class="titlebar-logo-icon" />
        <img src="/logo.svg" alt="Clippster Logo" class="titlebar-logo" />
        <!-- <span class="titlebar-beta-tag">Closed Beta</span> -->
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
      <Transition name="shortcuts-modal">
        <div v-if="showKeyboardShortcuts" class="shortcuts-modal__overlay" @click.self="showKeyboardShortcuts = false">
          <Transition name="shortcuts-dialog" appear>
            <div class="shortcuts-modal">
              <!-- Accent Bar -->
              <div class="shortcuts-modal__accent"></div>

              <!-- Header -->
              <div class="shortcuts-modal__header">
                <button class="shortcuts-modal__close" @click="showKeyboardShortcuts = false" title="Close">
                  <X :size="18" />
                </button>
                <div class="shortcuts-modal__icon">
                  <KeyboardIcon :size="24" />
                </div>
                <h2 class="shortcuts-modal__title">Shortcuts & Controls</h2>
                <p class="shortcuts-modal__subtitle">Keyboard and mouse shortcuts for efficient editing</p>
              </div>

              <!-- Tabs Navigation -->
              <div class="shortcuts-tabs">
                <button
                  class="shortcuts-tabs__item"
                  :class="{ 'shortcuts-tabs__item--active': activeShortcutTab === 'playback' }"
                  @click="activeShortcutTab = 'playback'"
                >
                  <Play :size="14" />
                  <span>Playback</span>
                </button>
                <button
                  class="shortcuts-tabs__item"
                  :class="{ 'shortcuts-tabs__item--active': activeShortcutTab === 'timeline' }"
                  @click="activeShortcutTab = 'timeline'"
                >
                  <ZoomIn :size="14" />
                  <span>Timeline</span>
                </button>
                <button
                  class="shortcuts-tabs__item"
                  :class="{ 'shortcuts-tabs__item--active': activeShortcutTab === 'selection' }"
                  @click="activeShortcutTab = 'selection'"
                >
                  <MousePointer :size="14" />
                  <span>Selection</span>
                </button>
                <button
                  class="shortcuts-tabs__item"
                  :class="{ 'shortcuts-tabs__item--active': activeShortcutTab === 'editing' }"
                  @click="activeShortcutTab = 'editing'"
                >
                  <Edit3 :size="14" />
                  <span>Editing</span>
                </button>
                <button
                  class="shortcuts-tabs__item"
                  :class="{ 'shortcuts-tabs__item--active': activeShortcutTab === 'cut' }"
                  @click="activeShortcutTab = 'cut'"
                >
                  <Scissors :size="14" />
                  <span>Cut Tool</span>
                </button>
                <button
                  class="shortcuts-tabs__item"
                  :class="{ 'shortcuts-tabs__item--active': activeShortcutTab === 'more' }"
                  @click="activeShortcutTab = 'more'"
                >
                  <MoreHorizontal :size="14" />
                  <span>More</span>
                </button>
              </div>

              <!-- Content -->
              <div class="shortcuts-content">
                <!-- Playback Tab -->
                <div v-if="activeShortcutTab === 'playback'" class="shortcuts-list">
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Play / Pause Video</span>
                    <kbd class="shortcuts-key">Space</kbd>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Play / Pause (Alternative)</span>
                    <span class="shortcuts-action">Click Video</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Seek Playhead (No Selection)</span>
                    <div class="shortcuts-list__keys">
                      <kbd class="shortcuts-key">← →</kbd>
                      <span class="shortcuts-list__hint">(Hold for 2x)</span>
                    </div>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Seek to Time Position</span>
                    <span class="shortcuts-action">Click Video Track</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Scrub Through Video</span>
                    <span class="shortcuts-action">Drag Playhead</span>
                  </div>
                </div>

                <!-- Timeline Tab -->
                <div v-else-if="activeShortcutTab === 'timeline'" class="shortcuts-list">
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Zoom In / Out</span>
                    <span class="shortcuts-action">Scroll on Ruler</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Zoom to Time Range</span>
                    <span class="shortcuts-action">Click + Drag Timeline</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Zoom Level Slider</span>
                    <span class="shortcuts-action">Drag Slider</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Pan Horizontally</span>
                    <div class="shortcuts-list__keys">
                      <kbd class="shortcuts-key">Ctrl</kbd>
                      <span class="shortcuts-list__separator">+</span>
                      <span class="shortcuts-action">Scroll</span>
                    </div>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Pan Vertically (Through Clips)</span>
                    <div class="shortcuts-list__keys">
                      <kbd class="shortcuts-key">Alt</kbd>
                      <span class="shortcuts-list__separator">+</span>
                      <span class="shortcuts-action">Scroll</span>
                    </div>
                  </div>
                </div>

                <!-- Selection Tab -->
                <div v-else-if="activeShortcutTab === 'selection'" class="shortcuts-list">
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Select Single Segment</span>
                    <span class="shortcuts-action">Click Segment</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Multi-Select Segments</span>
                    <div class="shortcuts-list__keys">
                      <kbd class="shortcuts-key">Ctrl</kbd>
                      <span class="shortcuts-list__separator">+</span>
                      <span class="shortcuts-action">Click Segments</span>
                    </div>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Deselect All Segments</span>
                    <span class="shortcuts-action">Click Empty Area</span>
                  </div>
                </div>

                <!-- Editing Tab -->
                <div v-else-if="activeShortcutTab === 'editing'" class="shortcuts-list">
                  <div class="shortcuts-section">
                    <h3 class="shortcuts-section__title">Keyboard Editing</h3>
                    <div class="shortcuts-section__items">
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Move Selected Segments</span>
                        <div class="shortcuts-list__keys">
                          <kbd class="shortcuts-key">← →</kbd>
                          <span class="shortcuts-list__hint">(Hold for 2x)</span>
                        </div>
                      </div>
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Delete Selected Segments</span>
                        <kbd class="shortcuts-key">Backspace</kbd>
                      </div>
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Merge Selected Segments</span>
                        <kbd class="shortcuts-key">J</kbd>
                      </div>
                    </div>
                  </div>

                  <div class="shortcuts-section">
                    <h3 class="shortcuts-section__title">Mouse Manipulation</h3>
                    <div class="shortcuts-section__items">
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Reorder Segment Position</span>
                        <span class="shortcuts-action">Drag Segment</span>
                      </div>
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Trim Segment Start/End</span>
                        <span class="shortcuts-action">Drag Segment Edge</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Cut Tool Tab -->
                <div v-else-if="activeShortcutTab === 'cut'" class="shortcuts-list">
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Toggle Cut Tool On/Off</span>
                    <kbd class="shortcuts-key">X</kbd>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Split Segment at Cursor</span>
                    <span class="shortcuts-action">Click Segment</span>
                  </div>
                  <div class="shortcuts-list__item">
                    <span class="shortcuts-list__label">Cancel Cut Tool</span>
                    <kbd class="shortcuts-key">Esc</kbd>
                  </div>
                </div>

                <!-- More Tab -->
                <div v-else-if="activeShortcutTab === 'more'" class="shortcuts-list">
                  <div class="shortcuts-section">
                    <h3 class="shortcuts-section__title">General</h3>
                    <div class="shortcuts-section__items">
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Exit Cut Tool / Close Dialogs</span>
                        <kbd class="shortcuts-key">Esc</kbd>
                      </div>
                    </div>
                  </div>

                  <div class="shortcuts-section">
                    <h3 class="shortcuts-section__title">Timeline Toolbar</h3>
                    <div class="shortcuts-section__items">
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Reverse 10 Seconds</span>
                        <span class="shortcuts-action">Hold Button</span>
                      </div>
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Forward 10 Seconds</span>
                        <span class="shortcuts-action">Hold Button</span>
                      </div>
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Cut Tool Button</span>
                        <span class="shortcuts-action">Click to Toggle</span>
                      </div>
                      <div class="shortcuts-list__item">
                        <span class="shortcuts-list__label">Merge Segments Button</span>
                        <span class="shortcuts-action">Click to Merge</span>
                      </div>
                    </div>
                  </div>

                  <!-- Legend -->
                  <div class="shortcuts-legend">
                    <div class="shortcuts-legend__card">
                      <div class="shortcuts-legend__header">
                        <kbd class="shortcuts-key shortcuts-key--sm">Key</kbd>
                        <span class="shortcuts-legend__title">Keyboard Shortcut</span>
                      </div>
                      <p class="shortcuts-legend__desc">Keys shown in monospace font</p>
                    </div>
                    <div class="shortcuts-legend__card">
                      <div class="shortcuts-legend__header">
                        <span class="shortcuts-action shortcuts-action--sm">Action</span>
                        <span class="shortcuts-legend__title">Mouse Action</span>
                      </div>
                      <p class="shortcuts-legend__desc">Actions shown in regular font</p>
                    </div>
                  </div>

                  <!-- Platform Note -->
                  <div class="shortcuts-note">
                    <div class="shortcuts-note__icon">
                      <Info :size="16" />
                    </div>
                    <p class="shortcuts-note__text">
                      <strong>Platform Note:</strong>
                      <kbd class="shortcuts-key shortcuts-key--inline">Ctrl</kbd>
                      on Windows/Linux functions as
                      <kbd class="shortcuts-key shortcuts-key--inline">Cmd</kbd>
                      on macOS for multi-selection and scrolling operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { invoke } from '@tauri-apps/api/core';
  import { KeyboardIcon, Play, ZoomIn, MousePointer, Edit3, Scissors, MoreHorizontal, X, Info } from 'lucide-vue-next';

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
  const activeShortcutTab = ref('playback');

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
        isMacOS.value = platform === 'macos';
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
    background-color: var(--sidebar-border);
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
    z-index: 99999;
    border-bottom: 1px solid var(--sidebar-border);
    box-sizing: border-box;
  }

  .titlebar-dark {
    background: #0a0a0b;
    border-bottom-color: var(--sidebar-border);
  }

  /* Linux-specific styling */
  .titlebar-linux {
    background: #0a0a0b;
    border-bottom: 1px solid var(--sidebar-border);
    height: 32px;
  }

  .titlebar-linux.titlebar-dark {
    background: #0a0a0b;
    border-bottom-color: var(--sidebar-border);
  }

  /* macOS-specific styling */
  .titlebar-macos {
    background: #0a0a0b;
    border-bottom: 1px solid var(--sidebar-border);
    height: 32px;
    margin-top: 2px;
  }

  .titlebar-macos.titlebar-dark {
    background: #0a0a0b;
    border-bottom-color: var(--sidebar-border);
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
    justify-content: center;
    padding-left: 12px;
    gap: 8px;
  }

  /* macOS app info positioning - center content and avoid window controls */
  .titlebar-macos .titlebar-app-info {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    padding-left: 0;
  }

  .titlebar-logo-icon {
    height: 14px;
    width: auto;
  }

  .titlebar-logo {
    height: 14px;
    width: auto;
    filter: brightness(0) invert(1); /* Make logo white for dark titlebar */
    opacity: 0.9;
    margin-top: 2px;
  }

  .titlebar-beta-tag {
    font-size: 9px;
    font-weight: 600;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    padding: 2px 6px;
    border-radius: 9999px;
    margin-left: 4px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
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
    background: #0a0a0b;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .titlebar-windows.titlebar-dark {
    background: #0a0a0b;
    border-bottom-color: var(--sidebar-border);
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
    right: 2px;
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
    transition: background 0.15s ease, border-color 0.15s ease;
    flex-shrink: 0;
    /* Default gray state - slightly lighter than titlebar bg (#0a0a0b) */
    background: #3a3a3c;
    border: 1px solid #2a2a2c;
  }

  /* When hovering over the controls container, colorize all buttons */
  .titlebar-controls-macos:hover .macos-close {
    background: #ff5f57;
    border-color: #e0443e;
  }

  .titlebar-controls-macos:hover .macos-minimize {
    background: #ffbd2e;
    border-color: #dea123;
  }

  .titlebar-controls-macos:hover .macos-maximize {
    background: #28ca42;
    border-color: #12ac28;
  }

  /* Slightly brighter on individual button hover */
  .titlebar-controls-macos:hover .macos-close:hover {
    background: #ff6b63;
    border-color: #e8554e;
  }

  .titlebar-controls-macos:hover .macos-minimize:hover {
    background: #ffca42;
    border-color: #e5a923;
  }

  .titlebar-controls-macos:hover .macos-maximize:hover {
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
      background: #0a0a0b;
      border-bottom-color: var(--sidebar-border);
    }
  }

  @media (prefers-color-scheme: light) {
    .titlebar-macos:not(.titlebar-dark) {
      background: rgba(248, 248, 248, 0.9);
      border-bottom-color: var(--sidebar-border);
    }
  }

  /* ===== Shortcuts Modal ===== */
  .shortcuts-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .shortcuts-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 720px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .shortcuts-modal__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .shortcuts-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .shortcuts-modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shortcuts-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .shortcuts-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .shortcuts-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .shortcuts-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Tabs Navigation ===== */
  .shortcuts-tabs {
    display: flex;
    gap: 0.375rem;
    padding: 0 1.5rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .shortcuts-tabs::-webkit-scrollbar {
    height: 0;
  }

  .shortcuts-tabs__item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .shortcuts-tabs__item:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .shortcuts-tabs__item--active {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .shortcuts-tabs__item--active:hover {
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  /* ===== Content Area ===== */
  .shortcuts-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem 1.5rem;
  }

  .shortcuts-content::-webkit-scrollbar {
    width: 6px;
  }

  .shortcuts-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .shortcuts-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .shortcuts-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* ===== Shortcuts List ===== */
  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .shortcuts-list__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    transition: all 150ms ease;
  }

  .shortcuts-list__item:hover {
    background-color: var(--sidebar-active);
  }

  .shortcuts-list__label {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    flex: 1;
    min-width: 0;
  }

  .shortcuts-list__keys {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .shortcuts-list__separator {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .shortcuts-list__hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  /* ===== Keyboard Key Styling ===== */
  .shortcuts-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    padding: 0.375rem 0.625rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, 'Cascadia Code', monospace;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .shortcuts-key--sm {
    min-width: 24px;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
  }

  .shortcuts-key--inline {
    min-width: auto;
    padding: 0.125rem 0.375rem;
    font-size: 0.6875rem;
    margin: 0 0.25rem;
    vertical-align: middle;
  }

  /* ===== Mouse Action Styling ===== */
  .shortcuts-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem 0.625rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .shortcuts-action--sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
  }

  /* ===== Sections ===== */
  .shortcuts-section {
    margin-bottom: 1.25rem;
  }

  .shortcuts-section:last-child {
    margin-bottom: 0;
  }

  .shortcuts-section__title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.625rem;
    padding-left: 0.25rem;
  }

  .shortcuts-section__items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Legend Cards ===== */
  .shortcuts-legend {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  @media (max-width: 480px) {
    .shortcuts-legend {
      grid-template-columns: 1fr;
    }
  }

  .shortcuts-legend__card {
    padding: 0.875rem;
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .shortcuts-legend__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .shortcuts-legend__title {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .shortcuts-legend__desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
  }

  /* ===== Platform Note ===== */
  .shortcuts-note {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-top: 1.25rem;
    padding: 1rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
  }

  .shortcuts-note__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 6px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .shortcuts-note__text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .shortcuts-note__text strong {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  /* ===== Modal Animations ===== */
  .shortcuts-modal-enter-active,
  .shortcuts-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .shortcuts-modal-enter-from,
  .shortcuts-modal-leave-to {
    opacity: 0;
  }

  .shortcuts-dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .shortcuts-dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .shortcuts-dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .shortcuts-dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
