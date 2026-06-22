import type { ApiClient } from './createApiClient';

export interface AnalyticsEvent {
  event_type: string;
  metadata?: Record<string, unknown>;
}

export function createAnalyticsApi(client: ApiClient) {
  return {
    async trackEvent(event: AnalyticsEvent): Promise<void> {
      try {
        await client.post('/analytics/track', {
          event_type: event.event_type,
          metadata: event.metadata ?? {},
        });
      } catch {
        // Analytics should not disrupt user experience
      }
    },
  };
}

export type AnalyticsApi = ReturnType<typeof createAnalyticsApi>;
