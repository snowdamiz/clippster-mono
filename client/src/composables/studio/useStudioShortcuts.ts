import { onMounted, onUnmounted, ref } from 'vue';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

const STORAGE_KEY = 'clippster_studio_shortcuts';

export interface StudioShortcutConfig {
  start: string;
  stop: string;
}

const DEFAULT_SHORTCUTS: StudioShortcutConfig = {
  start: 'Alt+R',
  stop: 'Alt+Shift+R',
};

function loadShortcuts(): StudioShortcutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHORTCUTS };
    return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function useStudioShortcuts(
  onStart: () => void,
  onStop: () => void
) {
  const shortcuts = ref<StudioShortcutConfig>(loadShortcuts());
  const registered = ref(false);

  async function unregisterAll() {
    for (const key of [shortcuts.value.start, shortcuts.value.stop]) {
      try {
        if (await isRegistered(key)) {
          await unregister(key);
        }
      } catch {
        // ignore
      }
    }
    registered.value = false;
  }

  async function registerAll() {
    await unregisterAll();
    let anyRegistered = false;

    for (const [key, handler] of [
      [shortcuts.value.start, onStart],
      [shortcuts.value.stop, onStop],
    ] as const) {
      try {
        const alreadyRegistered = await isRegistered(key);
        if (!alreadyRegistered) {
          await register(key, handler);
          anyRegistered = true;
        }
      } catch (err) {
        if (!String(err).includes('HotKey already registered')) {
          console.warn('[StudioShortcuts] Could not register', key, err);
        }
      }
    }

    registered.value = anyRegistered;
  }

  function saveShortcuts(config: StudioShortcutConfig) {
    shortcuts.value = { ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts.value));
    return registerAll();
  }

  onMounted(() => {
    registerAll();
  });

  onUnmounted(() => {
    unregisterAll();
  });

  return {
    shortcuts,
    registered,
    saveShortcuts,
    registerAll,
    unregisterAll,
  };
}
