import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/services/api';
import { canAccessCampaigns } from '@/lib/featureAccess';

interface FeatureFlagsResponse {
  success: boolean;
  feature_flags?: {
    campaigns_enabled?: boolean;
  };
}

interface FeatureFlagsContextValue {
  ready: boolean;
  campaignsEnabled: boolean;
  canAccessCampaigns: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [campaignsEnabled, setCampaignsEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void apiClient
      .get<FeatureFlagsResponse>('/settings/feature-flags', { skipAuth: true })
      .then((response) => {
        if (active) setCampaignsEnabled(response.success && response.feature_flags?.campaigns_enabled === true);
      })
      .catch(() => {
        if (active) setCampaignsEnabled(false);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      campaignsEnabled,
      canAccessCampaigns: canAccessCampaigns(user, campaignsEnabled),
    }),
    [campaignsEnabled, ready, user],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return context;
}
