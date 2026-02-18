<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useMessagingStore } from '@/stores/messaging';
  import { useAuthStore } from '@/stores/auth';
  import api from '@/services/api';
  import type { Conversation, Message } from '@/services/messagingApi';
  import { getOrCreateSupportConversation } from '@/services/messagingApi';
  import PageLayout from '@/components/PageLayout.vue';
  import {
    MessageSquare,
    Search,
    Plus,
    X,
    Send,
    Bell,
    BellOff,
    Users,
    User,
    Check,
    Pencil,
    Trash2,
    Megaphone,
    MoreVertical,
    UserMinus,
    LogOut,
    MessagesSquare,
    Headset,
  } from 'lucide-vue-next';

  const messagingStore = useMessagingStore();
  const authStore = useAuthStore();
  const route = useRoute();
  const router = useRouter();

  const messageInput = ref('');
  const messagesContainer = ref<HTMLElement | null>(null);
  const isAtBottom = ref(true);
  const editingMessageId = ref<number | null>(null);
  const editContent = ref('');
  const searchQuery = ref('');
  const showNewConversationDialog = ref(false);
  const newConversationType = ref<'direct' | 'group'>('direct');
  const newGroupName = ref('');
  const selectedUserIds = ref<number[]>([]);
  const memberSearchQuery = ref('');
  const searchableUsers = ref<
    Array<{
      id: number;
      name: string | null;
      email: string;
      avatar_url: string | null;
      account_type: string;
      has_clipper_profile: boolean;
    }>
  >([]);
  const isLoadingMembers = ref(false);
  const isSearchingUsers = ref(false);
  const organizations = ref<Array<{ id: number; name: string }>>([]);
  const showConversationMenu = ref(false);
  const showParticipantsDialog = ref(false);
  const isDeletingConversation = ref(false);
  const isKickingUser = ref<number | null>(null);
  const menuButtonRef = ref<HTMLElement | null>(null);
  const menuPosition = ref({ top: 0, right: 0 });

  // Confirmation dialog state
  const showConfirmDialog = ref(false);
  const confirmDialogConfig = ref<{
    title: string;
    message: string;
    confirmText: string;
    confirmVariant: 'danger' | 'primary';
    onConfirm: () => void;
  }>({
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });

  const supportConversation = ref<Conversation | null>(null);
  const isLoadingSupportConversation = ref(false);

  let typingTimeout: number | null = null;

  const filteredConversations = computed(() => {
    // Filter out support conversations — they appear as a pinned entry above the list
    const regularConversations = messagingStore.conversationList.filter((conv) => conv.type !== 'support');
    if (!searchQuery.value) return regularConversations;
    const query = searchQuery.value.toLowerCase();
    return regularConversations.filter((conv) => {
      const name = getConversationName(conv).toLowerCase();
      return name.includes(query);
    });
  });

  const sortedMessages = computed(() => {
    return [...messagingStore.activeMessages].sort((a, b) => {
      const aTime = (a as any).insertedAt || (a as any).inserted_at;
      const bTime = (b as any).insertedAt || (b as any).inserted_at;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  });

  const typingUserNames = computed(() => {
    const names: string[] = [];
    messagingStore.activeTypingUsers.forEach((userId) => {
      const participant = messagingStore.activeConversation?.participants.find((p) => {
        const pUserId = (p as any).userId ?? (p as any).user_id;
        return pUserId === userId;
      });
      if (participant) {
        const name = getParticipantDisplayName(participant);
        if (name !== 'Unknown User') {
          names.push(name);
        }
      }
    });
    return names;
  });

  const filteredMembers = computed(() => {
    // Return searchable users directly (already filtered by backend)
    return searchableUsers.value;
  });

  const canCreateConversation = computed(() => {
    if (newConversationType.value === 'direct') {
      return selectedUserIds.value.length === 1;
    }
    return newGroupName.value.trim() && selectedUserIds.value.length >= 1;
  });

  // Check if current user is the conversation creator
  const isConversationCreator = computed(() => {
    if (!messagingStore.activeConversation) return false;
    const conv = messagingStore.activeConversation as any;
    // Check both camelCase and snake_case in case of mapping issues
    const creatorId = conv.createdByUserId ?? conv.created_by_user_id;
    return creatorId === authStore.user?.id;
  });

  // Check if current user is a conversation admin (can kick users)
  const isConversationAdmin = computed(() => {
    if (!messagingStore.activeConversation) return false;
    const myParticipant = messagingStore.activeConversation.participants.find((p) => {
      const pUserId = (p as any).userId ?? (p as any).user_id;
      return pUserId === authStore.user?.id;
    });
    return myParticipant?.role === 'admin';
  });

  // Get current user's org role for the active conversation's org
  const myOrgRole = computed(() => {
    return null; // Simplified - role checks handled by backend
  });

  // Check if user can kick a specific participant
  function canKickParticipant(participant: any): boolean {
    if (!isConversationAdmin.value) return false;
    const participantUserId = participant.userId ?? participant.user_id;
    if (participantUserId === authStore.user?.id) return false; // Can't kick self
    return true;
  }

  onMounted(async () => {
    if (!authStore.isAuthenticated) return;

    // Handle deep link parameters (e.g., /messages?to=123&message=hello)
    const toUserId = route.query.to ? parseInt(route.query.to as string) : null;
    const prefilledMessage = (route.query.message as string) || '';

    if (toUserId) {
      try {
        // Create or find global conversation
        const conversation = await messagingStore.startGlobalDirectConversation(toUserId);

        // Select the conversation
        await messagingStore.setActiveConversation(conversation.id);

        // Pre-fill the message input
        if (prefilledMessage) {
          messageInput.value = prefilledMessage;
        }

        // Clear URL params (clean history)
        router.replace({ path: '/messages' });
      } catch (error) {
        console.error('Failed to create global conversation:', error);
        // Fall back to normal initialization
        await loadOrganizationsAndMembers();
      }
    } else {
      // Normal initialization
      await loadOrganizationsAndMembers();
    }
  });

  onUnmounted(() => {
    messagingStore.cleanup();
  });

  watch(
    () => authStore.isAuthenticated,
    async (isAuth) => {
      if (isAuth) {
        await loadOrganizationsAndMembers();
      }
    }
  );

  watch(
    () => messagingStore.activeMessages.length,
    () => {
      if (isAtBottom.value) {
        scrollToBottom();
      }
    }
  );

  watch(
    () => messagingStore.activeConversationId,
    () => {
      scrollToBottom(false);
    }
  );

  async function loadOrganizationsAndMembers() {
    try {
      const orgsResponse = await api.get<{ organizations: Array<{ id: number; name: string }> }>('/organizations');
      organizations.value = orgsResponse.data.organizations || [];

      if (organizations.value.length === 0) {
        // No organizations — initialize messaging without org scope (global conversations only)
        await messagingStore.initialize();
      } else {
        // Initialize with first org
        await messagingStore.initialize(organizations.value[0].id);
      }

      // Always load/create the pinned support conversation
      await loadSupportConversation();
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  }

  async function searchUsers(query: string) {
    if (!query || query.trim().length < 2) {
      searchableUsers.value = [];
      return;
    }

    isSearchingUsers.value = true;
    try {
      const response = await api.get<{ data: Array<{
        id: number;
        name: string | null;
        email: string;
        avatar_url: string | null;
        account_type: string;
        has_clipper_profile: boolean;
      }> }>('/messaging/search-users', {
        params: { query, limit: 20 }
      });
      searchableUsers.value = response.data.data || [];
    } catch (error) {
      console.error('Failed to search users:', error);
      searchableUsers.value = [];
    } finally {
      isSearchingUsers.value = false;
    }
  }

  function getParticipantDisplayName(participant: any): string {
    if (!participant?.user) return 'Unknown User';
    // Handle both camelCase and snake_case
    return participant.user.displayName || participant.user.display_name || 'Unknown User';
  }

  function getConversationName(conversation: Conversation): string {
    if (conversation.name) return conversation.name;

    if (conversation.type === 'support') return 'Clippster Customer Support';

    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find((p) => {
        const oderId = (p as any).userId ?? (p as any).user_id;
        return oderId !== authStore.user?.id;
      });
      return getParticipantDisplayName(otherParticipant);
    }

    if (conversation.type === 'announcement') return 'Announcement';
    return 'Group Chat';
  }

  function getParticipantAvatarUrl(participant: any): string | null {
    if (!participant?.user) return null;
    // Handle both camelCase and snake_case
    return participant.user.avatarUrl || participant.user.avatar_url || null;
  }

  function getConversationAvatar(conversation: Conversation): string | null {
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find((p) => {
        const oderId = (p as any).userId ?? (p as any).user_id;
        return oderId !== authStore.user?.id;
      });
      return getParticipantAvatarUrl(otherParticipant);
    }
    return null;
  }

  function formatTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatMessageTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom(smooth = true) {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTo({
          top: messagesContainer.value.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    });
  }

  function handleScroll() {
    if (!messagesContainer.value) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
    isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50;
  }

  async function selectConversation(conversationId: number) {
    await messagingStore.setActiveConversation(conversationId);
  }

  async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    messageInput.value = '';

    try {
      await messagingStore.sendMessage(content);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      messageInput.value = content;
    }
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (editingMessageId.value) {
        saveEdit();
      } else {
        sendMessage();
      }
    }
  }

  function handleTyping() {
    if (typingTimeout) clearTimeout(typingTimeout);
    messagingStore.sendTyping();
    typingTimeout = window.setTimeout(() => {
      typingTimeout = null;
    }, 2000);
  }

  function startEdit(message: Message) {
    editingMessageId.value = message.id;
    editContent.value = message.content;
  }

  async function saveEdit() {
    if (!editingMessageId.value || !editContent.value.trim()) return;
    try {
      await messagingStore.editMessage(editingMessageId.value, editContent.value.trim());
      cancelEdit();
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  }

  function cancelEdit() {
    editingMessageId.value = null;
    editContent.value = '';
  }

  function deleteMessage(messageId: number) {
    showConfirm({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await messagingStore.deleteMessage(messageId);
        } catch (error) {
          console.error('Failed to delete message:', error);
        }
      },
    });
  }

  function toggleUserSelection(userId: number) {
    if (newConversationType.value === 'direct') {
      selectedUserIds.value = [userId];
    } else {
      const index = selectedUserIds.value.indexOf(userId);
      if (index === -1) {
        selectedUserIds.value.push(userId);
      } else {
        selectedUserIds.value.splice(index, 1);
      }
    }
  }

  // Debounced user search
  let searchTimeout: number | null = null;
  watch(memberSearchQuery, (newQuery) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      searchUsers(newQuery);
    }, 300);
  });

  async function createConversation() {
    if (!canCreateConversation.value) return;

    try {
      let conversation;
      if (newConversationType.value === 'direct') {
        // Use global direct conversation for all users
        conversation = await messagingStore.startGlobalDirectConversation(selectedUserIds.value[0]);
      } else {
        // Group conversations still need org context
        conversation = await messagingStore.startGroupConversation(newGroupName.value.trim(), selectedUserIds.value);
      }

      if (conversation) {
        await selectConversation(conversation.id);
        closeNewConversationDialog();
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }

  function openNewConversationDialog() {
    showNewConversationDialog.value = true;
    newConversationType.value = 'direct';
    newGroupName.value = '';
    selectedUserIds.value = [];
    memberSearchQuery.value = '';
    searchableUsers.value = [];
  }

  function closeNewConversationDialog() {
    showNewConversationDialog.value = false;
  }

  function getUnreadCount(conversationId: number): number {
    return messagingStore.unreadCounts.get(conversationId) || 0;
  }

  function toggleConversationMenu() {
    if (!showConversationMenu.value && menuButtonRef.value) {
      const rect = menuButtonRef.value.getBoundingClientRect();
      menuPosition.value = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };
    }
    showConversationMenu.value = !showConversationMenu.value;
  }

  function showConfirm(config: {
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary';
    onConfirm: () => void;
  }) {
    confirmDialogConfig.value = {
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Confirm',
      confirmVariant: config.confirmVariant || 'danger',
      onConfirm: config.onConfirm,
    };
    showConfirmDialog.value = true;
  }

  function closeConfirmDialog() {
    showConfirmDialog.value = false;
  }

  function handleConfirm() {
    confirmDialogConfig.value.onConfirm();
    closeConfirmDialog();
  }

  function closeConversationMenu() {
    showConversationMenu.value = false;
  }

  function openParticipantsDialog() {
    showParticipantsDialog.value = true;
    closeConversationMenu();
  }

  function closeParticipantsDialog() {
    showParticipantsDialog.value = false;
  }

  function handleDeleteConversation() {
    if (!messagingStore.activeConversation) return;
    const conversationId = messagingStore.activeConversation.id;
    closeConversationMenu();

    showConfirm({
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation? This cannot be undone.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        isDeletingConversation.value = true;
        try {
          await messagingStore.deleteConversation(conversationId);
        } catch (error) {
          console.error('Failed to delete conversation:', error);
        } finally {
          isDeletingConversation.value = false;
        }
      },
    });
  }

  function handleKickParticipant(userId: number) {
    if (!messagingStore.activeConversation) return;

    const participant = messagingStore.activeConversation.participants.find((p) => {
      const pUserId = (p as any).userId ?? (p as any).user_id;
      return pUserId === userId;
    });
    const name = participant ? getParticipantDisplayName(participant) : 'this user';
    const conversationId = messagingStore.activeConversation.id;

    showConfirm({
      title: 'Remove Participant',
      message: `Are you sure you want to remove ${name} from this conversation?`,
      confirmText: 'Remove',
      confirmVariant: 'danger',
      onConfirm: async () => {
        isKickingUser.value = userId;
        try {
          await messagingStore.removeParticipant(conversationId, userId);
        } catch (error: any) {
          console.error('Failed to remove participant:', error);
        } finally {
          isKickingUser.value = null;
        }
      },
    });
  }

  async function loadSupportConversation() {
    try {
      isLoadingSupportConversation.value = true;
      supportConversation.value = await getOrCreateSupportConversation();
    } catch (error) {
      console.error('Failed to load support conversation:', error);
    } finally {
      isLoadingSupportConversation.value = false;
    }
  }

  async function selectSupportConversation() {
    try {
      const conversation = await messagingStore.startSupportConversation();
      supportConversation.value = conversation;
      await messagingStore.setActiveConversation(conversation.id);
    } catch (error) {
      console.error('Failed to open support conversation:', error);
    }
  }

  function handleLeaveConversation() {
    if (!messagingStore.activeConversation) return;
    const conversationId = messagingStore.activeConversation.id;
    closeConversationMenu();

    showConfirm({
      title: 'Leave Conversation',
      message: 'Are you sure you want to leave this conversation? You will no longer receive messages.',
      confirmText: 'Leave',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await messagingStore.leaveConversation(conversationId);
        } catch (error) {
          console.error('Failed to leave conversation:', error);
        }
      },
    });
  }
