import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  listConversations,
  getMessages,
  sendMessage as apiSendMessage,
  editMessage as apiEditMessage,
  deleteMessage as apiDeleteMessage,
  markAsRead as apiMarkAsRead,
  toggleMute as apiToggleMute,
  createDirectConversation,
  createGroupConversation,
  createAnnouncement,
  getUnreadCounts,
  getTotalUnread,
  leaveConversation as apiLeaveConversation,
  addParticipant as apiAddParticipant,
  removeParticipant as apiRemoveParticipant,
  type Conversation,
  type Message,
  type UnreadCounts,
} from '@/services/messagingApi';
import { messagingSocket } from '@/services/messagingSocket';
import { useAuthStore } from './auth';

export const useMessagingStore = defineStore('messaging', () => {
  // ============================================================================
  // State
  // ============================================================================

  const conversations = ref<Map<number, Conversation>>(new Map());
  const messages = ref<Map<number, Message[]>>(new Map()); // conversationId -> messages
  const unreadCounts = ref<Map<number, number>>(new Map()); // conversationId -> count
  const totalUnread = ref(0);
  const activeConversationId = ref<number | null>(null);
  const typingUsers = ref<Map<number, Set<number>>>(new Map()); // conversationId -> userIds
  const isLoading = ref(false);
  const isLoadingMessages = ref(false);
  const currentOrgId = ref<number | null>(null);
  const isSocketConnected = ref(false);

  // ============================================================================
  // Computed
  // ============================================================================

  const conversationList = computed(() => {
    return Array.from(conversations.value.values()).sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  });

  const activeConversation = computed(() => {
    if (!activeConversationId.value) return null;
    return conversations.value.get(activeConversationId.value) || null;
  });

  const activeMessages = computed(() => {
    if (!activeConversationId.value) return [];
    return messages.value.get(activeConversationId.value) || [];
  });

  const activeUnreadCount = computed(() => {
    if (!activeConversationId.value) return 0;
    return unreadCounts.value.get(activeConversationId.value) || 0;
  });

  const activeTypingUsers = computed((): Set<number> => {
    if (!activeConversationId.value) return new Set<number>();
    return typingUsers.value.get(activeConversationId.value) || new Set<number>();
  });

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Initialize the messaging store for an organization.
   */
  async function initialize(orgId: number) {
    const authStore = useAuthStore();
    if (!authStore.user?.id || !authStore.token) {
      console.warn('[MessagingStore] Cannot initialize: not authenticated');
      return;
    }

    currentOrgId.value = orgId;
    isLoading.value = true;

    try {
      // Connect to WebSocket
      await messagingSocket.connect(authStore.token, authStore.user.id);
      isSocketConnected.value = true;

      // Set up global handlers
      messagingSocket.setOnNewMessageNotification((notification) => {
        handleNewMessageNotification(notification.conversationId, notification.message);
      });

      messagingSocket.setOnConversationCreated((conversation) => {
        conversations.value.set(conversation.id, conversation);
      });

      // Load conversations
      await loadConversations(orgId);

      // Load unread counts
      await loadUnreadCounts(orgId);
    } catch (error) {
      console.error('[MessagingStore] Failed to initialize:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load conversations for an organization.
   */
  async function loadConversations(orgId: number) {
    try {
      const convList = await listConversations(orgId);
      conversations.value.clear();
      for (const conv of convList) {
        conversations.value.set(conv.id, conv);
        if (conv.unreadCount !== undefined) {
          unreadCounts.value.set(conv.id, conv.unreadCount);
        }
      }
    } catch (error) {
      console.error('[MessagingStore] Failed to load conversations:', error);
    }
  }

  /**
   * Load unread counts for an organization.
   */
  async function loadUnreadCounts(orgId: number) {
    try {
      const counts = await getUnreadCounts(orgId);
      for (const [convId, count] of Object.entries(counts)) {
        unreadCounts.value.set(parseInt(convId), count);
      }
      totalUnread.value = await getTotalUnread();
    } catch (error) {
      console.error('[MessagingStore] Failed to load unread counts:', error);
    }
  }

  /**
   * Set the active conversation and load its messages.
   */
  async function setActiveConversation(conversationId: number | null) {
    // Leave previous conversation channel
    if (activeConversationId.value && activeConversationId.value !== conversationId) {
      messagingSocket.leaveConversation(activeConversationId.value);
    }

    activeConversationId.value = conversationId;

    if (!conversationId) return;

    // Join conversation channel
    await messagingSocket.joinConversation(conversationId, {
      onNewMessage: (message) => handleNewMessage(conversationId, message),
      onMessageEdited: (message) => handleMessageEdited(conversationId, message),
      onMessageDeleted: (event) => handleMessageDeleted(conversationId, event.messageId),
      onTyping: (event) => handleTyping(conversationId, event.userId),
      onRead: () => {
        // Could update read receipts UI here
      },
    });

    // Load messages if not already loaded
    if (!messages.value.has(conversationId)) {
      await loadMessages(conversationId);
    }

    // Mark as read
    await markAsRead(conversationId);
  }

  /**
   * Load messages for a conversation.
   */
  async function loadMessages(conversationId: number, opts?: { before?: number; limit?: number }) {
    isLoadingMessages.value = true;
    try {
      const msgs = await getMessages(conversationId, opts);
      
      if (opts?.before) {
        // Append to existing messages (pagination)
        const existing = messages.value.get(conversationId) || [];
        messages.value.set(conversationId, [...existing, ...msgs]);
      } else {
        // Replace messages
        messages.value.set(conversationId, msgs.reverse()); // Reverse to show oldest first
      }
    } catch (error) {
      console.error('[MessagingStore] Failed to load messages:', error);
    } finally {
      isLoadingMessages.value = false;
    }
  }

  /**
   * Send a message to the active conversation.
   */
  async function sendMessage(content: string) {
    if (!activeConversationId.value) return;

    try {
      // Use WebSocket for real-time delivery
      const message = await messagingSocket.sendMessage(activeConversationId.value, content);
      // Message will be added via the onNewMessage handler
      return message;
    } catch (error) {
      // Fallback to REST API
      console.warn('[MessagingStore] WebSocket send failed, using REST:', error);
      const message = await apiSendMessage(activeConversationId.value, content);
      handleNewMessage(activeConversationId.value, message);
      return message;
    }
  }

  /**
   * Edit a message.
   */
  async function editMessage(messageId: number, content: string) {
    if (!activeConversationId.value) return;

    try {
      const message = await messagingSocket.editMessage(activeConversationId.value, messageId, content);
      handleMessageEdited(activeConversationId.value, message);
      return message;
    } catch (error) {
      console.warn('[MessagingStore] WebSocket edit failed, using REST:', error);
      const message = await apiEditMessage(activeConversationId.value, messageId, content);
      handleMessageEdited(activeConversationId.value, message);
      return message;
    }
  }

  /**
   * Delete a message.
   */
  async function deleteMessage(messageId: number) {
    if (!activeConversationId.value) return;

    try {
      await messagingSocket.deleteMessage(activeConversationId.value, messageId);
      handleMessageDeleted(activeConversationId.value, messageId);
    } catch (error) {
      console.warn('[MessagingStore] WebSocket delete failed, using REST:', error);
      await apiDeleteMessage(activeConversationId.value, messageId);
      handleMessageDeleted(activeConversationId.value, messageId);
    }
  }

  /**
   * Mark conversation as read.
   */
  async function markAsRead(conversationId: number) {
    try {
      messagingSocket.markRead(conversationId);
      unreadCounts.value.set(conversationId, 0);
      recalculateTotalUnread();
    } catch (error) {
      console.warn('[MessagingStore] WebSocket markRead failed, using REST:', error);
      await apiMarkAsRead(conversationId);
      unreadCounts.value.set(conversationId, 0);
      recalculateTotalUnread();
    }
  }

  /**
   * Toggle mute for a conversation.
   */
  async function toggleMute(conversationId: number) {
    try {
      const result = await apiToggleMute(conversationId);
      const conv = conversations.value.get(conversationId);
      if (conv) {
        conv.muted = result.muted;
        conversations.value.set(conversationId, { ...conv });
      }
      return result.muted;
    } catch (error) {
      console.error('[MessagingStore] Failed to toggle mute:', error);
      throw error;
    }
  }

  /**
   * Send typing indicator.
   */
  function sendTyping() {
    if (activeConversationId.value) {
      messagingSocket.sendTyping(activeConversationId.value);
    }
  }

  /**
   * Create a direct conversation.
   */
  async function startDirectConversation(userId: number) {
    if (!currentOrgId.value) throw new Error('No organization selected');

    const conversation = await createDirectConversation(currentOrgId.value, userId);
    conversations.value.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Create a group conversation.
   */
  async function startGroupConversation(name: string, memberIds: number[]) {
    if (!currentOrgId.value) throw new Error('No organization selected');

    const conversation = await createGroupConversation(currentOrgId.value, name, memberIds);
    conversations.value.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Create an announcement.
   */
  async function sendAnnouncement(content: string) {
    if (!currentOrgId.value) throw new Error('No organization selected');

    const conversation = await createAnnouncement(currentOrgId.value, content);
    conversations.value.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Leave a conversation.
   */
  async function leaveConversation(conversationId: number) {
    await apiLeaveConversation(conversationId);
    conversations.value.delete(conversationId);
    messages.value.delete(conversationId);
    unreadCounts.value.delete(conversationId);
    
    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null;
    }
  }

  /**
   * Add a participant to a conversation.
   */
  async function addParticipant(conversationId: number, userId: number) {
    const participant = await apiAddParticipant(conversationId, userId);
    const conv = conversations.value.get(conversationId);
    if (conv) {
      conv.participants.push(participant);
      conversations.value.set(conversationId, { ...conv });
    }
    return participant;
  }

  /**
   * Remove a participant from a conversation.
   */
  async function removeParticipant(conversationId: number, userId: number) {
    await apiRemoveParticipant(conversationId, userId);
    const conv = conversations.value.get(conversationId);
    if (conv) {
      conv.participants = conv.participants.filter(p => p.userId !== userId);
      conversations.value.set(conversationId, { ...conv });
    }
  }

  /**
   * Cleanup and disconnect.
   */
  function cleanup() {
    messagingSocket.disconnect();
    isSocketConnected.value = false;
    conversations.value.clear();
    messages.value.clear();
    unreadCounts.value.clear();
    totalUnread.value = 0;
    activeConversationId.value = null;
    currentOrgId.value = null;
  }

  // ============================================================================
  // Internal Handlers
  // ============================================================================

  function handleNewMessage(conversationId: number, message: Message) {
    const msgs = messages.value.get(conversationId) || [];
    
    // Avoid duplicates
    if (!msgs.find(m => m.id === message.id)) {
      messages.value.set(conversationId, [...msgs, message]);
    }

    // Update conversation preview
    const conv = conversations.value.get(conversationId);
    if (conv) {
      conv.lastMessageAt = message.insertedAt;
      conv.lastMessagePreview = message.content.slice(0, 100);
      conversations.value.set(conversationId, { ...conv });
    }
  }

  function handleNewMessageNotification(conversationId: number, message: Message) {
    // Update unread count if not the active conversation
    if (conversationId !== activeConversationId.value) {
      const current = unreadCounts.value.get(conversationId) || 0;
      unreadCounts.value.set(conversationId, current + 1);
      recalculateTotalUnread();
    }

    // Update conversation preview
    const conv = conversations.value.get(conversationId);
    if (conv) {
      conv.lastMessageAt = message.insertedAt;
      conv.lastMessagePreview = message.content.slice(0, 100);
      conversations.value.set(conversationId, { ...conv });
    }

    // Add to messages if loaded
    if (messages.value.has(conversationId)) {
      handleNewMessage(conversationId, message);
    }
  }

  function handleMessageEdited(conversationId: number, message: Message) {
    const msgs = messages.value.get(conversationId);
    if (msgs) {
      const index = msgs.findIndex(m => m.id === message.id);
      if (index !== -1) {
        msgs[index] = message;
        messages.value.set(conversationId, [...msgs]);
      }
    }
  }

  function handleMessageDeleted(conversationId: number, messageId: number) {
    const msgs = messages.value.get(conversationId);
    if (msgs) {
      const index = msgs.findIndex(m => m.id === messageId);
      if (index !== -1) {
        // Mark as deleted rather than removing
        msgs[index] = { ...msgs[index], deletedAt: new Date().toISOString() };
        messages.value.set(conversationId, [...msgs]);
      }
    }
  }

  function handleTyping(conversationId: number, userId: number) {
    const authStore = useAuthStore();
    if (userId === authStore.user?.id) return; // Ignore own typing

    const users = typingUsers.value.get(conversationId) || new Set();
    users.add(userId);
    typingUsers.value.set(conversationId, users);

    // Clear typing indicator after 3 seconds
    setTimeout(() => {
      const current = typingUsers.value.get(conversationId);
      if (current) {
        current.delete(userId);
        typingUsers.value.set(conversationId, new Set(current));
      }
    }, 3000);
  }

  function recalculateTotalUnread() {
    let total = 0;
    unreadCounts.value.forEach(count => {
      total += count;
    });
    totalUnread.value = total;
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    conversations,
    messages,
    unreadCounts,
    totalUnread,
    activeConversationId,
    typingUsers,
    isLoading,
    isLoadingMessages,
    currentOrgId,
    isSocketConnected,

    // Computed
    conversationList,
    activeConversation,
    activeMessages,
    activeUnreadCount,
    activeTypingUsers,

    // Actions
    initialize,
    loadConversations,
    loadUnreadCounts,
    setActiveConversation,
    loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    toggleMute,
    sendTyping,
    startDirectConversation,
    startGroupConversation,
    sendAnnouncement,
    leaveConversation,
    addParticipant,
    removeParticipant,
    cleanup,
  };
});
