<template>
  <Modal
    :open="hasVisibleAttentionConnections"
    :title="dialogTitle"
    :description="subtitle"
    :icon="ShieldAlert"
    tone="warning"
    size="md"
    @close="dismiss"
  >
    <div class="flex flex-col gap-3">
      <p class="text-sm text-fg-muted">{{ bodyText }}</p>

      <ul class="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
        <li
          v-for="connection in visibleAttentionConnections"
          :key="`${connection.platform}-${connection.id}-${connection.tokenExpiresAt}-${connection.status}`"
          class="flex min-w-0 items-center gap-3 py-2"
        >
          <PlatformLogo :platform="connection.platform" size="md" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium text-fg">@{{ connection.username }}</span>
            <span class="truncate text-xs text-fg-subtle">{{ connection.platformLabel }}</span>
          </div>
          <Badge variant="danger">{{ formatConnectionStatus(connection) }}</Badge>
          <Button
            variant="secondary"
            size="icon-sm"
            :loading="reconnectingAccountId === connection.id"
            :title="'Reconnect to refresh token'"
            aria-label="Reconnect"
            @click="reconnect(connection)"
          >
            <RefreshCw v-if="reconnectingAccountId !== connection.id" />
          </Button>
        </li>
      </ul>
    </div>

    <template #footer>
      <Button variant="secondary" @click="dismiss">Dismiss</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { PlatformLogo } from '@/components/ui/platform-logo';
import { computed, ref } from 'vue';
import { RefreshCw, ShieldAlert } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useSocialTokenMonitor } from '@/composables/useSocialTokenMonitor';
import { useToast } from '@/composables/useToast';
import { reconnectPersonalSocialPlatform } from '@/utils/socialOAuthReconnect';
import type { SocialTokenAttention } from '@/utils/socialTokenExpiry';

const { showToast } = useToast();
const {
  visibleAttentionConnections,
  hasVisibleAttentionConnections,
  dismissVisibleAttentionConnections,
  clearDismissedConnection,
  checkNow,
} = useSocialTokenMonitor();

const reconnectingAccountId = ref<number | null>(null);

const dialogTitle = computed(() => 'Social connection needs attention');

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
      return `Your ${connection.platformLabel} connection for @${connection.username} is disconnected. Click the refresh icon to sign in again — you don't need to disconnect the account first.`;
    }
    return `Your ${connection.platformLabel} connection for @${connection.username} has expired. Click the refresh icon to sign in again — you don't need to disconnect the account first.`;
  }

  return 'Some connections are disconnected or expired. Click the refresh icon on each account to sign in again. You do not need to disconnect accounts first.';
});

function dismiss(): void {
  dismissVisibleAttentionConnections();
}

function formatConnectionStatus(connection: SocialTokenAttention): string {
  if (connection.status === 'disconnected') return 'Disconnected';
  return connection.tokenExpiresAt
    ? `Expired ${formatDate(connection.tokenExpiresAt)}`
    : 'Expired';
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
  if (reconnectingAccountId.value) return;

  reconnectingAccountId.value = connection.id;
  try {
    const cancel = await reconnectPersonalSocialPlatform(
      connection.platform,
      (result) => {
        reconnectingAccountId.value = null;
        if (result.success) {
          showToast(`${connection.platformLabel} reconnected successfully`, 'success');
          clearDismissedConnection(connection);
          void checkNow();
        } else if (result.error) {
          showToast(result.error, 'error');
        }
      },
      { socialAccountId: connection.id }
    );
    void cancel;
  } catch (error) {
    reconnectingAccountId.value = null;
    const message = error instanceof Error ? error.message : 'Failed to start reconnect';
    showToast(message, 'error');
  }
}
</script>
