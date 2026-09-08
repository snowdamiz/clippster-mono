import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { EditorControllerState } from './editorController';
import { MobileEditorController } from './editorController';

export function useMobileEditorController(
  controller: MobileEditorController,
): EditorControllerState {
  const state = useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.snapshot,
    () => controller.snapshot,
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void controller.flush().catch(() => undefined);
    });
    return () => {
      subscription.remove();
      void controller.dispose().catch(() => undefined);
    };
  }, [controller]);

  return state;
}
