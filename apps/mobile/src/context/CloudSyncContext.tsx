import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useConflictSheetResolver } from '@/components/sync/ConflictSheet';
import { CLOUD_SYNC_ENABLED, setCloudSyncConflictHandler, syncAllProjects } from '@/services/cloudSync';

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authChecked } = useAuth();
  const { handler, sheet } = useConflictSheetResolver();

  useEffect(() => {
    if (!CLOUD_SYNC_ENABLED) return;
    setCloudSyncConflictHandler(handler);
    return () => setCloudSyncConflictHandler(null);
  }, [handler]);

  useEffect(() => {
    if (!CLOUD_SYNC_ENABLED || !authChecked || !isAuthenticated) return;
    void syncAllProjects();
  }, [authChecked, isAuthenticated]);

  useEffect(() => {
    if (!CLOUD_SYNC_ENABLED || !isAuthenticated) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncAllProjects();
      }
    });

    return () => sub.remove();
  }, [isAuthenticated]);

  return (
    <>
      {children}
      {CLOUD_SYNC_ENABLED ? sheet : null}
    </>
  );
}
