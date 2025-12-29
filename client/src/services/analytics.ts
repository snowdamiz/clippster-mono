import api from './api';

export interface AnalyticsEvent {
  event_type: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsStats {
  [event_type: string]: {
    total: number;
    today: number;
    this_week: number;
  };
}

export const trackEvent = async (event: AnalyticsEvent): Promise<void> => {
  try {
    await api.post('/analytics/track', {
      event_type: event.event_type,
      metadata: event.metadata || {},
    });
  } catch (error) {
    // Silently fail for analytics tracking - don't disrupt user experience
    console.error('Failed to track analytics event:', error);
  }
};

export const getAnalyticsStats = async (): Promise<AnalyticsStats> => {
  const response = await api.get('/admin/analytics');
  return response.data.stats;
};

export default {
  trackEvent,
  getAnalyticsStats,
};
