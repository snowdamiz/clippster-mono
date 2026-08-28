import type { DialogButton } from '@/components/ui/dialog';

export type AppAlertButton = DialogButton;

export interface AppAlertOptions {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

type ShowHandler = (options: AppAlertOptions) => void;

let showHandler: ShowHandler | null = null;

export function registerAppAlertHandler(handler: ShowHandler | null) {
  showHandler = handler;
}

/**
 * Drop-in replacement for React Native `Alert.alert` that shows a themed in-app dialog.
 * Requires `DialogProvider` to be mounted in the root layout.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
): void {
  if (!showHandler) {
    console.warn('[appAlert] DialogProvider is not mounted; alert dropped:', title);
    return;
  }
  showHandler({ title, message, buttons });
}
