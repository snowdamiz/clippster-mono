/**
 * Guard for a screen with unsaved edits: leaving the route asks first, and so
 * does quitting the app (the native close handler checks the flag set here and
 * `AppCloseDialog` lists the unsaved edits).
 *
 *   useUnsavedChanges(() => editor.value?.isDirty ?? false, {
 *     title: 'Discard unsaved changes?',
 *     message: 'Your profile changes haven’t been saved yet.',
 *   });
 *
 * Call it from the routed page's setup (it registers `onBeforeRouteLeave`).
 */
import { onBeforeUnmount, readonly, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { confirmDialog } from '@/composables/useDialogs';

const unsavedChanges = ref(false);

/** True while a screen has unsaved edits (read by the app close dialog). */
export const hasUnsavedChanges = readonly(unsavedChanges);

async function setUnsaved(value: boolean) {
  unsavedChanges.value = value;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_unsaved_changes', { unsaved: value });
  } catch {
    // Browser preview / older shell: only the in-app route guard applies.
  }
}

export function useUnsavedChanges(isDirty: () => boolean, prompt: { title: string; message: string }) {
  watch(isDirty, (dirty) => void setUnsaved(dirty), { immediate: true });
  onBeforeUnmount(() => void setUnsaved(false));

  onBeforeRouteLeave(() => {
    if (!isDirty()) return true;
    return confirmDialog({
      ...prompt,
      confirmText: 'Discard changes',
      cancelText: 'Keep editing',
      variant: 'destructive',
    });
  });
}
