import { computed, reactive } from 'vue';
import { listUserInstagramAccounts } from '@/services/userInstagramApi';
import { listUserTwitterAccounts } from '@/services/userTwitterApi';
import { listUserTiktokAccounts } from '@/services/userTiktokApi';
import { listUserYoutubeAccounts } from '@/services/userYoutubeApi';
import {
  getExpiredSocialConnections,
  type ExpiredSocialConnection,
  type SocialAccountWithToken,
} from '@/utils/socialTokenExpiry';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

interface SocialTokenMonitorState {
  expiredConnections: ExpiredSocialConnection[];
  dismissedConnectionKeys: Set<string>;
  checking: boolean;
  started: boolean;
  lastCheckedAt: number | null;
}

const state = reactive<SocialTokenMonitorState>({
  expiredConnections: [],
  dismissedConnectionKeys: new Set(),
  checking: false,
  started: false,
  lastCheckedAt: null,
});

let intervalId: number | null = null;

function connectionKey(connection: Pick<ExpiredSocialConnection, 'id' | 'platform' | 'tokenExpiresAt'>): string {
  return `${connection.platform}:${connection.id}:${connection.tokenExpiresAt}`;
}

async function loadUserSocialAccounts(): Promise<SocialAccountWithToken[]> {
  const [instagramRes, twitterRes, tiktokRes, youtubeRes] = await Promise.all([
    listUserInstagramAccounts(),
    listUserTwitterAccounts(),
    listUserTiktokAccounts(),
    listUserYoutubeAccounts(),
  ]);

  return [
    ...(instagramRes.success ? instagramRes.accounts : []),
    ...(twitterRes.success ? twitterRes.accounts : []),
    ...(tiktokRes.success ? tiktokRes.accounts : []),
    ...(youtubeRes.success ? youtubeRes.accounts : []),
  ];
}

export function useSocialTokenMonitor() {
  const visibleExpiredConnections = computed(() =>
    state.expiredConnections.filter((connection) => !state.dismissedConnectionKeys.has(connectionKey(connection)))
  );

  const hasVisibleExpiredConnections = computed(() => visibleExpiredConnections.value.length > 0);

  async function checkNow(): Promise<void> {
    if (state.checking) return;

    state.checking = true;
    try {
      const accounts = await loadUserSocialAccounts();
      state.expiredConnections = getExpiredSocialConnections(accounts);
      state.lastCheckedAt = Date.now();
    } catch (error) {
      console.warn('[SocialTokenMonitor] Failed to check social account tokens:', error);
    } finally {
      state.checking = false;
    }
  }

  function dismissVisibleExpiredConnections(): void {
    for (const connection of visibleExpiredConnections.value) {
      state.dismissedConnectionKeys.add(connectionKey(connection));
    }
  }

  function start(): void {
    if (state.started) return;

    state.started = true;
    void checkNow();

    window.addEventListener('focus', checkNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    intervalId = window.setInterval(() => {
      void checkNow();
    }, CHECK_INTERVAL_MS);
  }

  function stop(): void {
    state.started = false;
    state.expiredConnections = [];
    state.dismissedConnectionKeys.clear();
    state.lastCheckedAt = null;

    window.removeEventListener('focus', checkNow);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void checkNow();
    }
  }

  return {
    state,
    visibleExpiredConnections,
    hasVisibleExpiredConnections,
    checkNow,
    dismissVisibleExpiredConnections,
    start,
    stop,
  };
}
