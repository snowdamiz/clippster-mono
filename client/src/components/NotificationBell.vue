<template>
  <div class="notification-bell">
    <button 
      @click="togglePanel" 
      class="bell-button"
      :class="{ 'has-unread': unreadCount > 0 }"
    >
      <Bell :size="20" />
      <span v-if="unreadCount > 0" class="badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <Teleport to="body">
      <Transition name="slide-fade">
        <div v-if="showPanel" class="notification-panel-overlay" @click="showPanel = false">
          <div class="notification-panel" @click.stop>
            <div class="panel-header">
              <h3>Notifications</h3>
              <button 
                v-if="unreadCount > 0"
                @click="markAllRead" 
                class="mark-all-read"
              >
                Mark all read
              </button>
            </div>

            <div v-if="loading" class="panel-loading">
              <Loader2 :size="24" class="spin" />
            </div>

            <div v-else-if="notifications.length === 0" class="panel-empty">
              <Bell :size="48" />
              <p>No notifications yet</p>
            </div>

            <div v-else class="notification-list">
              <div
                v-for="notification in notifications"
                :key="notification.id"
                class="notification-item"
                :class="{ 'unread': !notification.read_at }"
                @click="handleNotificationClick(notification)"
              >
                <div class="notification-icon" :class="`type-${notification.type}`">
                  <component :is="getIcon(notification.type)" :size="20" />
                </div>
                <div class="notification-content">
                  <div class="notification-title">{{ notification.title }}</div>
                  <div class="notification-message">{{ notification.message }}</div>
                  <div class="notification-time">{{ formatTime(notification.inserted_at) }}</div>
                </div>
                <div v-if="!notification.read_at" class="unread-dot"></div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, DollarSign, CheckCircle, XCircle, UserCheck, Loader2 } from 'lucide-vue-next';
import { useNotificationStore } from '@/stores/notifications';
import { formatDistanceToNow } from 'date-fns';

const router = useRouter();
const notificationStore = useNotificationStore();

const showPanel = ref(false);

const notifications = computed(() => notificationStore.notifications);
const unreadCount = computed(() => notificationStore.unreadCount);
const loading = computed(() => notificationStore.loading);

function togglePanel() {
  showPanel.value = !showPanel.value;
  if (showPanel.value && notifications.value.length === 0) {
    notificationStore.fetchNotifications();
  }
}

async function markAllRead() {
  await notificationStore.markAllAsRead();
}

async function handleNotificationClick(notification: any) {
  if (!notification.read_at) {
    await notificationStore.markAsRead(notification.id);
  }

  if (notification.action_url) {
    router.push(notification.action_url);
    showPanel.value = false;
  }
}

function getIcon(type: string) {
  switch (type) {
    case 'payment_verified':
    case 'payment_pending':
      return DollarSign;
    case 'submission_verified':
    case 'campaign_approved':
      return CheckCircle;
    case 'submission_rejected':
    case 'campaign_rejected':
      return XCircle;
    case 'campaign_joined':
      return UserCheck;
    default:
      return Bell;
  }
}

function formatTime(timestamp: string) {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

onMounted(() => {
  notificationStore.fetchUnreadCount();
  notificationStore.initializeWebSocket();
});
</script>

<style scoped>
.notification-bell {
  position: relative;
}

.bell-button {
  position: relative;
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--text-primary);
}

.bell-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bell-button.has-unread {
  color: var(--primary-color);
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.notification-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 60px 20px 20px;
}

.notification-panel {
  width: 400px;
  max-height: 600px;
  background: var(--surface-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.mark-all-read {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.mark-all-read:hover {
  background: rgba(var(--primary-rgb), 0.1);
}

.panel-loading,
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.notification-list {
  overflow-y: auto;
  max-height: 500px;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.notification-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.notification-item.unread {
  background: rgba(var(--primary-rgb), 0.05);
}

.notification-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-payment_verified,
.type-payment_pending {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.type-submission_verified,
.type-campaign_approved {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.type-submission_rejected,
.type-campaign_rejected {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.unread-dot {
  position: absolute;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: var(--primary-color);
  border-radius: 50%;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
}

.slide-fade-enter-from .notification-panel {
  transform: translateX(100%);
}

.slide-fade-leave-to {
  opacity: 0;
}

.slide-fade-leave-to .notification-panel {
  transform: translateX(100%);
}
</style>
