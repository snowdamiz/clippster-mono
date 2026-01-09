import { ref, computed } from 'vue';

export interface KeyboardShortcut {
  id: string;
  action: string;
  description: string;
  defaultKey: string;
  currentKey: string;
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  category: 'playback' | 'editing' | 'tools' | 'navigation' | 'markers' | 'clipboard';
}

const STORAGE_KEY = 'clippster-keyboard-shortcuts';

// Default keyboard shortcuts configuration
const defaultShortcuts: KeyboardShortcut[] = [
  // Playback
  { id: 'play-pause', action: 'togglePlayback', description: 'Play/Pause', defaultKey: 'Space', currentKey: 'Space', modifiers: {}, category: 'playback' },
  { id: 'play-backward', action: 'playBackward', description: 'Play Backward / Decrease Speed', defaultKey: 'j', currentKey: 'j', modifiers: {}, category: 'playback' },
  { id: 'stop', action: 'stop', description: 'Stop', defaultKey: 'k', currentKey: 'k', modifiers: {}, category: 'playback' },
  { id: 'play-forward', action: 'playForward', description: 'Play Forward / Increase Speed', defaultKey: 'l', currentKey: 'l', modifiers: {}, category: 'playback' },
  
  // Navigation
  { id: 'seek-frame-back', action: 'seekFrameBack', description: 'Seek 1 Frame Back', defaultKey: 'ArrowLeft', currentKey: 'ArrowLeft', modifiers: {}, category: 'navigation' },
  { id: 'seek-frame-forward', action: 'seekFrameForward', description: 'Seek 1 Frame Forward', defaultKey: 'ArrowRight', currentKey: 'ArrowRight', modifiers: {}, category: 'navigation' },
  { id: 'seek-10-frames-back', action: 'seek10FramesBack', description: 'Seek 10 Frames Back', defaultKey: 'ArrowLeft', currentKey: 'ArrowLeft', modifiers: { shift: true }, category: 'navigation' },
  { id: 'seek-10-frames-forward', action: 'seek10FramesForward', description: 'Seek 10 Frames Forward', defaultKey: 'ArrowRight', currentKey: 'ArrowRight', modifiers: { shift: true }, category: 'navigation' },
  { id: 'go-to-start', action: 'goToStart', description: 'Go to Start', defaultKey: 'Home', currentKey: 'Home', modifiers: {}, category: 'navigation' },
  { id: 'go-to-end', action: 'goToEnd', description: 'Go to End', defaultKey: 'End', currentKey: 'End', modifiers: {}, category: 'navigation' },
  
  // Tools
  { id: 'tool-move', action: 'setToolMove', description: 'Move Tool', defaultKey: 'v', currentKey: 'v', modifiers: {}, category: 'tools' },
  { id: 'tool-razor', action: 'setToolRazor', description: 'Razor Tool', defaultKey: 'c', currentKey: 'c', modifiers: {}, category: 'tools' },
  { id: 'tool-ripple', action: 'setToolRipple', description: 'Ripple Edit Tool', defaultKey: 'b', currentKey: 'b', modifiers: {}, category: 'tools' },
  { id: 'tool-roll', action: 'setToolRoll', description: 'Roll Edit Tool', defaultKey: 'n', currentKey: 'n', modifiers: {}, category: 'tools' },
  { id: 'tool-slip', action: 'setToolSlip', description: 'Slip Tool', defaultKey: 'y', currentKey: 'y', modifiers: {}, category: 'tools' },
  { id: 'tool-slide', action: 'setToolSlide', description: 'Slide Tool', defaultKey: 'u', currentKey: 'u', modifiers: {}, category: 'tools' },
  
  // Editing
  { id: 'cut-at-playhead', action: 'cutAtPlayhead', description: 'Cut at Playhead', defaultKey: 'x', currentKey: 'x', modifiers: {}, category: 'editing' },
  { id: 'delete', action: 'delete', description: 'Delete Selected', defaultKey: 'Delete', currentKey: 'Delete', modifiers: {}, category: 'editing' },
  { id: 'undo', action: 'undo', description: 'Undo', defaultKey: 'z', currentKey: 'z', modifiers: { ctrl: true }, category: 'editing' },
  { id: 'redo', action: 'redo', description: 'Redo', defaultKey: 'y', currentKey: 'y', modifiers: { ctrl: true }, category: 'editing' },
  
  // Clipboard
  { id: 'copy', action: 'copy', description: 'Copy', defaultKey: 'c', currentKey: 'c', modifiers: { ctrl: true }, category: 'clipboard' },
  { id: 'paste', action: 'paste', description: 'Paste', defaultKey: 'v', currentKey: 'v', modifiers: { ctrl: true }, category: 'clipboard' },
  { id: 'paste-in-place', action: 'pasteInPlace', description: 'Paste in Place', defaultKey: 'v', currentKey: 'v', modifiers: { ctrl: true, shift: true }, category: 'clipboard' },
  { id: 'duplicate', action: 'duplicate', description: 'Duplicate', defaultKey: 'd', currentKey: 'd', modifiers: { ctrl: true }, category: 'clipboard' },
  { id: 'group', action: 'group', description: 'Group', defaultKey: 'g', currentKey: 'g', modifiers: { ctrl: true }, category: 'clipboard' },
  { id: 'ungroup', action: 'ungroup', description: 'Ungroup', defaultKey: 'g', currentKey: 'g', modifiers: { ctrl: true, shift: true }, category: 'clipboard' },
  
  // Markers
  { id: 'add-marker', action: 'addMarker', description: 'Add Marker', defaultKey: 'm', currentKey: 'm', modifiers: {}, category: 'markers' },
  { id: 'set-in-point', action: 'setInPoint', description: 'Set In Point', defaultKey: 'i', currentKey: 'i', modifiers: {}, category: 'markers' },
  { id: 'set-out-point', action: 'setOutPoint', description: 'Set Out Point', defaultKey: 'o', currentKey: 'o', modifiers: {}, category: 'markers' },
  { id: 'clear-in-out', action: 'clearInOut', description: 'Clear In/Out Points', defaultKey: 'x', currentKey: 'x', modifiers: { alt: true }, category: 'markers' },
  
  // Zoom
  { id: 'zoom-in', action: 'zoomIn', description: 'Zoom In', defaultKey: '=', currentKey: '=', modifiers: {}, category: 'navigation' },
  { id: 'zoom-out', action: 'zoomOut', description: 'Zoom Out', defaultKey: '-', currentKey: '-', modifiers: {}, category: 'navigation' },
  { id: 'zoom-to-fit', action: 'zoomToFit', description: 'Zoom to Fit', defaultKey: 'z', currentKey: 'z', modifiers: {}, category: 'navigation' },
  { id: 'zoom-to-selection', action: 'zoomToSelection', description: 'Zoom to Selection', defaultKey: 'z', currentKey: 'z', modifiers: { shift: true }, category: 'navigation' },
];

