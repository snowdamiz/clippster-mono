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
const FOCUS_CHECK_STALE_MS = 5 * 60 * 1000;
const DISMISS_STORAGE_KEY = 'clippster_dismissed_social_token_warnings';

interface SocialTokenMonitorState {
  attentionConnections: SocialTokenAttention[];
  dismissedConnectionKeys: Record<string, true>;
  checking: boolean;
  started: boolean;
  lastCheckedAt: number | null;
}

const state = reactive<SocialTokenMonitorState>({
  attentionConnections: [],
  dismissedConnectionKeys: {},
  checking: false,
  started: false,
  lastCheckedAt: null,
});

let intervalId: number | null = null;

function connectionDismissKey(
  connection: Pick<SocialTokenAttention, 'id' | 'platform' | 'status'>
): string {
  return `${connection.platform}:${connection.id}:urgent`;
}

function allConnectionDismissKeys(
  connection: Pick<SocialTokenAttention, 'id' | 'platform'>
): string[] {
  return [
    `${connection.platform}:${connection.id}:warning`,
    `${connection.platform}:${connection.id}:urgent`,
  ];
}

function loadPersistedWarningDismissals(): Record<string, true> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return {};

    const keys = JSON.parse(raw) as string[];
    return Object.fromEntries(keys.map((key) => [key, true as const]));
  } catch {
    return {};
  }
}

function persistWarningDismissals(keys: Record<string, true>): void {
  const keysToPersist = Object.keys(keys);

  if (keysToPersist.length === 0) {
    localStorage.removeItem(DISMISS_STORAGE_KEY);
    return;
  }

  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(keysToPersist));
}

function isConnectionDismissed(connection: SocialTokenAttention): boolean {
  return Boolean(state.dismissedConnectionKeys[connectionDismissKey(connection)]);
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
    state.attentionConnections.filter((connection) => !isConnectionDismissed(connection))
  );

  const visibleExpiredConnections = computed(() => visibleAttentionConnections.value);

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

  function checkNowIfStale(): void {
    if (state.lastCheckedAt && Date.now() - state.lastCheckedAt < FOCUS_CHECK_STALE_MS) {
      return;
    }

    void checkNow();
  }

  function dismissVisibleAttentionConnections(): void {
    for (const connection of visibleAttentionConnections.value) {
      state.dismissedConnectionKeys[connectionDismissKey(connection)] = true;
    }

    persistWarningDismissals(state.dismissedConnectionKeys);
  }

  /** @deprecated Use dismissVisibleAttentionConnections */
  function dismissVisibleExpiredConnections(): void {
    dismissVisibleAttentionConnections();
  }

  function clearDismissedConnection(connection: SocialTokenAttention): void {
    for (const key of allConnectionDismissKeys(connection)) {
      delete state.dismissedConnectionKeys[key];
    }

    persistWarningDismissals(state.dismissedConnectionKeys);
  }

  function start(): void {
    if (state.started) return;

    state.started = true;
    state.dismissedConnectionKeys = {
      ...loadPersistedWarningDismissals(),
      ...state.dismissedConnectionKeys,
    };
    void checkNow();

    window.addEventListener('focus', checkNowIfStale);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    intervalId = window.setInterval(() => {
      void checkNow();
    }, CHECK_INTERVAL_MS);
  }

  function stop(options?: { clearPersistedDismissals?: boolean }): void {
    state.started = false;
    state.attentionConnections = [];
    state.dismissedConnectionKeys = {};
    state.lastCheckedAt = null;

    if (options?.clearPersistedDismissals) {
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    }

    window.removeEventListener('focus', checkNowIfStale);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      checkNowIfStale();
    }
  }

  return {
    state,
    visibleAttentionConnections,
    visibleExpiredConnections: visibleExpiredConnectionsLegacy,
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
