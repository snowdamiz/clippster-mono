import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';
import { messagingSocket } from '@/services/messagingSocket';
import { useToast } from '@/composables/useToast';
import type { ToastCategory } from './userPreferences';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  action_url?: string;
  read_at?: string;
  inserted_at: string;
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const loading = ref(false);
  const { toast } = useToast();

  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.read_at)
  );

  async function fetchNotifications() {
    loading.value = true;
    try {
      const response = await api.get('/user/notifications');
      if (response.data.success) {
        notifications.value = response.data.notifications;
      }
    } catch (error) {
      console.error('[Notifications] Failed to fetch:', error);
    } finally {
      loading.value = false;
    }
  }

  async function fetchUnreadCount() {
    try {
      const response = await api.get('/user/notifications/unread-count');
      if (response.data.success) {
        unreadCount.value = response.data.count;
      }
    } catch (error) {
      console.error('[Notifications] Failed to fetch unread count:', error);
    }
  }

  async function markAsRead(notificationId: number) {
    try {
      const response = await api.post(`/user/notifications/${notificationId}/read`);
      if (response.data.success) {
        const notification = notifications.value.find(n => n.id === notificationId);
        if (notification) {
          notification.read_at = new Date().toISOString();
          unreadCount.value = Math.max(0, unreadCount.value - 1);
        }
      }
    } catch (error) {
      console.error('[Notifications] Failed to mark as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      const response = await api.post('/user/notifications/read-all');
      if (response.data.success) {
        notifications.value.forEach(n => {
          if (!n.read_at) {
            n.read_at = new Date().toISOString();
          }
        });
        unreadCount.value = 0;
      }
    } catch (error) {
      console.error('[Notifications] Failed to mark all as read:', error);
    }
  }

  function handleIncomingNotification(notification: Notification) {
    // Add to list
    notifications.value.unshift(notification);
    unreadCount.value++;

    // Show toast based on type
    const category = getNotificationCategory(notification.type);
    
    toast({
      title: notification.title,
      description: notification.message,
      type: getToastType(notification.type),
      category,
      duration: 8000,
    });
  }

  function getNotificationCategory(type: string): ToastCategory {
    if (type.includes('payment') || type.includes('submission')) {
      return 'campaigns';
    }
    if (type.includes('campaign')) {
      return 'campaigns';
    }
    return 'organization';
  }

  function getToastType(type: string): 'success' | 'info' | 'warning' | 'error' {
    if (type === 'payment_verified') return 'success';
    if (type === 'submission_verified' || type === 'campaign_approved') return 'success';
    if (type === 'submission_rejected' || type === 'campaign_rejected') return 'warning';
    return 'info';
  }

  function initializeWebSocket() {
    messagingSocket.setOnNotification((notification) => {
      handleIncomingNotification(notification);
    });
  }

  return {
    notifications,
    unreadCount,
    unreadNotifications,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    handleIncomingNotification,
    initializeWebSocket,
  };
});
