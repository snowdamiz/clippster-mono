import { computed, reactive } from 'vue';
import { listUserInstagramAccounts } from '@/services/userInstagramApi';
import { listUserTwitterAccounts } from '@/services/userTwitterApi';
import { listUserTiktokAccounts } from '@/services/userTiktokApi';
import { listUserYoutubeAccounts } from '@/services/userYoutubeApi';
import {
  getSocialTokenAttentionList,
  type SocialAccountWithToken,
  type SocialTokenAttention,
} from '@/utils/socialTokenExpiry';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

interface SocialTokenMonitorState {
  attentionConnections: SocialTokenAttention[];
  dismissedConnectionKeys: Set<string>;
  checking: boolean;
  started: boolean;
  lastCheckedAt: number | null;
}

const state = reactive<SocialTokenMonitorState>({
  attentionConnections: [],
  dismissedConnectionKeys: new Set(),
  checking: false,
  started: false,
  lastCheckedAt: null,
});

let intervalId: number | null = null;

function connectionKey(
  connection: Pick<SocialTokenAttention, 'id' | 'platform' | 'tokenExpiresAt' | 'status'>
): string {
  return `${connection.platform}:${connection.id}:${connection.tokenExpiresAt}:${connection.status}`;
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
  const visibleAttentionConnections = computed(() =>
    state.attentionConnections.filter(
      (connection) => !state.dismissedConnectionKeys.has(connectionKey(connection))
    )
  );

  const visibleExpiredConnections = computed(() =>
    visibleAttentionConnections.value.filter((connection) =>
      ['expired', 'disconnected'].includes(connection.status)
    )
  );

  const visibleExpiringSoonConnections = computed(() =>
    visibleAttentionConnections.value.filter((connection) => connection.status === 'expiring_soon')
  );

  const hasVisibleAttentionConnections = computed(
    () => visibleAttentionConnections.value.length > 0
  );

  /** @deprecated Use hasVisibleAttentionConnections */
  const hasVisibleExpiredConnections = hasVisibleAttentionConnections;

  /** @deprecated Use visibleAttentionConnections */
  const visibleExpiredConnectionsLegacy = visibleExpiredConnections;

  async function checkNow(): Promise<void> {
    if (state.checking) return;

    state.checking = true;
    try {
      const accounts = await loadUserSocialAccounts();
      state.attentionConnections = getSocialTokenAttentionList(accounts);
      state.lastCheckedAt = Date.now();
    } catch (error) {
      console.warn('[SocialTokenMonitor] Failed to check social account tokens:', error);
    } finally {
      state.checking = false;
    }
  }

  function dismissVisibleAttentionConnections(): void {
    for (const connection of visibleAttentionConnections.value) {
      state.dismissedConnectionKeys.add(connectionKey(connection));
    }
  }

  /** @deprecated Use dismissVisibleAttentionConnections */
  function dismissVisibleExpiredConnections(): void {
    dismissVisibleAttentionConnections();
  }

  function clearDismissedConnection(connection: SocialTokenAttention): void {
    state.dismissedConnectionKeys.delete(connectionKey(connection));
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
    state.attentionConnections = [];
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
    visibleAttentionConnections,
    visibleExpiredConnections: visibleExpiredConnectionsLegacy,
    visibleExpiringSoonConnections,
    hasVisibleAttentionConnections,
    hasVisibleExpiredConnections,
    checkNow,
    dismissVisibleAttentionConnections,
    dismissVisibleExpiredConnections,
    clearDismissedConnection,
    start,
    stop,
  };
}
