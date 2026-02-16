import { onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

/**
 * Activity tracker that pings the server periodically to update last_active_at
 * Only runs when user is authenticated
 */
export function useActivityTracker() {
  const authStore = useAuthStore();
  let intervalId: number | null = null;
  let lastActivityTime = Date.now();

  // Ping interval: 2 minutes
  const PING_INTERVAL = 2 * 60 * 1000;

  // Inactivity threshold: 5 minutes (if no user interaction, stop pinging)
  const INACTIVITY_THRESHOLD = 5 * 60 * 1000;

  const pingServer = async () => {
    if (!authStore.isAuthenticated) {
      console.log('[ActivityTracker] User not authenticated, skipping ping');
      return;
    }

    // Check if user has been inactive
    const timeSinceLastActivity = Date.now() - lastActivityTime;
    if (timeSinceLastActivity > INACTIVITY_THRESHOLD) {
      console.log('[ActivityTracker] User inactive, skipping ping');
      return; // Don't ping if user is inactive
    }

    try {
      console.log('[ActivityTracker] Sending activity ping...');
      const response = await api.post('/auth/activity-ping');
      console.log('[ActivityTracker] Activity ping successful:', response.data);
    } catch (error) {
      console.error('[ActivityTracker] Activity ping failed:', error);
    }
  };

  const updateLastActivity = () => {
    lastActivityTime = Date.now();
  };

  const startTracking = () => {
    console.log('[ActivityTracker] startTracking called, isAuthenticated:', authStore.isAuthenticated);
    
    if (!authStore.isAuthenticated) {
      console.log('[ActivityTracker] Not authenticated, skipping tracker initialization');
      return;
    }

    console.log('[ActivityTracker] Initializing activity tracker...');
    
    // Track user interactions
    window.addEventListener('mousemove', updateLastActivity);
    window.addEventListener('keydown', updateLastActivity);
    window.addEventListener('click', updateLastActivity);
    window.addEventListener('scroll', updateLastActivity);

    // Start periodic ping
    intervalId = window.setInterval(pingServer, PING_INTERVAL);
    console.log('[ActivityTracker] Interval started, will ping every', PING_INTERVAL / 1000, 'seconds');

    // Initial ping
    console.log('[ActivityTracker] Sending initial ping...');
    pingServer();
  };

  const stopTracking = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    window.removeEventListener('mousemove', updateLastActivity);
    window.removeEventListener('keydown', updateLastActivity);
    window.removeEventListener('click', updateLastActivity);
    window.removeEventListener('scroll', updateLastActivity);
  };

  onUnmounted(() => {
    stopTracking();
  });

  return {
    startTracking,
    stopTracking,
  };
}
