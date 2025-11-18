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
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="showKeyboardShortcuts = false"
      >
        <div
          class="bg-card rounded-lg p-6 max-w-3xl w-full mx-4 border border-border max-h-[85vh] flex flex-col relative"
        >
          <!-- Close Button (Top Right) -->
          <button
            @click="showKeyboardShortcuts = false"
            class="absolute top-4 right-4 p-2 hover:bg-muted rounded-md transition-colors z-10"
            title="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Header -->
          <div class="mb-4 pr-10">
            <h2 class="text-2xl font-bold text-foreground">Shortcuts & Controls</h2>
            <p class="text-sm text-muted-foreground mt-1">Keyboard and mouse shortcuts for efficient editing</p>
          </div>

          <!-- Tabs -->
          <div class="flex gap-6 mb-6 overflow-x-auto border-b border-border">
            <button
              @click="activeShortcutTab = 'playback'"
              :class="[
                'flex items-center gap-2 px-1 py-3 relative transition-colors whitespace-nowrap',
                activeShortcutTab === 'playback' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <Play :size="16" />
              <span class="text-sm font-medium">Playback</span>
              <span
                v-if="activeShortcutTab === 'playback'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              ></span>
            </button>
            <button
              @click="activeShortcutTab = 'timeline'"
              :class="[
                'flex items-center gap-2 px-1 py-3 relative transition-colors whitespace-nowrap',
                activeShortcutTab === 'timeline' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <ZoomIn :size="16" />
              <span class="text-sm font-medium">Timeline</span>
              <span
                v-if="activeShortcutTab === 'timeline'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              ></span>
            </button>
            <button
              @click="activeShortcutTab = 'selection'"
              :class="[
                'flex items-center gap-2 px-1 py-3 relative transition-colors whitespace-nowrap',
                activeShortcutTab === 'selection' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <MousePointer :size="16" />
              <span class="text-sm font-medium">Selection</span>
              <span
                v-if="activeShortcutTab === 'selection'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              ></span>
            </button>
            <button
              @click="activeShortcutTab = 'editing'"
              :class="[
                'flex items-center gap-2 px-1 py-3 relative transition-colors whitespace-nowrap',
                activeShortcutTab === 'editing' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <Edit3 :size="16" />
              <span class="text-sm font-medium">Editing</span>
              <span
                v-if="activeShortcutTab === 'editing'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              ></span>
            </button>
            <button
              @click="activeShortcutTab = 'cut'"
              :class="[
                'flex items-center gap-2 px-1 py-3 relative transition-colors whitespace-nowrap',
                activeShortcutTab === 'cut' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <Scissors :size="16" />
              <span class="text-sm font-medium">Cut Tool</span>
              <span
                v-if="activeShortcutTab === 'cut'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              ></span>
            </button>
            <button
              @click="activeShortcutTab = 'more'"
              :class="[
                'flex items-center gap-2 px-1 py-3 relative transition-colors whitespace-nowrap',
                activeShortcutTab === 'more' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <MoreHorizontal :size="16" />
              <span class="text-sm font-medium">More</span>
              <span
                v-if="activeShortcutTab === 'more'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              ></span>
            </button>
          </div>

          <!-- Content -->
          <div class="overflow-y-auto h-[480px]">
            <!-- Playback Tab -->
            <div v-if="activeShortcutTab === 'playback'" class="space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Play / Pause Video</span>
                  <kbd
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                  >
                    Space
                  </kbd>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Play / Pause (Alternative)</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Click Video
                  </span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Seek Playhead (No Selection)</span>
                  <div class="flex items-center gap-2">
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      ← →
                    </kbd>
                    <span class="text-xs text-muted-foreground">(Hold for 2x)</span>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Seek to Time Position</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Click Video Track
                  </span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Scrub Through Video</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Drag Playhead
                  </span>
                </div>
              </div>
            </div>

            <!-- Timeline Tab -->
            <div v-else-if="activeShortcutTab === 'timeline'" class="space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Zoom In / Out</span>
                  <div class="flex items-center gap-2">
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Scroll on Ruler
                    </span>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Zoom to Time Range</span>
                  <div class="flex items-center gap-2">
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Click + Drag Timeline
                    </span>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Zoom Level Slider</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Drag Slider
                  </span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Pan Horizontally</span>
                  <div class="flex items-center gap-2">
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      Ctrl
                    </kbd>
                    <span class="text-muted-foreground">+</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Scroll
                    </span>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Pan Vertically (Through Clips)</span>
                  <div class="flex items-center gap-2">
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      Alt
                    </kbd>
                    <span class="text-muted-foreground">+</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Scroll
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selection Tab -->
            <div v-else-if="activeShortcutTab === 'selection'" class="space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Select Single Segment</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Click Segment
                  </span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Multi-Select Segments</span>
                  <div class="flex items-center gap-2">
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      Ctrl
                    </kbd>
                    <span class="text-muted-foreground">+</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Click Segments
                    </span>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Deselect All Segments</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Click Empty Area
                  </span>
                </div>
              </div>
            </div>

            <!-- Editing Tab -->
            <div v-else-if="activeShortcutTab === 'editing'" class="space-y-4">
              <!-- Keyboard Editing -->
              <div>
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Keyboard Editing
                </h3>
                <div class="space-y-2">
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Move Selected Segments</span>
                    <div class="flex items-center gap-2">
                      <kbd
                        class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                      >
                        ← →
                      </kbd>
                      <span class="text-xs text-muted-foreground">(Hold for 2x)</span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Delete Selected Segments</span>
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      Backspace
                    </kbd>
                  </div>
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Merge Selected Segments</span>
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      J
                    </kbd>
                  </div>
                </div>
              </div>

              <!-- Mouse Manipulation -->
              <div>
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Mouse Manipulation
                </h3>
                <div class="space-y-2">
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Reorder Segment Position</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Drag Segment
                    </span>
                  </div>
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Trim Segment Start/End</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Drag Segment Edge
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cut Tool Tab -->
            <div v-else-if="activeShortcutTab === 'cut'" class="space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Toggle Cut Tool On/Off</span>
                  <kbd
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                  >
                    X
                  </kbd>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Split Segment at Cursor</span>
                  <span
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                  >
                    Click Segment
                  </span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span class="text-foreground">Cancel Cut Tool</span>
                  <kbd
                    class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                  >
                    Esc
                  </kbd>
                </div>
              </div>
            </div>

            <!-- More Tab -->
            <div v-else-if="activeShortcutTab === 'more'" class="space-y-4">
              <!-- General -->
              <div>
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">General</h3>
                <div class="space-y-2">
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Exit Cut Tool / Close Dialogs</span>
                    <kbd
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm font-mono shadow-sm"
                    >
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>

              <!-- Timeline Toolbar Buttons -->
              <div>
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Timeline Toolbar
                </h3>
                <div class="space-y-2">
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Reverse 10 Seconds</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Hold Button
                    </span>
                  </div>
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Forward 10 Seconds</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Hold Button
                    </span>
                  </div>
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Cut Tool Button</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Click to Toggle
                    </span>
                  </div>
                  <div class="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <span class="text-foreground">Merge Segments Button</span>
                    <span
                      class="px-3 py-1.5 bg-background border border-border rounded-md text-foreground text-sm shadow-sm"
                    >
                      Click to Merge
                    </span>
                  </div>
                </div>
              </div>

              <!-- Legend -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="p-3 bg-muted/30 rounded-md border border-border">
                  <div class="flex items-center gap-2 mb-1">
                    <kbd class="px-2 py-1 bg-background border border-border rounded text-xs font-mono shadow-sm">
                      Key
                    </kbd>
                    <span class="text-xs font-medium text-foreground">Keyboard Shortcut</span>
                  </div>
                  <p class="text-xs text-muted-foreground">Keys shown in monospace font</p>
                </div>
                <div class="p-3 bg-muted/30 rounded-md border border-border">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-1 bg-background border border-border rounded text-xs shadow-sm">Action</span>
                    <span class="text-xs font-medium text-foreground">Mouse Action</span>
                  </div>
                  <p class="text-xs text-muted-foreground">Actions shown in regular font</p>
                </div>
              </div>

              <!-- Platform Note -->
              <div class="p-4 bg-muted/30 rounded-md border border-border">
                <p class="text-sm text-muted-foreground">
                  <strong class="text-foreground">Platform Note:</strong>
                  <kbd
                    class="inline-flex items-center px-2 py-0.5 mx-1 bg-background border border-border rounded text-xs font-mono"
                  >
                    Ctrl
                  </kbd>
                  on Windows/Linux functions as
                  <kbd
                    class="inline-flex items-center px-2 py-0.5 mx-1 bg-background border border-border rounded text-xs font-mono"
                  >
                    Cmd
                  </kbd>
                  on macOS for multi-selection and scrolling operations.
                </p>
              </div>
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
  import { KeyboardIcon, Play, ZoomIn, MousePointer, Edit3, Scissors, MoreHorizontal } from 'lucide-vue-next';

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
    z-index: 99999;
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
    height: 20px;
    margin-top: -2px;
    width: auto;
  }

  .titlebar-logo {
    height: 14px;
    width: auto;
    filter: brightness(0) invert(1); /* Make logo white for dark titlebar */
    opacity: 0.9;
    margin-top: 2px;
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
