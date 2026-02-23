import { ref, computed } from 'vue';
import api from '@/services/api';
import { messagingSocket } from '@/services/messagingSocket';

// ============================================================================
// Types
// ============================================================================

export interface Announcement {
  id: number;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'feature' | 'campaign';
  audience: 'everyone' | 'users_only' | 'orgs_only';
  is_active: boolean;
  published_at: string | null;
  expires_at: string | null;
}

// ============================================================================
// State (module-level singleton so it persists across components)
// ============================================================================

const SEEN_KEY = 'clippster_seen_announcements';

const queue = ref<Announcement[]>([]);
let channelSubscribed = false;

function getSeenIds(): number[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markSeen(id: number) {
  const seen = getSeenIds();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }
}

function isUnseen(announcement: Announcement): boolean {
  return !getSeenIds().includes(announcement.id);
}

function enqueue(announcement: Announcement) {
  if (isUnseen(announcement) && !queue.value.find((a) => a.id === announcement.id)) {
    queue.value.push(announcement);
  }
}

// ============================================================================
// Composable
// ============================================================================

export function useAnnouncements() {
  const currentAnnouncement = computed(() => queue.value[0] ?? null);
  const hasAnnouncements = computed(() => queue.value.length > 0);
  const queueLength = computed(() => queue.value.length);

  /**
   * Fetch active announcements from the server and enqueue unseen ones.
   * Call this after the user has logged in.
   */
  async function fetchAndEnqueue() {
    try {
      const response = await api.get('/announcements/active', { timeout: 10_000 });
      const announcements: Announcement[] = response.data.announcements ?? [];
      for (const a of announcements) {
        enqueue(a);
      }
    } catch (error) {
      console.error('[useAnnouncements] Failed to fetch announcements:', error);
    }
  }

  /**
   * Subscribe to the announcements Phoenix channel for real-time pushes.
   * The socket must already be connected (call after messagingSocket.connect).
   */
  function subscribeToChannel(accountType: string) {
    if (channelSubscribed) return;
    channelSubscribed = true;

    messagingSocket.joinAnnouncementsChannel((payload: Announcement) => {
      const matchesAudience =
        payload.audience === 'everyone' ||
        (payload.audience === 'users_only' && accountType !== 'organization') ||
        (payload.audience === 'orgs_only' && accountType === 'organization');

      if (matchesAudience) {
        enqueue(payload);
      }
    });
  }

  /**
   * Dismiss the current announcement (marks as seen, removes from queue).
   */
  function dismissCurrent() {
    const current = queue.value[0];
    if (current) {
      markSeen(current.id);
      queue.value.shift();
    }
  }

  /**
   * Leave the announcements channel (call on logout).
   */
  function unsubscribe() {
    if (channelSubscribed) {
      messagingSocket.leaveAnnouncementsChannel();
      channelSubscribed = false;
    }
    queue.value = [];
  }

  return {
    currentAnnouncement,
    hasAnnouncements,
    queueLength,
    fetchAndEnqueue,
    subscribeToChannel,
    dismissCurrent,
    unsubscribe,
  };
}