</script>

<template>
  <div class="messages">
    <PageLayout
      title="Messages"
      description="Chat with your team and organization members"
      :show-header="true"
      :icon="MessageSquare"
    >
      <template #actions>
        <button @click="openNewConversationDialog" class="messages-header__new-btn">
          <Plus class="messages-header__new-btn-icon" />
          New Conversation
        </button>
      </template>

      <div class="messages__content">
        <!-- Page Heading -->
        <div class="messages__heading">
          <h1 class="messages__title">Messages</h1>
          <p class="messages__subtitle">Chat with your team and organization members</p>
        </div>

        <!-- Main Messages Container -->
        <div class="messages__main">
          <!-- Conversations Panel (Left) -->
          <div class="messages-panel">
            <div class="messages-panel__inner">
              <!-- Panel Header -->
              <div class="messages-panel__header">
                <div class="messages-panel__header-left">
                  <div class="messages-panel__header-icon">
                    <MessagesSquare />
                  </div>
                  <div class="messages-panel__header-text">
                    <h2 class="messages-panel__title">Conversations</h2>
                    <p class="messages-panel__subtitle">
                      {{ filteredConversations.length }} {{ filteredConversations.length === 1 ? 'chat' : 'chats' }}
                    </p>
                  </div>
                </div>
                <button @click="openNewConversationDialog" class="messages-panel__new-btn" title="New conversation">
                  <Plus class="messages-panel__new-btn-icon" />
                </button>
              </div>

              <!-- Search Box -->
              <div class="messages-panel__search">
                <Search class="messages-panel__search-icon" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search conversations..."
                  class="messages-panel__search-input"
                />
              </div>

              <!-- Conversations List -->
              <div class="messages-panel__list">
                <!-- Loading Skeleton -->
                <template v-if="messagingStore.isLoading">
                  <div v-for="i in 4" :key="i" class="messages-conv-skeleton">
                    <div class="messages-conv-skeleton__avatar"></div>
                    <div class="messages-conv-skeleton__content">
                      <div class="messages-conv-skeleton__line messages-conv-skeleton__line--name"></div>
                      <div class="messages-conv-skeleton__line messages-conv-skeleton__line--preview"></div>
                    </div>
                  </div>
                </template>

                <!-- Conversations -->
                <template v-else>
                  <!-- Pinned Support Chat -->
                  <div
                    v-if="supportConversation"
                    class="messages-conv messages-conv--pinned"
                    :class="{
                      'messages-conv--active': supportConversation.id === messagingStore.activeConversationId,
                      'messages-conv--unread': getUnreadCount(supportConversation.id) > 0,
                    }"
                    @click="selectSupportConversation"
                  >
                    <div
                      class="messages-conv__indicator"
                      :class="{
                        'messages-conv__indicator--active': supportConversation.id === messagingStore.activeConversationId,
                        'messages-conv__indicator--unread':
                          getUnreadCount(supportConversation.id) > 0 && supportConversation.id !== messagingStore.activeConversationId,
                      }"
                    ></div>
                    <div class="messages-conv__inner">
                      <div class="messages-conv__avatar-wrapper">
                        <div class="messages-conv__avatar messages-conv__avatar--support">
                          <Headset class="messages-conv__avatar-icon" />
                        </div>
                      </div>
                      <div class="messages-conv__content">
                        <div class="messages-conv__header">
                          <span class="messages-conv__name">Clippster Customer Support</span>
                          <span class="messages-conv__time">{{ formatTime(supportConversation.lastMessageAt) }}</span>
                        </div>
                        <div class="messages-conv__footer">
                          <span class="messages-conv__preview">{{ supportConversation.lastMessagePreview || 'Get help from our support team' }}</span>
                          <span v-if="getUnreadCount(supportConversation.id) > 0" class="messages-conv__badge">
                            {{ getUnreadCount(supportConversation.id) > 99 ? '99+' : getUnreadCount(supportConversation.id) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Regular Conversations -->
                  <div
                    v-for="conv in filteredConversations"
                    :key="conv.id"
                    class="messages-conv"
                    :class="{
                      'messages-conv--active': conv.id === messagingStore.activeConversationId,
                      'messages-conv--unread': getUnreadCount(conv.id) > 0,
                    }"
                    @click="selectConversation(conv.id)"
                  >
                    <div
                      class="messages-conv__indicator"
                      :class="{
                        'messages-conv__indicator--active': conv.id === messagingStore.activeConversationId,
                        'messages-conv__indicator--unread':
                          getUnreadCount(conv.id) > 0 && conv.id !== messagingStore.activeConversationId,
                      }"
                    ></div>
                    <div class="messages-conv__inner">
                      <!-- Avatar -->
                      <div class="messages-conv__avatar-wrapper">
                        <div
                          class="messages-conv__avatar"
                          :class="{
                            'messages-conv__avatar--direct': conv.type === 'direct',
                            'messages-conv__avatar--group': conv.type === 'group',
                            'messages-conv__avatar--announcement': conv.type === 'announcement',
                            'messages-conv__avatar--support': conv.type === 'support',
                          }"
                        >
                          <img
                            v-if="getConversationAvatar(conv)"
                            :src="getConversationAvatar(conv)!"
                            alt=""
                            class="messages-conv__avatar-img"
                          />
                          <Headset v-else-if="conv.type === 'support'" class="messages-conv__avatar-icon" />
                          <Users v-else-if="conv.type === 'group'" class="messages-conv__avatar-icon" />
                          <Megaphone v-else-if="conv.type === 'announcement'" class="messages-conv__avatar-icon" />
                          <span v-else class="messages-conv__avatar-initial">
                            {{ getConversationName(conv).charAt(0).toUpperCase() }}
                          </span>
                        </div>
                      </div>

                      <!-- Content -->
                      <div class="messages-conv__content">
                        <div class="messages-conv__header">
                          <span class="messages-conv__name">{{ getConversationName(conv) }}</span>
                          <span class="messages-conv__time">{{ formatTime(conv.lastMessageAt) }}</span>
                        </div>
                        <div class="messages-conv__footer">
                          <span class="messages-conv__preview">{{ conv.lastMessagePreview || 'No messages yet' }}</span>
                          <span v-if="getUnreadCount(conv.id) > 0" class="messages-conv__badge">
                            {{ getUnreadCount(conv.id) > 99 ? '99+' : getUnreadCount(conv.id) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </template>
              </div>

            </div>
          </div>

          <!-- Chat Panel (Right) -->
          <div class="messages-chat">
            <div class="messages-chat__inner">
              <template v-if="messagingStore.activeConversation">
                <!-- Chat Header -->
                <div class="messages-chat__header">
                  <div class="messages-chat__header-left">
                    <div
                      class="messages-chat__avatar"
                      :class="{
                        'messages-chat__avatar--direct': messagingStore.activeConversation.type === 'direct',
                        'messages-chat__avatar--group': messagingStore.activeConversation.type === 'group',
                        'messages-chat__avatar--announcement':
                          messagingStore.activeConversation.type === 'announcement',
                        'messages-chat__avatar--support': messagingStore.activeConversation.type === 'support',
                      }"
                    >
                      <img
                        v-if="getConversationAvatar(messagingStore.activeConversation)"
                        :src="getConversationAvatar(messagingStore.activeConversation)!"
                        alt=""
                        class="messages-chat__avatar-img"
                      />
                      <Headset
                        v-else-if="messagingStore.activeConversation.type === 'support'"
                        class="messages-chat__avatar-icon"
                      />
                      <Users
                        v-else-if="messagingStore.activeConversation.type === 'group'"
                        class="messages-chat__avatar-icon"
                      />
                      <Megaphone
                        v-else-if="messagingStore.activeConversation.type === 'announcement'"
                        class="messages-chat__avatar-icon"
                      />
                      <span v-else class="messages-chat__avatar-initial">
                        {{ getConversationName(messagingStore.activeConversation).charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div class="messages-chat__header-info">
                      <h3 class="messages-chat__name">
                        {{ getConversationName(messagingStore.activeConversation) }}
                      </h3>
                      <p class="messages-chat__meta">
                        {{
                          messagingStore.activeConversation.type === 'direct'
                            ? 'Direct message'
                            : messagingStore.activeConversation.type === 'group'
                              ? `${messagingStore.activeConversation.participants.length} members`
                              : 'Announcement'
                        }}
                      </p>
                    </div>
                  </div>

                  <div class="messages-chat__header-actions">
                    <button
                      class="messages-chat__action-btn"
                      :class="{ 'messages-chat__action-btn--muted': messagingStore.activeConversation.muted }"
                      @click="messagingStore.toggleMute(messagingStore.activeConversation.id)"
                      :title="messagingStore.activeConversation.muted ? 'Unmute' : 'Mute'"
                    >
                      <BellOff v-if="messagingStore.activeConversation.muted" class="messages-chat__action-icon" />
                      <Bell v-else class="messages-chat__action-icon" />
                    </button>
                    <button
                      ref="menuButtonRef"
                      @click="toggleConversationMenu"
                      class="messages-chat__action-btn"
                      title="Conversation options"
                    >
                      <MoreVertical class="messages-chat__action-icon" />
                    </button>
                  </div>
                </div>

                <!-- Messages Container -->
                <div ref="messagesContainer" class="messages-chat__messages" @scroll="handleScroll">
                  <!-- Loading Messages -->
                  <div v-if="messagingStore.isLoadingMessages" class="messages-chat__loading">
                    <Loader2 class="messages-chat__loading-spinner" />
                  </div>

                  <!-- Messages List -->
                  <div
                    v-for="message in sortedMessages"
                    :key="message.id"
                    class="message-row"
                    :class="{ 'message-row--sent': message.senderId === authStore.user?.id }"
                  >
                    <div
                      class="message-bubble"
                      :class="{
                        'message-bubble--sent': message.senderId === authStore.user?.id,
                        'message-bubble--received': message.senderId !== authStore.user?.id,
                        'message-bubble--deleted': !!message.deletedAt,
                      }"
                    >
                      <!-- Sender Name -->
                      <div
                        v-if="message.senderId !== authStore.user?.id && message.sender"
                        class="message-bubble__sender"
                      >
                        {{ message.sender.displayName || 'Unknown' }}
                      </div>

                      <!-- Edit Mode -->
                      <template v-if="editingMessageId === message.id">
                        <textarea
                          v-model="editContent"
                          @keydown.enter.exact.prevent="saveEdit"
                          @keydown.escape="cancelEdit"
                          class="message-bubble__edit-input"
                          rows="2"
                        ></textarea>
                        <div class="message-bubble__edit-actions">
                          <button @click="saveEdit" class="message-bubble__edit-btn message-bubble__edit-btn--save">
                            Save
                          </button>
                          <button @click="cancelEdit" class="message-bubble__edit-btn message-bubble__edit-btn--cancel">
                            Cancel
                          </button>
                        </div>
                      </template>

                      <!-- Message Content -->
                      <template v-else>
                        <p v-if="message.deletedAt" class="message-bubble__deleted">Message deleted</p>
                        <p v-else class="message-bubble__content">{{ message.content }}</p>
                      </template>

                      <!-- Meta Info -->
                      <div class="message-bubble__meta">
                        <span class="message-bubble__time">
                          {{ formatMessageTime(message.insertedAt) }}
                        </span>
                        <span v-if="message.editedAt && !message.deletedAt" class="message-bubble__edited">
                          edited
                        </span>
                        <span
                          v-if="message.senderId === authStore.user?.id && !message.deletedAt"
                          class="message-bubble__status"
                          :class="{
                            'message-bubble__status--read': message.readBy && message.readBy.length > 1,
                          }"
                        >
                          {{ message.readBy && message.readBy.length > 1 ? '• Read' : '• Sent' }}
                        </span>
                      </div>

                      <!-- Message Actions -->
                      <div
                        v-if="
                          message.senderId === authStore.user?.id &&
                          !message.deletedAt &&
                          editingMessageId !== message.id
                        "
                        class="message-bubble__actions"
                      >
                        <button @click="startEdit(message)" class="message-bubble__action" title="Edit">
                          <Pencil class="message-bubble__action-icon" />
                        </button>
                        <button
                          @click="deleteMessage(message.id)"
                          class="message-bubble__action message-bubble__action--delete"
                          title="Delete"
                        >
                          <Trash2 class="message-bubble__action-icon" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Typing Indicator -->
                  <div v-if="typingUserNames.length > 0" class="messages-chat__typing">
                    <div class="messages-chat__typing-dots">
                      <span class="messages-chat__typing-dot" style="animation-delay: 0ms"></span>
                      <span class="messages-chat__typing-dot" style="animation-delay: 150ms"></span>
                      <span class="messages-chat__typing-dot" style="animation-delay: 300ms"></span>
                    </div>
                    <span class="messages-chat__typing-text">
                      {{ typingUserNames.join(', ') }} {{ typingUserNames.length === 1 ? 'is' : 'are' }} typing...
                    </span>
                  </div>
                </div>

                <!-- Message Input -->
                <div class="messages-chat__input-area">
                  <textarea
                    v-model="messageInput"
                    placeholder="Write a message..."
                    rows="1"
                    @keydown="handleInputKeydown"
                    @input="handleTyping"
                    class="messages-chat__input"
                  ></textarea>
                  <button
                    class="messages-chat__send-btn"
                    :class="{ 'messages-chat__send-btn--disabled': !messageInput.trim() }"
                    :disabled="!messageInput.trim()"
                    @click="sendMessage"
                  >
                    <Send class="messages-chat__send-icon" />
                  </button>
                </div>
              </template>

              <!-- No Conversation Selected -->
              <div v-else class="messages-chat__empty">
                <div class="messages-chat__empty-icon">
                  <MessageSquare />
                </div>
                <h2 class="messages-chat__empty-title">Select a conversation</h2>
                <p class="messages-chat__empty-text">Choose from your existing conversations or start a new one</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- New Conversation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showNewConversationDialog" class="messages-modal__overlay" @click.self="closeNewConversationDialog">
          <Transition name="dialog" appear>
            <div class="messages-modal messages-modal--new-conversation">
              <div class="messages-modal__accent"></div>

              <!-- Header -->
              <div class="messages-modal__header messages-modal__header--centered">
                <button @click="closeNewConversationDialog" class="messages-modal__close messages-modal__close--corner">
                  <X />
                </button>
                <div class="messages-modal__icon messages-modal__icon--large">
                  <MessageSquare />
                </div>
                <h2 class="messages-modal__title">New Conversation</h2>
              </div>

              <!-- Type Tabs -->
              <div class="messages-modal__tabs-nav">
                <button
                  @click="
                    newConversationType = 'direct';
                    selectedUserIds = [];
                  "
                  class="messages-modal__tabs-item"
                  :class="{ 'messages-modal__tabs-item--active': newConversationType === 'direct' }"
                >
                  <User :size="14" />
                  <span>Direct Message</span>
                </button>
                <button
                  @click="
                    newConversationType = 'group';
                    selectedUserIds = [];
                  "
                  class="messages-modal__tabs-item"
                  :class="{ 'messages-modal__tabs-item--active': newConversationType === 'group' }"
                >
                  <Users :size="14" />
                  <span>Group Chat</span>
                </button>
              </div>

              <!-- Content -->
              <div class="messages-modal__body messages-modal__body--scrollable">
                <!-- Group Name Input -->
                <div v-if="newConversationType === 'group'" class="messages-modal__field">
                  <label class="messages-modal__label">Group Name</label>
                  <input
                    v-model="newGroupName"
                    type="text"
                    placeholder="Enter group name..."
                    class="messages-modal__input"
                  />
                </div>

                <!-- Member Search -->
                <div class="messages-modal__field">
                  <label class="messages-modal__label">
                    {{ newConversationType === 'direct' ? 'Select User' : 'Select Members' }}
                  </label>
                  <div class="messages-modal__search">
                    <Search class="messages-modal__search-icon" />
                    <input
                      v-model="memberSearchQuery"
                      type="text"
                      placeholder="Search members..."
                      class="messages-modal__search-input"
                    />
                  </div>
                </div>

                <!-- Members List -->
                <div class="messages-modal__members">
                  <div
                    v-for="user in filteredMembers"
                    :key="user.id"
                    class="messages-modal__member"
                    :class="{ 'messages-modal__member--selected': selectedUserIds.includes(user.id) }"
                    @click="toggleUserSelection(user.id)"
                  >
                    <div class="messages-modal__member-avatar">
                      <img v-if="user.avatar_url" :src="user.avatar_url" alt="" class="messages-modal__member-img" />
                      <span v-else class="messages-modal__member-initial">
                        {{ (user.name || user.email).charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div class="messages-modal__member-info">
                      <p class="messages-modal__member-name">{{ user.name || user.email }}</p>
                      <p class="messages-modal__member-org">{{ user.account_type === 'organization' ? 'Organization' : 'User' }}</p>
                    </div>
                    <div v-if="selectedUserIds.includes(user.id)" class="messages-modal__member-check">
                      <Check />
                    </div>
                  </div>

                  <!-- No Results -->
                  <div v-if="filteredMembers.length === 0 && !isSearchingUsers && memberSearchQuery.trim().length >= 2" class="messages-modal__members-empty">
                    No users found
                  </div>

                  <!-- Search Prompt -->
                  <div v-if="memberSearchQuery.trim().length < 2 && !isSearchingUsers" class="messages-modal__members-empty">
                    Type at least 2 characters to search
                  </div>

                  <!-- Loading -->
                  <div v-if="isSearchingUsers" class="messages-modal__members-loading">
                    <Loader2 class="messages-modal__members-spinner" />
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="messages-modal__footer">
                <button @click="closeNewConversationDialog" class="messages-modal__btn messages-modal__btn--secondary">
                  Cancel
                </button>
                <button
                  @click="createConversation"
                  :disabled="!canCreateConversation"
                  class="messages-modal__btn messages-modal__btn--primary"
                  :class="{ 'messages-modal__btn--disabled': !canCreateConversation }"
                >
                  Create
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Conversation Menu Dropdown -->
    <Teleport to="body">
      <div v-if="showConversationMenu" class="messages-dropdown__backdrop" @click="closeConversationMenu"></div>

      <Transition name="fade">
        <div
          v-if="showConversationMenu && messagingStore.activeConversation"
          class="messages-dropdown"
          :style="{ top: menuPosition.top + 'px', right: menuPosition.right + 'px' }"
        >
          <!-- Manage Participants (group chats only) -->
          <button
            v-if="messagingStore.activeConversation.type === 'group' && isConversationAdmin"
            @click="openParticipantsDialog"
            class="messages-dropdown__item"
          >
            <Users class="messages-dropdown__item-icon" />
            Manage Participants
          </button>

          <!-- Leave Conversation (any type, not creator) -->
          <button v-if="!isConversationCreator" @click="handleLeaveConversation" class="messages-dropdown__item">
            <LogOut class="messages-dropdown__item-icon" />
            Leave Conversation
          </button>

          <!-- Delete Conversation (creator only) -->
          <button
            v-if="isConversationCreator"
            @click="handleDeleteConversation"
            class="messages-dropdown__item messages-dropdown__item--danger"
            :disabled="isDeletingConversation"
          >
            <Loader2 v-if="isDeletingConversation" class="messages-dropdown__item-icon messages-dropdown__spinner" />
            <Trash2 v-else class="messages-dropdown__item-icon" />
            Delete Conversation
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirmDialog" class="messages-modal__overlay" @click.self="closeConfirmDialog">
          <Transition name="dialog" appear>
            <div class="messages-modal messages-modal--confirm">
              <div
                class="messages-modal__accent"
                :class="{
                  'messages-modal__accent--danger': confirmDialogConfig.confirmVariant === 'danger',
                }"
              ></div>

              <!-- Header -->
              <div class="messages-modal__confirm-header">
                <div
                  class="messages-modal__icon"
                  :class="{ 'messages-modal__icon--danger': confirmDialogConfig.confirmVariant === 'danger' }"
                >
                  <Trash2 v-if="confirmDialogConfig.confirmVariant === 'danger'" />
                  <MessageSquare v-else />
                </div>
                <h2 class="messages-modal__title">{{ confirmDialogConfig.title }}</h2>
              </div>

              <!-- Content -->
              <div class="messages-modal__confirm-body">
                <p class="messages-modal__confirm-text">{{ confirmDialogConfig.message }}</p>
              </div>

              <!-- Footer -->
              <div class="messages-modal__footer">
                <button @click="closeConfirmDialog" class="messages-modal__btn messages-modal__btn--secondary">
                  Cancel
                </button>
                <button
                  @click="handleConfirm"
                  class="messages-modal__btn"
                  :class="
                    confirmDialogConfig.confirmVariant === 'danger'
                      ? 'messages-modal__btn--danger'
                      : 'messages-modal__btn--primary'
                  "
                >
                  {{ confirmDialogConfig.confirmText }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Participants Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showParticipantsDialog && messagingStore.activeConversation"
          class="messages-modal__overlay"
          @click.self="closeParticipantsDialog"
        >
          <Transition name="dialog" appear>
            <div class="messages-modal messages-modal--participants">
              <div class="messages-modal__accent messages-modal__accent--participants"></div>

              <!-- Header -->
              <div class="messages-modal__header">
                <div class="messages-modal__header-left">
                  <div class="messages-modal__icon messages-modal__icon--participants">
                    <Users />
                  </div>
                  <h2 class="messages-modal__title">Participants</h2>
                </div>
                <button @click="closeParticipantsDialog" class="messages-modal__close">
                  <X />
                </button>
              </div>

              <!-- Content -->
              <div class="messages-modal__participants-list">
                <div
                  v-for="participant in messagingStore.activeConversation.participants"
                  :key="participant.userId"
                  class="messages-modal__participant"
                >
                  <div class="messages-modal__participant-avatar">
                    <img
                      v-if="getParticipantAvatarUrl(participant)"
                      :src="getParticipantAvatarUrl(participant)!"
                      alt=""
                      class="messages-modal__participant-img"
                    />
                    <span v-else class="messages-modal__participant-initial">
                      {{ getParticipantDisplayName(participant).charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="messages-modal__participant-info">
                    <div class="messages-modal__participant-name-row">
                      <p class="messages-modal__participant-name">
                        {{ getParticipantDisplayName(participant) }}
                        <span
                          v-if="((participant as any).userId ?? (participant as any).user_id) === authStore.user?.id"
                          class="messages-modal__participant-you"
                        >
                          (you)
                        </span>
                      </p>
                      <span v-if="participant.role === 'admin'" class="messages-modal__participant-badge">Admin</span>
                    </div>
                    <p class="messages-modal__participant-joined">Joined {{ formatTime(participant.joinedAt) }}</p>
                  </div>

                  <!-- Kick Button -->
                  <button
                    v-if="canKickParticipant(participant)"
                    @click="handleKickParticipant((participant as any).userId ?? (participant as any).user_id)"
                    :disabled="isKickingUser === ((participant as any).userId ?? (participant as any).user_id)"
                    class="messages-modal__participant-kick"
                    title="Remove from conversation"
                  >
                    <Loader2
                      v-if="isKickingUser === ((participant as any).userId ?? (participant as any).user_id)"
                      class="messages-modal__participant-kick-spinner"
                    />
                    <UserMinus v-else class="messages-modal__participant-kick-icon" />
                  </button>
                </div>
              </div>

              <!-- Footer -->
              <div class="messages-modal__footer messages-modal__footer--single">
                <button @click="closeParticipantsDialog" class="messages-modal__btn messages-modal__btn--secondary">
                  Close
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  /* ===== Header Actions ===== */
  .messages-header__new-btn {
    height: 32px;
    padding: 0 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-header__new-btn:hover {
    opacity: 0.9;
  }

  .messages-header__new-btn-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Page Container ===== */
  .messages {
    width: 100%;
    height: 100%;
  }

  .messages__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    padding-bottom: 2rem;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  /* ===== Page Heading ===== */
  .messages__heading {
    flex-shrink: 0;
  }

  .messages__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .messages__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Main Container ===== */
  .messages__main {
    display: flex;
    gap: 1rem;
    flex: 1;
    min-height: 0;
    margin-top: 0.8rem;
    overflow: hidden;
  }

  /* ===== Conversations Panel ===== */
  .messages-panel {
    width: 320px;
    flex-shrink: 0;
    display: flex;
    background-color: var(--sidebar-surface);
    border-radius: 10px;
    overflow: hidden;
  }

  .messages-panel__inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .messages-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.875rem;
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .messages-panel__header-left {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .messages-panel__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    flex-shrink: 0;
  }

  .messages-panel__header-icon svg {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
    stroke: var(--sidebar-accent);
  }

  .messages-panel__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .messages-panel__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .messages-panel__new-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-panel__new-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .messages-panel__new-btn-icon {
    width: 18px;
    height: 18px;
  }

  /* Search */
  .messages-panel__search {
    position: relative;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .messages-panel__search-icon {
    position: absolute;
    left: 1.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .messages-panel__search-input {
    width: 100%;
    height: 36px;
    padding-left: 2rem;
    padding-right: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .messages-panel__search-input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .messages-panel__search-input:hover {
    border-color: var(--sidebar-border);
  }

  .messages-panel__search-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background-color: var(--sidebar-surface);
  }

  /* Conversations List */
  .messages-panel__list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .messages-panel__list::-webkit-scrollbar {
    width: 6px;
  }

  .messages-panel__list::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-panel__list::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* Contact Support Footer */
  .messages-panel__footer {
    flex-shrink: 0;
    padding: 0.75rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .messages-panel__support-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 1rem;
    background-color: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #a855f7;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-panel__support-btn:hover:not(:disabled) {
    background-color: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .messages-panel__support-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .messages-panel__support-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .messages-panel__support-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* Conversation Item */
  .messages-conv {
    display: flex;
    margin-bottom: 0.375rem;
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-conv:hover {
    background-color: var(--sidebar-hover);
  }

  .messages-conv--active {
    background-color: var(--sidebar-active);
  }

  .messages-conv__indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: transparent;
    border-radius: 3px 0 0 3px;
  }

  .messages-conv__indicator--active {
    background-color: var(--sidebar-accent);
  }

  .messages-conv__indicator--unread {
    background-color: #ef4444;
  }

  .messages-conv__inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .messages-conv__avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .messages-conv__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
  }

  .messages-conv__avatar--direct {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  }

  .messages-conv__avatar--group {
    background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
  }

  .messages-conv__avatar--announcement {
    background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  }

  .messages-conv--pinned {
    border-bottom: 2px solid rgba(139, 92, 246, 0.3);
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .messages-conv__avatar--support {
    background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  }

  .messages-conv__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .messages-conv__avatar-icon {
    width: 20px;
    height: 20px;
  }

  .messages-conv__avatar-initial {
    font-size: 1rem;
    font-weight: 600;
  }

  .messages-conv__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .messages-conv__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .messages-conv__name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .messages-conv__time {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .messages-conv__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .messages-conv__preview {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .messages-conv__badge {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: 700;
    background-color: #ef4444;
    color: white;
    border-radius: 9px;
    flex-shrink: 0;
  }

  /* Empty State */
  .messages-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    text-align: center;
  }

  .messages-panel__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background-color: var(--sidebar-hover);
    border-radius: 12px;
    margin-bottom: 1rem;
    color: var(--sidebar-text-muted);
  }

  .messages-panel__empty-icon svg {
    width: 24px;
    height: 24px;
  }

  .messages-panel__empty-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .messages-panel__empty-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.25rem;
  }

  .messages-panel__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-panel__empty-btn:hover {
    opacity: 0.9;
  }

  .messages-panel__empty-btn-icon {
    width: 14px;
    height: 14px;
  }

  /* Skeleton Loading */
  .messages-conv-skeleton {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.375rem;
  }

  .messages-conv-skeleton__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .messages-conv-skeleton__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .messages-conv-skeleton__line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .messages-conv-skeleton__line--name {
    height: 14px;
    width: 60%;
  }

  .messages-conv-skeleton__line--preview {
    height: 12px;
    width: 80%;
  }

  /* ===== Chat Panel ===== */
  .messages-chat {
    flex: 1;
    display: flex;
    background-color: var(--sidebar-surface);
    border-radius: 10px;
    overflow: hidden;
  }

  .messages-chat__inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Chat Header */
  .messages-chat__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
  }

  .messages-chat__header-left {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .messages-chat__avatar {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .messages-chat__avatar--direct {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  }

  .messages-chat__avatar--group {
    background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
  }

  .messages-chat__avatar--announcement {
    background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  }

  .messages-chat__avatar--support {
    background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  }

  .messages-chat__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .messages-chat__avatar-icon {
    width: 20px;
    height: 20px;
  }

  .messages-chat__avatar-initial {
    font-size: 1rem;
    font-weight: 600;
  }

  .messages-chat__header-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .messages-chat__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .messages-chat__meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .messages-chat__header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .messages-chat__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-chat__action-btn:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .messages-chat__action-btn--muted {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .messages-chat__action-btn--muted:hover {
    background-color: rgba(245, 158, 11, 0.25);
  }

  .messages-chat__action-icon {
    width: 16px;
    height: 16px;
  }

  /* Messages Container */
  .messages-chat__messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .messages-chat__messages::-webkit-scrollbar {
    width: 6px;
  }

  .messages-chat__messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-chat__messages::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .messages-chat__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .messages-chat__loading-spinner {
    width: 24px;
    height: 24px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  /* Message Row */
  .message-row {
    display: flex;
    justify-content: flex-start;
  }

  .message-row--sent {
    justify-content: flex-end;
  }

  /* Message Bubble */
  .message-bubble {
    position: relative;
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 16px;
  }

  .message-bubble--sent {
    background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
    color: white;
    border-bottom-right-radius: 4px;
  }

  .message-bubble--received {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border-bottom-left-radius: 4px;
  }

  .message-bubble--deleted {
    opacity: 0.6;
  }

  .message-bubble__sender {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    margin-bottom: 0.375rem;
  }

  .message-bubble__content {
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }

  .message-bubble__deleted {
    font-size: 0.875rem;
    font-style: italic;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .message-bubble__meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.375rem;
  }

  .message-bubble__time {
    font-size: 0.625rem;
    opacity: 0.7;
  }

  .message-bubble--sent .message-bubble__time,
  .message-bubble--sent .message-bubble__edited {
    color: white;
    opacity: 1;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .message-bubble__edited {
    font-size: 0.625rem;
    opacity: 0.7;
  }

  .message-bubble__edited::before {
    content: '• ';
  }

  .message-bubble__status {
    font-size: 0.625rem;
    opacity: 1;
    color: white;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .message-bubble__status--read {
    color: #fef08a;
    opacity: 1;
    font-weight: 700;
  }

  /* Message Edit */
  .message-bubble__edit-input {
    width: 100%;
    padding: 0.5rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    resize: none;
  }

  .message-bubble__edit-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
  }

  .message-bubble__edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .message-bubble__edit-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .message-bubble__edit-btn--save {
    background-color: #10b981;
    color: white;
  }

  .message-bubble__edit-btn--save:hover {
    background-color: #059669;
  }

  .message-bubble__edit-btn--cancel {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .message-bubble__edit-btn--cancel:hover {
    background-color: var(--sidebar-active);
  }

  /* Message Actions */
  .message-bubble__actions {
    position: absolute;
    left: -60px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .message-bubble:hover .message-bubble__actions {
    opacity: 1;
  }

  .message-bubble__action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .message-bubble__action:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .message-bubble__action--delete:hover {
    background-color: #ef4444;
    color: white;
  }

  .message-bubble__action-icon {
    width: 14px;
    height: 14px;
  }

  /* Typing Indicator */
  .messages-chat__typing {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .messages-chat__typing-dots {
    display: flex;
    gap: 0.25rem;
  }

  .messages-chat__typing-dot {
    width: 6px;
    height: 6px;
    background-color: var(--sidebar-text-muted);
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite;
  }

  .messages-chat__typing-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-style: italic;
  }

  /* Input Area */
  .messages-chat__input-area {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
  }

  .messages-chat__input {
    flex: 1;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid transparent;
    border-radius: 12px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    resize: none;
    max-height: 120px;
    transition: all 150ms ease;
  }

  .messages-chat__input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .messages-chat__input:hover {
    border-color: var(--sidebar-border);
  }

  .messages-chat__input:focus {
    outline: none;
    border-color: var(--sidebar-border);
    background-color: var(--sidebar-surface);
  }

  .messages-chat__send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .messages-chat__send-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .messages-chat__send-btn--disabled {
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    cursor: not-allowed;
  }

  .messages-chat__send-icon {
    width: 20px;
    height: 20px;
  }

  /* Empty State */
  .messages-chat__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }

  .messages-chat__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
    color: var(--sidebar-text-muted);
  }

  .messages-chat__empty-icon svg {
    width: 32px;
    height: 32px;
  }

  .messages-chat__empty-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .messages-chat__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 280px;
  }

  /* ===== Modal Styles ===== */
  .messages-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .messages-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .messages-modal--confirm {
    max-width: 380px;
  }

  .messages-modal--participants {
    max-width: 420px;
  }

  .messages-modal--new-conversation {
    max-width: 480px;
  }

  .messages-modal--new-conversation .messages-modal__accent {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .messages-modal--new-conversation .messages-modal__icon {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .messages-modal__accent {
    height: 3px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
    flex-shrink: 0;
  }

  .messages-modal__accent--danger {
    background: linear-gradient(90deg, #ef4444, #f43f5e, #ec4899);
  }

  .messages-modal__accent--participants {
    background: linear-gradient(90deg, #10b981, #14b8a6, #06b6d4);
  }

  .messages-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .messages-modal__header--centered {
    position: relative;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
    border-bottom: none;
  }

  .messages-modal__header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .messages-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border-radius: 10px;
  }

  .messages-modal__icon svg {
    width: 20px;
    height: 20px;
  }

  .messages-modal__icon--large {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .messages-modal__icon--large svg {
    width: 24px;
    height: 24px;
  }

  .messages-modal__icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .messages-modal__icon--participants {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .messages-modal__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .messages-modal__header--centered .messages-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .messages-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .messages-modal__close svg {
    width: 18px;
    height: 18px;
  }

  .messages-modal__close--corner {
    position: absolute;
    top: 1rem;
    right: 1rem;
    border-radius: 6px;
  }

  .messages-modal__body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .messages-modal__body--scrollable {
    padding: 1.25rem 1.5rem 1.5rem;
  }

  .messages-modal__body--scrollable::-webkit-scrollbar {
    width: 6px;
  }

  .messages-modal__body--scrollable::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-modal__body--scrollable::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .messages-modal__body--scrollable::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* Tabs Navigation (Modern Style) */
  .messages-modal__tabs-nav {
    display: flex;
    gap: 0.375rem;
    padding: 0 1.5rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .messages-modal__tabs-nav::-webkit-scrollbar {
    height: 0;
  }

  .messages-modal__tabs-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .messages-modal__tabs-item:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .messages-modal__tabs-item--active {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .messages-modal__tabs-item--active:hover {
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  /* Legacy Tabs (for other modals) */
  .messages-modal__tabs {
    display: flex;
    gap: 0.5rem;
  }

  .messages-modal__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-modal__tab:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .messages-modal__tab--active {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border-color: transparent;
  }

  .messages-modal__tab-icon {
    width: 16px;
    height: 16px;
  }

  /* Fields */
  .messages-modal__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .messages-modal__label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .messages-modal__input {
    width: 100%;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .messages-modal__input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .messages-modal__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background-color: var(--sidebar-surface);
  }

  .messages-modal--new-conversation .messages-modal__input:focus,
  .messages-modal--new-conversation .messages-modal__search-input:focus {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
  }

  /* Search */
  .messages-modal__search {
    position: relative;
  }

  .messages-modal__search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .messages-modal__search-input {
    width: 100%;
    padding: 0.75rem 0.75rem 0.75rem 2.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .messages-modal__search-input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .messages-modal__search-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background-color: var(--sidebar-surface);
  }

  /* Members List */
  .messages-modal__members {
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    max-height: 256px;
    overflow-y: auto;
  }

  .messages-modal__member {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    cursor: pointer;
    transition: all 150ms ease;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .messages-modal__member:last-child {
    border-bottom: none;
  }

  .messages-modal__member:hover {
    background-color: var(--sidebar-hover);
  }

  .messages-modal__member--selected {
    background-color: rgba(6, 182, 212, 0.1);
  }

  .messages-modal__member-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .messages-modal__member-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .messages-modal__member-initial {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .messages-modal__member-info {
    flex: 1;
    min-width: 0;
  }

  .messages-modal__member-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .messages-modal__member-org {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .messages-modal__member-check {
    width: 24px;
    height: 24px;
    background-color: var(--sidebar-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .messages-modal__member-check svg {
    width: 14px;
    height: 14px;
    color: white;
  }

  .messages-modal__members-empty {
    padding: 2rem;
    text-align: center;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .messages-modal__members-loading {
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .messages-modal__members-spinner {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  /* Footer */
  .messages-modal__footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.25rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .messages-modal__footer--single {
    justify-content: center;
  }

  .messages-modal__btn {
    flex: 1;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-modal__btn--primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #000;
  }

  .messages-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .messages-modal--new-conversation .messages-modal__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  }

  .messages-modal--new-conversation .messages-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
  }

  .messages-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .messages-modal__btn--secondary:hover {
    background-color: var(--sidebar-active);
  }

  .messages-modal__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #f43f5e 100%);
    color: white;
  }

  .messages-modal__btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .messages-modal__btn--disabled {
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    cursor: not-allowed;
  }

  /* Confirm Dialog */
  .messages-modal__confirm-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.25rem 0;
  }

  .messages-modal__confirm-body {
    padding: 1.25rem;
  }

  .messages-modal__confirm-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  /* Participants */
  .messages-modal__participants-list {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .messages-modal__participant {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border-radius: 10px;
  }

  .messages-modal__participant-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--sidebar-border) 0%, var(--sidebar-surface) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .messages-modal__participant-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .messages-modal__participant-initial {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .messages-modal__participant-info {
    flex: 1;
    min-width: 0;
  }

  .messages-modal__participant-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .messages-modal__participant-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .messages-modal__participant-you {
    color: var(--sidebar-text-muted);
    font-weight: 400;
  }

  .messages-modal__participant-badge {
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background-color: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border-radius: 4px;
  }

  .messages-modal__participant-joined {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .messages-modal__participant-kick {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-modal__participant-kick:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .messages-modal__participant-kick:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .messages-modal__participant-kick-icon {
    width: 16px;
    height: 16px;
  }

  .messages-modal__participant-kick-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Dropdown Menu ===== */
  .messages-dropdown__backdrop {
    position: fixed;
    inset: 0;
    z-index: 55;
  }

  .messages-dropdown {
    position: fixed;
    width: 200px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 0.25rem;
    z-index: 56;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }

  .messages-dropdown__item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: transparent;
    color: var(--sidebar-text);
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .messages-dropdown__item:hover {
    background-color: var(--sidebar-hover);
  }

  .messages-dropdown__item--danger {
    color: #f87171;
  }

  .messages-dropdown__item--danger:hover {
    background-color: rgba(248, 113, 113, 0.1);
  }

  .messages-dropdown__item-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .messages-dropdown__spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Animations ===== */
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  /* Modal Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.15s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Fade Transition */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.15s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
