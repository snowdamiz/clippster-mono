import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dialog, type DialogButton } from '@/components/ui/dialog';
import {
  registerAppAlertHandler,
  type AppAlertOptions,
} from '@/lib/appAlert';

interface ActiveDialog {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

interface DialogContextValue {
  alert: (title: string, message?: string, buttons?: DialogButton[]) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const DEFAULT_BUTTONS: DialogButton[] = [{ text: 'OK', style: 'default' }];

function normalizeButtons(buttons?: DialogButton[]): DialogButton[] {
  if (!buttons || buttons.length === 0) return DEFAULT_BUTTONS;
  if (buttons.length === 1) return buttons;
  const hasExplicitStyle = buttons.some((button) => button.style != null);
  if (hasExplicitStyle) return buttons;
  // Match common Alert UX: secondary actions first, primary last.
  return buttons.map((button, index) => ({
    ...button,
    style: index === buttons.length - 1 ? 'default' : 'cancel',
  }));
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const activeRef = useRef<ActiveDialog | null>(null);
  const queueRef = useRef<ActiveDialog[]>([]);
  const closingRef = useRef(false);

  activeRef.current = active;

  const presentNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const show = useCallback((options: AppAlertOptions) => {
    const dialog: ActiveDialog = {
      title: options.title,
      message: options.message,
      buttons: normalizeButtons(options.buttons),
    };

    if (closingRef.current || activeRef.current) {
      queueRef.current.push(dialog);
      return;
    }
    activeRef.current = dialog;
    setActive(dialog);
  }, []);

  const dismiss = useCallback(() => {
    closingRef.current = true;
    activeRef.current = null;
    setActive(null);
    // Allow nested alerts scheduled in the same tick (e.g. confirmAccountDeletion) to enqueue,
    // then present the next queued dialog after React commits the close.
    requestAnimationFrame(() => {
      closingRef.current = false;
      presentNext();
    });
  }, [presentNext]);

  const handleRequestClose = useCallback(() => {
    if (!activeRef.current) return;
    dismiss();
  }, [dismiss]);

  const handleButtonPress = useCallback(
    (button: DialogButton) => {
      dismiss();
      void button.onPress?.();
    },
    [dismiss],
  );

  useEffect(() => {
    registerAppAlertHandler(show);
    return () => registerAppAlertHandler(null);
  }, [show]);

  const value = useMemo<DialogContextValue>(
    () => ({
      alert: (title, message, buttons) => show({ title, message, buttons }),
    }),
    [show],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Dialog
        visible={active != null}
        title={active?.title ?? ''}
        message={active?.message}
        buttons={active?.buttons ?? DEFAULT_BUTTONS}
        onRequestClose={handleRequestClose}
        onButtonPress={handleButtonPress}
      />
    </DialogContext.Provider>
  );
}
