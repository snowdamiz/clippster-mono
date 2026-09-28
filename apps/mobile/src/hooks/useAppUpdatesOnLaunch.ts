import { useEffect } from 'react';

import { checkAndApplyUpdates } from '@/services/appUpdates';

/** Background OTA check shortly after launch (release builds only). */
export function useAppUpdatesOnLaunch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      void checkAndApplyUpdates({ interactive: false });
    }, 2500);

    return () => clearTimeout(timer);
  }, [enabled]);
}
