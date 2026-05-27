<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="hasVisibleExpiredConnections" class="token-dialog__overlay" @click.self="dismiss">
        <Transition name="dialog" appear>
          <div v-if="hasVisibleExpiredConnections" class="token-dialog" role="dialog" aria-modal="true">
            <div class="token-dialog__accent"></div>

            <div class="token-dialog__header">
              <button class="token-dialog__close" @click="dismiss" title="Close">
                <X :size="18" />
              </button>
              <div class="token-dialog__icon">
                <ShieldAlert :size="24" />
              </div>
              <h2 class="token-dialog__title">Social connection expired</h2>
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
                  v-for="connection in visibleExpiredConnections"
                  :key="`${connection.platform}-${connection.id}-${connection.tokenExpiresAt}`"
                  class="token-dialog__connection"
                >
                  <div class="token-dialog__connection-main">
                    <span class="token-dialog__connection-platform">{{ connection.platformLabel }}</span>
                    <span class="token-dialog__connection-user">@{{ connection.username }}</span>
                  </div>
                  <span class="token-dialog__connection-expired">
                    Expired {{ formatExpiredDate(connection.tokenExpiresAt) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="token-dialog__footer">
              <button @click="dismiss" class="token-dialog__btn token-dialog__btn--secondary">
                Dismiss
              </button>
              <button @click="goToAccountConnections" class="token-dialog__btn token-dialog__btn--primary">
                Go to Account Connections
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, ShieldAlert, X } from 'lucide-vue-next';
import { useSocialTokenMonitor } from '@/composables/useSocialTokenMonitor';

const router = useRouter();
const {
  visibleExpiredConnections,
  hasVisibleExpiredConnections,
  dismissVisibleExpiredConnections,
} = useSocialTokenMonitor();

const subtitle = computed(() => {
  if (visibleExpiredConnections.value.length === 1) {
    const connection = visibleExpiredConnections.value[0];
    return `${connection.platformLabel} @${connection.username} needs to be reconnected.`;
  }

  return `${visibleExpiredConnections.value.length} social connections need to be reconnected.`;
});

const bodyText = computed(() => {
  if (visibleExpiredConnections.value.length === 1) {
    const connection = visibleExpiredConnections.value[0];
    return `Your ${connection.platformLabel} connection for @${connection.username} has expired. Disconnect and reconnect it in Account Connections to refresh the token, then try publishing again.`;
  }

  return 'These social connections have expired. Disconnect and reconnect each one in Account Connections to refresh their tokens, then try publishing again.';
});

function dismiss(): void {
  dismissVisibleExpiredConnections();
}

function goToAccountConnections(): void {
  dismissVisibleExpiredConnections();
  router.push({ path: '/clipper-profile', query: { section: 'social-accounts' } });
}

function formatExpiredDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

.token-dialog__connection-expired {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #fbbf24;
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