// Singleton state
const shortcuts = ref<KeyboardShortcut[]>([]);
const isInitialized = ref(false);

export function useKeyboardShortcuts() {
  // Initialize shortcuts from storage or defaults
  function initialize() {
    if (isInitialized.value) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as KeyboardShortcut[];
        // Merge with defaults to handle new shortcuts added in updates
        shortcuts.value = defaultShortcuts.map(defaultShortcut => {
          const stored = parsed.find(s => s.id === defaultShortcut.id);
          return stored ? { ...defaultShortcut, currentKey: stored.currentKey, modifiers: stored.modifiers } : defaultShortcut;
        });
      } else {
        shortcuts.value = [...defaultShortcuts];
      }
    } catch {
      shortcuts.value = [...defaultShortcuts];
    }
    
    isInitialized.value = true;
  }

  // Save shortcuts to storage
  function saveShortcuts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts.value));
    } catch (e) {
      console.warn('[useKeyboardShortcuts] Failed to save shortcuts:', e);
    }
  }

  // Update a shortcut's key binding
  function updateShortcut(id: string, newKey: string, modifiers: KeyboardShortcut['modifiers'] = {}) {
    const shortcut = shortcuts.value.find(s => s.id === id);
    if (shortcut) {
      shortcut.currentKey = newKey;
      shortcut.modifiers = modifiers;
      saveShortcuts();
    }
  }

  // Reset a shortcut to its default
  function resetShortcut(id: string) {
    const shortcut = shortcuts.value.find(s => s.id === id);
    const defaultShortcut = defaultShortcuts.find(s => s.id === id);
    if (shortcut && defaultShortcut) {
      shortcut.currentKey = defaultShortcut.defaultKey;
      shortcut.modifiers = { ...defaultShortcut.modifiers };
      saveShortcuts();
    }
  }

  // Reset all shortcuts to defaults
  function resetAllShortcuts() {
    shortcuts.value = [...defaultShortcuts];
    saveShortcuts();
  }

  // Get shortcut by action
  function getShortcutByAction(action: string): KeyboardShortcut | undefined {
    return shortcuts.value.find(s => s.action === action);
  }

  // Get shortcut display string (e.g., "Ctrl+C")
  function getShortcutDisplayString(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.modifiers.ctrl) parts.push('Ctrl');
    if (shortcut.modifiers.alt) parts.push('Alt');
    if (shortcut.modifiers.shift) parts.push('Shift');
    if (shortcut.modifiers.meta) parts.push('Cmd');
    
    // Format the key nicely
    let keyDisplay = shortcut.currentKey;
    if (keyDisplay === ' ' || keyDisplay === 'Space') keyDisplay = 'Space';
    else if (keyDisplay === 'ArrowLeft') keyDisplay = '←';
    else if (keyDisplay === 'ArrowRight') keyDisplay = '→';
    else if (keyDisplay === 'ArrowUp') keyDisplay = '↑';
    else if (keyDisplay === 'ArrowDown') keyDisplay = '↓';
    else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();
    
    parts.push(keyDisplay);
    return parts.join('+');
  }

  // Check if a keyboard event matches a shortcut
  function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const keyMatches = event.key.toLowerCase() === shortcut.currentKey.toLowerCase() ||
                       event.code === shortcut.currentKey;
    
    const ctrlMatches = !!shortcut.modifiers.ctrl === (event.ctrlKey || event.metaKey);
    const shiftMatches = !!shortcut.modifiers.shift === event.shiftKey;
    const altMatches = !!shortcut.modifiers.alt === event.altKey;
    
    return keyMatches && ctrlMatches && shiftMatches && altMatches;
  }

  // Find shortcut that matches a keyboard event
  function findMatchingShortcut(event: KeyboardEvent): KeyboardShortcut | undefined {
    return shortcuts.value.find(s => matchesShortcut(event, s));
  }

  // Get shortcuts by category
  const shortcutsByCategory = computed(() => {
    const categories: Record<string, KeyboardShortcut[]> = {};
    for (const shortcut of shortcuts.value) {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = [];
      }
      categories[shortcut.category].push(shortcut);
    }
    return categories;
  });

  // Initialize on first use
  initialize();

  return {
    shortcuts,
    shortcutsByCategory,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    getShortcutByAction,
    getShortcutDisplayString,
    matchesShortcut,
    findMatchingShortcut,
  };
}
