import { shallowRef } from 'vue';

/**
 * Promise-based replacements for the browser's native confirm() / prompt(),
 * rendered by the single <DialogHost> mounted in App.vue so every
 * confirmation looks like the rest of the app.
 *
 *   if (!(await confirmDialog({ title: 'Delete project?', message: '…', variant: 'destructive' }))) return;
 *   const name = await promptDialog({ title: 'Rename', label: 'Name', defaultValue: project.name });
 */

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export interface PromptDialogOptions {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface PendingConfirm extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

interface PendingPrompt extends PromptDialogOptions {
  resolve: (value: string | null) => void;
}

const pendingConfirm = shallowRef<PendingConfirm | null>(null);
const pendingPrompt = shallowRef<PendingPrompt | null>(null);

/** Ask the user to confirm an action. Resolves `true` when confirmed. */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  pendingConfirm.value?.resolve(false);
  return new Promise((resolve) => {
    pendingConfirm.value = { ...options, resolve };
  });
}

/** Ask the user for a single line of text. Resolves `null` when cancelled. */
export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  pendingPrompt.value?.resolve(null);
  return new Promise((resolve) => {
    pendingPrompt.value = { ...options, resolve };
  });
}

/** Internal: state + settle helpers used by DialogHost. */
export function useDialogHost() {
  function settleConfirm(value: boolean) {
    const pending = pendingConfirm.value;
    pendingConfirm.value = null;
    pending?.resolve(value);
  }

  function settlePrompt(value: string | null) {
    const pending = pendingPrompt.value;
    pendingPrompt.value = null;
    pending?.resolve(value);
  }

  return { pendingConfirm, pendingPrompt, settleConfirm, settlePrompt };
}
