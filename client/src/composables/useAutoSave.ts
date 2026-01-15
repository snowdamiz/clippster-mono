import { ref, watch, type WatchSource } from 'vue';

interface AutoSaveOptions {
  debounceMs?: number;
  savedIndicatorMs?: number;
}

export function useAutoSave(saveFn: () => Promise<void>, options: AutoSaveOptions = {}) {
  const { debounceMs = 500, savedIndicatorMs = 2000 } = options;

  const isSaving = ref(false);
  const lastSaved = ref(false);
  const isInitialLoad = ref(true);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  function triggerAutoSave() {
    if (isInitialLoad.value) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => performSave(), debounceMs);
  }

  async function performSave() {
    isSaving.value = true;
    lastSaved.value = false;
    try {
      await saveFn();
      lastSaved.value = true;
      setTimeout(() => {
        lastSaved.value = false;
      }, savedIndicatorMs);
    } catch (error) {
      console.error('[useAutoSave] Save failed:', error);
    } finally {
      isSaving.value = false;
    }
  }

  async function saveNow() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    await performSave();
  }

  function watchForChanges(sources: WatchSource<any>[]) {
    sources.forEach((source) => {
      watch(source, () => triggerAutoSave(), { deep: true });
    });
  }

  function setInitialLoadComplete() {
    isInitialLoad.value = false;
  }

  function resetForNewSession() {
    isInitialLoad.value = true;
    isSaving.value = false;
    lastSaved.value = false;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  }

  return {
    isSaving,
    lastSaved,
    isInitialLoad,
    triggerAutoSave,
    saveNow,
    watchForChanges,
    setInitialLoadComplete,
    resetForNewSession,
  };
}
