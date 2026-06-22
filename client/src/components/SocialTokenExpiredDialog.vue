<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="hasVisibleAttentionConnections" class="token-dialog__overlay" @click.self="dismiss">
        <Transition name="dialog" appear>
          <div v-if="hasVisibleAttentionConnections" class="token-dialog" role="dialog" aria-modal="true">
            <div class="token-dialog__accent"></div>

            <div class="token-dialog__header">
              <button class="token-dialog__close" @click="dismiss" title="Close">
                <X :size="18" />
              </button>
              <div class="token-dialog__icon">
                <ShieldAlert :size="24" />
              </div>
              <h2 class="token-dialog__title">{{ dialogTitle }}</h2>
              <p class="token-dialog__subtitle">
                {{ subtitle }}
              </p>
            </div>

            <div class="token-dialog__content">
              <div class="token-dialog__alert">
                <AlertCircle :size="16" />
                <p class="token-dialog__alert-text">
                  {{ bodyText }}
                </p>
              </div>

              <div class="token-dialog__connections">
                <div
                  v-for="connection in visibleAttentionConnections"
                  :key="`${connection.platform}-${connection.id}-${connection.tokenExpiresAt}-${connection.status}`"
                  class="token-dialog__connection"
                >
                  <div class="token-dialog__connection-main">
                    <span class="token-dialog__connection-platform">{{ connection.platformLabel }}</span>
                    <span class="token-dialog__connection-user">@{{ connection.username }}</span>
                  </div>
                  <div class="token-dialog__connection-actions">
                    <span
                      class="token-dialog__connection-status"
                      :class="{
                        'token-dialog__connection-status--expired':
                          connection.status === 'expired' || connection.status === 'disconnected',
                        'token-dialog__connection-status--soon': connection.status === 'expiring_soon',
                      }"
                    >
                      {{ formatConnectionStatus(connection) }}
                    </span>
                    <button
                      type="button"
                      class="token-dialog__reconnect-btn"
                      :disabled="reconnectingPlatform === connection.platform"
                      @click="reconnect(connection)"
                    >
                      <Loader2 v-if="reconnectingPlatform === connection.platform" :size="14" class="token-dialog__spin" />
                      <RefreshCw v-else :size="14" />
                      Reconnect
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="token-dialog__footer">
              <button @click="dismiss" class="token-dialog__btn token-dialog__btn--secondary">
                Dismiss
              </button>
              <button @click="goToAccountConnections" class="token-dialog__btn token-dialog__btn--primary">
                Account Connections
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-vue-next';
import { useSocialTokenMonitor } from '@/composables/useSocialTokenMonitor';
import { useToast } from '@/composables/useToast';
import { reconnectPersonalSocialPlatform } from '@/utils/socialOAuthReconnect';
import type { SocialTokenAttention } from '@/utils/socialTokenExpiry';

const router = useRouter();
const { showToast } = useToast();
const {
  visibleAttentionConnections,
  hasVisibleAttentionConnections,
  dismissVisibleAttentionConnections,
  clearDismissedConnection,
  checkNow,
} = useSocialTokenMonitor();

const reconnectingPlatform = ref<string | null>(null);

const hasExpired = computed(() =>
  visibleAttentionConnections.value.some(
    (connection) => connection.status === 'expired' || connection.status === 'disconnected'
  )
);

const dialogTitle = computed(() => {
  if (hasExpired.value) return 'Social connection needs attention';
  return 'Social connection expiring soon';
});

const subtitle = computed(() => {
  const count = visibleAttentionConnections.value.length;
  if (count === 1) {
    const connection = visibleAttentionConnections.value[0];
    return `${connection.platformLabel} @${connection.username}`;
  }
  return `${count} social connections need to be reconnected`;
});

const bodyText = computed(() => {
  if (visibleAttentionConnections.value.length === 1) {
    const connection = visibleAttentionConnections.value[0];
    if (connection.status === 'disconnected') {
      return `Your ${connection.platformLabel} connection for @${connection.username} is disconnected. Click Reconnect to sign in again — you don't need to disconnect the account first.`;
    }
    if (connection.status === 'expired') {
      return `Your ${connection.platformLabel} connection for @${connection.username} has expired. Click Reconnect to sign in again — you don't need to disconnect the account first.`;
    }
    const soonDays = connection.platform === 'tiktok' ? '1 day' : '2 days';
    return `Your ${connection.platformLabel} connection for @${connection.username} expires within ${soonDays}. Reconnect now to avoid interrupted publishing.`;
  }

  if (hasExpired.value) {
    return 'Some connections are disconnected or expired. Click Reconnect on each account to sign in again. You do not need to disconnect accounts first.';
  }

  return 'Some connections expire soon. Reconnect now to refresh their tokens and avoid publish failures.';
});

function dismiss(): void {
  dismissVisibleAttentionConnections();
}

function goToAccountConnections(): void {
  dismissVisibleAttentionConnections();
  router.push({ path: '/clipper-profile', query: { section: 'social-accounts' } });
}

function formatConnectionStatus(connection: SocialTokenAttention): string {
  if (connection.status === 'disconnected') return 'Disconnected';
  if (connection.status === 'expired') {
    return connection.tokenExpiresAt
      ? `Expired ${formatDate(connection.tokenExpiresAt)}`
      : 'Expired';
  }
  return connection.tokenExpiresAt
    ? `Expires ${formatDate(connection.tokenExpiresAt)}`
    : 'Expires soon';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'soon';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function reconnect(connection: SocialTokenAttention): Promise<void> {
  if (reconnectingPlatform.value) return;

  reconnectingPlatform.value = connection.platform;
  try {
    const cancel = await reconnectPersonalSocialPlatform(connection.platform, (result) => {
      reconnectingPlatform.value = null;
      if (result.success) {
        showToast(`${connection.platformLabel} reconnected successfully`, 'success');
        clearDismissedConnection(connection);
        void checkNow();
      } else if (result.error) {
        showToast(result.error, 'error');
      }
    });
    void cancel;
  } catch (error) {
    reconnectingPlatform.value = null;
    const message = error instanceof Error ? error.message : 'Failed to start reconnect';
    showToast(message, 'error');
  }
}
</script>

<style scoped>
.token-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.token-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.token-dialog__accent {
  height: 3px;
  background: var(--sidebar-accent);
  flex-shrink: 0;
}

.token-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.token-dialog__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.token-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.token-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.token-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.token-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.token-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.token-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.token-dialog__alert-text {
  font-size: 0.8125rem;
  line-height: 1.5;
  margin: 0;
}

.token-dialog__connections {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 1rem;
}

.token-dialog__connection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.token-dialog__connection-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.token-dialog__connection-platform {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.token-dialog__connection-user {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-dialog__connection-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
  flex-shrink: 0;
}

.token-dialog__connection-status {
  font-size: 0.75rem;
}

.token-dialog__connection-status--expired {
  color: #f87171;
}

.token-dialog__connection-status--soon {
  color: #fbbf24;
}

.token-dialog__reconnect-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-accent);
  color: white;
  cursor: pointer;
}

.token-dialog__reconnect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.token-dialog__spin {
  animation: token-dialog-spin 1s linear infinite;
}

@keyframes token-dialog-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.token-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.token-dialog__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.token-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.token-dialog__btn--secondary:hover {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.token-dialog__btn--primary {
  background: var(--sidebar-accent);
  color: white;
}

.token-dialog__btn--primary:hover {
  opacity: 0.9;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 150ms ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>
