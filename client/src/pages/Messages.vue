<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { useMessagingStore } from '@/stores/messaging';
  import { useAuthStore } from '@/stores/auth';
  import api from '@/services/api';
  import type { Conversation, Message } from '@/services/messagingApi';
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
    Loader2,
    Megaphone,
    MoreVertical,
    UserMinus,
    LogOut,
  } from 'lucide-vue-next';

  const messagingStore = useMessagingStore();
  const authStore = useAuthStore();

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
  const members = ref<
    Array<{
      id: number;
      orgId: number;
      userId: number;
      displayName: string;
      avatarUrl: string | null;
      orgName: string;
      role?: string;
    }>
  >([]);
  const isLoadingMembers = ref(false);
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

  let typingTimeout: number | null = null;

  const filteredConversations = computed(() => {
    if (!searchQuery.value) return messagingStore.conversationList;
    const query = searchQuery.value.toLowerCase();
    return messagingStore.conversationList.filter((conv) => {
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
    // Filter out current user for conversation creation
    let filtered = members.value.filter((m) => m.userId !== authStore.user?.id);
    if (!memberSearchQuery.value) return filtered;
    const query = memberSearchQuery.value.toLowerCase();
    return filtered.filter((m) => m.displayName.toLowerCase().includes(query));
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
    if (!messagingStore.activeConversation) return null;
    const member = members.value.find((m) => m.userId === authStore.user?.id);
    return member?.role || null;
  });

  // Check if user can kick a specific participant
  function canKickParticipant(participant: any): boolean {
    if (!isConversationAdmin.value) return false;
    const participantUserId = participant.userId ?? participant.user_id;
    if (participantUserId === authStore.user?.id) return false; // Can't kick self

    // Find the target's org role
    const targetOrgMember = members.value.find((m) => m.userId === participantUserId);
    const targetIsOrgAdmin = targetOrgMember?.role === 'owner' || targetOrgMember?.role === 'admin';

    // If I'm not an org admin, I can't kick org admins
    const iAmOrgAdmin = myOrgRole.value === 'owner' || myOrgRole.value === 'admin';
    if (!iAmOrgAdmin && targetIsOrgAdmin) return false;

    return true;
  }

  onMounted(async () => {
    if (authStore.isAuthenticated) {
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

      isLoadingMembers.value = true;
      members.value = [];

      for (const org of organizations.value) {
        try {
          const membersResponse = await api.get<{
            members: Array<{
              id: number;
              user_id: number;
              user: { name: string; email: string; avatar_url: string | null };
              role: string;
            }>;
          }>(`/organizations/${org.id}/members`);
          const orgMembers = (membersResponse.data.members || []).map((m) => ({
            id: m.id,
            orgId: org.id,
            userId: m.user_id,
            displayName: m.user?.name || m.user?.email || 'Unknown',
            avatarUrl: m.user?.avatar_url || null,
            orgName: org.name,
            role: m.role,
          }));

          members.value.push(...orgMembers);

          if (org === organizations.value[0]) {
            await messagingStore.initialize(org.id);
          }
        } catch (e) {
          console.error(`Failed to load members for org ${org.id}:`, e);
        }
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      isLoadingMembers.value = false;
    }
  }

  function getParticipantDisplayName(participant: any): string {
    if (!participant?.user) return 'Unknown User';
    // Handle both camelCase and snake_case
    return participant.user.displayName || participant.user.display_name || 'Unknown User';
  }

  function getConversationName(conversation: Conversation): string {
    if (conversation.name) return conversation.name;

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

  async function createConversation() {
    if (!canCreateConversation.value) return;

    try {
      const selectedMember = members.value.find((m) => m.userId === selectedUserIds.value[0]);
      if (!selectedMember) return;

      if (messagingStore.currentOrgId !== selectedMember.orgId) {
        await messagingStore.initialize(selectedMember.orgId);
      }

      let conversation;
      if (newConversationType.value === 'direct') {
        conversation = await messagingStore.startDirectConversation(selectedUserIds.value[0]);
      } else {
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
  <PageLayout
    title="Messages"
    description="Chat with your team and organization members"
    :show-header="true"
    :icon="MessageSquare"
  >
    <!-- Main Messages Container -->
    <div class="flex gap-4 h-[calc(100vh-12rem)] min-h-[500px]">
      <!-- Conversations Panel (Left) -->
      <div class="w-80 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <!-- Panel Header -->
        <div class="p-4 border-b border-border flex items-center justify-between">
          <h2 class="text-base font-semibold text-white">Conversations</h2>
          <button
            @click="openNewConversationDialog"
            class="p-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/20"
            title="New conversation"
          >
            <Plus class="h-4 w-4" />
          </button>
        </div>

        <!-- Search Box -->
        <div class="p-3">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
          </div>
        </div>

        <!-- Conversations List -->
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="mx-2 mb-1 p-3 rounded-lg cursor-pointer transition-all duration-150"
            :class="[
              conv.id === messagingStore.activeConversationId
                ? 'bg-primary/15 border border-primary/30'
                : 'hover:bg-muted/60 border border-transparent',
            ]"
            @click="selectConversation(conv.id)"
          >
            <div class="flex items-center gap-3">
              <!-- Avatar -->
              <div
                class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold overflow-hidden"
                :class="[
                  conv.type === 'direct'
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                    : conv.type === 'group'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                      : 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                ]"
              >
                <img
                  v-if="getConversationAvatar(conv)"
                  :src="getConversationAvatar(conv)!"
                  alt=""
                  class="w-full h-full object-cover"
                />
                <Users v-else-if="conv.type === 'group'" class="h-5 w-5" />
                <Megaphone v-else-if="conv.type === 'announcement'" class="h-5 w-5" />
                <span v-else>{{ getConversationName(conv).charAt(0).toUpperCase() }}</span>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                  <span class="text-sm font-medium text-foreground truncate">{{ getConversationName(conv) }}</span>
                  <span class="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {{ formatTime(conv.lastMessageAt) }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground truncate flex-1">
                    {{ conv.lastMessagePreview || 'No messages yet' }}
                  </span>
                  <span
                    v-if="getUnreadCount(conv.id) > 0"
                    class="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center"
                  >
                    {{ getUnreadCount(conv.id) > 99 ? '99+' : getUnreadCount(conv.id) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-if="filteredConversations.length === 0 && !messagingStore.isLoading"
            class="flex flex-col items-center justify-center py-12 px-4 text-center"
          >
            <div class="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare class="h-7 w-7 text-muted-foreground" />
            </div>
            <p class="text-sm text-muted-foreground mb-3">No conversations yet</p>
            <button
              @click="openNewConversationDialog"
              class="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Start a conversation
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="messagingStore.isLoading" class="flex items-center justify-center py-12">
            <Loader2 class="h-6 w-6 text-primary animate-spin" />
          </div>
        </div>
      </div>

      <!-- Chat Panel (Right) -->
      <div class="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <template v-if="messagingStore.activeConversation">
          <!-- Chat Header -->
          <div class="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/30">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold overflow-hidden"
                :class="[
                  messagingStore.activeConversation.type === 'direct'
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                    : messagingStore.activeConversation.type === 'group'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                      : 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                ]"
              >
                <img
                  v-if="getConversationAvatar(messagingStore.activeConversation)"
                  :src="getConversationAvatar(messagingStore.activeConversation)!"
                  alt=""
                  class="w-full h-full object-cover"
                />
                <Users v-else-if="messagingStore.activeConversation.type === 'group'" class="h-5 w-5" />
                <Megaphone v-else-if="messagingStore.activeConversation.type === 'announcement'" class="h-5 w-5" />
                <span v-else>{{ getConversationName(messagingStore.activeConversation).charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-foreground">
                  {{ getConversationName(messagingStore.activeConversation) }}
                </h3>
                <p class="text-xs text-muted-foreground">
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

            <div class="flex items-center gap-2">
              <button
                class="p-2 rounded-lg transition-all duration-150"
                :class="[
                  messagingStore.activeConversation.muted
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                ]"
                @click="messagingStore.toggleMute(messagingStore.activeConversation.id)"
                :title="messagingStore.activeConversation.muted ? 'Unmute' : 'Mute'"
              >
                <BellOff v-if="messagingStore.activeConversation.muted" class="h-4 w-4" />
                <Bell v-else class="h-4 w-4" />
              </button>

              <!-- Conversation Menu -->
              <button
                ref="menuButtonRef"
                @click="toggleConversationMenu"
                class="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all duration-150"
                title="Conversation options"
              >
                <MoreVertical class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Messages Container -->
          <div ref="messagesContainer" class="flex-1 overflow-y-auto p-5 space-y-3" @scroll="handleScroll">
            <!-- Loading Messages -->
            <div v-if="messagingStore.isLoadingMessages" class="flex items-center justify-center py-8">
              <Loader2 class="h-6 w-6 text-primary animate-spin" />
            </div>

            <!-- Messages List -->
            <div
              v-for="message in sortedMessages"
              :key="message.id"
              class="flex"
              :class="message.senderId === authStore.user?.id ? 'justify-end' : 'justify-start'"
            >
              <div class="max-w-[70%] group relative" :class="{ 'opacity-60': !!message.deletedAt }">
                <!-- Message Bubble -->
                <div
                  class="px-4 py-2.5 rounded-2xl"
                  :class="[
                    message.senderId === authStore.user?.id
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md',
                  ]"
                >
                  <!-- Sender Name (for group chats) -->
                  <div
                    v-if="
                      message.senderId !== authStore.user?.id &&
                      message.sender &&
                      messagingStore.activeConversation?.type !== 'direct'
                    "
                    class="text-xs font-medium text-primary mb-1"
                  >
                    {{ (message.sender as any).displayName || (message.sender as any).display_name || 'Unknown' }}
                  </div>

                  <!-- Edit Mode -->
                  <template v-if="editingMessageId === message.id">
                    <textarea
                      v-model="editContent"
                      @keydown.enter.exact.prevent="saveEdit"
                      @keydown.escape="cancelEdit"
                      class="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      rows="2"
                    ></textarea>
                    <div class="flex gap-2 mt-2">
                      <button
                        @click="saveEdit"
                        class="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                      >
                        Save
                      </button>
                      <button
                        @click="cancelEdit"
                        class="px-3 py-1 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </template>

                  <!-- Message Content -->
                  <template v-else>
                    <p v-if="message.deletedAt" class="text-sm italic text-muted-foreground">Message deleted</p>
                    <p v-else class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ message.content }}</p>
                  </template>

                  <!-- Meta Info -->
                  <div class="flex items-center gap-2 mt-1.5">
                    <span class="text-[10px] opacity-70">
                      {{ formatMessageTime((message as any).insertedAt || (message as any).inserted_at) }}
                    </span>
                    <span
                      v-if="((message as any).editedAt || (message as any).edited_at) && !message.deletedAt"
                      class="text-[10px] opacity-70"
                    >
                      • edited
                    </span>
                  </div>
                </div>

                <!-- Message Actions -->
                <div
                  v-if="
                    message.senderId === authStore.user?.id && !message.deletedAt && editingMessageId !== message.id
                  "
                  class="absolute -left-16 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    @click="startEdit(message)"
                    class="p-1.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                    title="Edit"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button
                    @click="deleteMessage(message.id)"
                    class="p-1.5 bg-muted hover:bg-red-600 text-muted-foreground hover:text-white rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Typing Indicator -->
            <div v-if="typingUserNames.length > 0" class="flex items-center gap-2 text-xs text-muted-foreground italic">
              <div class="flex gap-1">
                <span
                  class="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                  style="animation-delay: 0ms"
                ></span>
                <span
                  class="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                  style="animation-delay: 150ms"
                ></span>
                <span
                  class="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                  style="animation-delay: 300ms"
                ></span>
              </div>
              <span>{{ typingUserNames.join(', ') }} {{ typingUserNames.length === 1 ? 'is' : 'are' }} typing...</span>
            </div>
          </div>

          <!-- Message Input -->
          <div class="p-4 border-t border-border bg-muted/30">
            <div class="flex items-end gap-3">
              <textarea
                v-model="messageInput"
                placeholder="Write a message..."
                rows="1"
                @keydown="handleInputKeydown"
                @input="handleTyping"
                class="flex-1 px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all max-h-32"
              ></textarea>
              <button
                class="p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:bg-muted disabled:from-muted disabled:to-muted disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/20 disabled:shadow-none"
                :disabled="!messageInput.trim()"
                @click="sendMessage"
              >
                <Send class="h-5 w-5" />
              </button>
            </div>
          </div>
        </template>

        <!-- No Conversation Selected -->
        <div v-else class="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div class="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <MessageSquare class="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 class="text-xl font-semibold text-foreground mb-2">Select a conversation</h2>
          <p class="text-sm text-muted-foreground max-w-sm">
            Choose from your existing conversations or start a new one
          </p>
        </div>
      </div>
    </div>

    <!-- New Conversation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showNewConversationDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="closeNewConversationDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden max-h-[85vh] flex flex-col shadow-2xl"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 flex-shrink-0" />

              <!-- Header -->
              <div class="p-5 border-b border-white/10 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 rounded-xl"
                  >
                    <MessageSquare class="h-5 w-5 text-indigo-400" />
                  </div>
                  <h2 class="text-lg font-semibold text-white">New Conversation</h2>
                </div>
                <button
                  @click="closeNewConversationDialog"
                  class="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                >
                  <X class="h-5 w-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="flex-1 overflow-y-auto p-5 space-y-5">
                <!-- Type Tabs -->
                <div class="flex gap-2">
                  <button
                    @click="
                      newConversationType = 'direct';
                      selectedUserIds = [];
                    "
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                    :class="[
                      newConversationType === 'direct'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80 border border-zinc-700/50',
                    ]"
                  >
                    <User class="h-4 w-4" />
                    Direct Message
                  </button>
                  <button
                    @click="
                      newConversationType = 'group';
                      selectedUserIds = [];
                    "
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                    :class="[
                      newConversationType === 'group'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80 border border-zinc-700/50',
                    ]"
                  >
                    <Users class="h-4 w-4" />
                    Group Chat
                  </button>
                </div>

                <!-- Group Name Input -->
                <div v-if="newConversationType === 'group'" class="space-y-2">
                  <label class="text-sm font-medium text-zinc-300">Group Name</label>
                  <input
                    v-model="newGroupName"
                    type="text"
                    placeholder="Enter group name..."
                    class="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                <!-- Member Search -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-zinc-300">
                    {{ newConversationType === 'direct' ? 'Select User' : 'Select Members' }}
                  </label>
                  <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      v-model="memberSearchQuery"
                      type="text"
                      placeholder="Search members..."
                      class="w-full pl-10 pr-4 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                <!-- Members List -->
                <div class="border border-zinc-700/50 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <div
                    v-for="member in filteredMembers"
                    :key="`${member.orgId}-${member.userId}`"
                    class="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-zinc-800/50 last:border-0"
                    :class="[selectedUserIds.includes(member.userId) ? 'bg-indigo-600/15' : 'hover:bg-zinc-800/60']"
                    @click="toggleUserSelection(member.userId)"
                  >
                    <div
                      class="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-medium text-white overflow-hidden flex-shrink-0"
                    >
                      <img v-if="member.avatarUrl" :src="member.avatarUrl" alt="" class="w-full h-full object-cover" />
                      <span v-else>{{ member.displayName.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-white truncate">{{ member.displayName }}</p>
                      <p class="text-xs text-zinc-500 truncate">{{ member.orgName }}</p>
                    </div>
                    <div
                      v-if="selectedUserIds.includes(member.userId)"
                      class="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0"
                    >
                      <Check class="h-4 w-4 text-white" />
                    </div>
                  </div>

                  <!-- No Members -->
                  <div
                    v-if="filteredMembers.length === 0 && !isLoadingMembers"
                    class="py-8 text-center text-sm text-zinc-500"
                  >
                    No members found
                  </div>

                  <!-- Loading Members -->
                  <div v-if="isLoadingMembers" class="py-8 flex items-center justify-center">
                    <Loader2 class="h-5 w-5 text-indigo-500 animate-spin" />
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="p-5 border-t border-white/10 flex gap-3">
                <button
                  @click="closeNewConversationDialog"
                  class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl font-medium transition-all duration-200 border border-zinc-700/50"
                >
                  Cancel
                </button>
                <button
                  @click="createConversation"
                  :disabled="!canCreateConversation"
                  class="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:shadow-none"
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
      <!-- Click outside to close menu -->
      <div v-if="showConversationMenu" class="fixed inset-0 z-[55]" @click="closeConversationMenu"></div>

      <Transition name="fade">
        <div
          v-if="showConversationMenu && messagingStore.activeConversation"
          class="fixed w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-[56] overflow-hidden py-1"
          :style="{ top: menuPosition.top + 'px', right: menuPosition.right + 'px' }"
        >
          <!-- Manage Participants (group chats only) -->
          <button
            v-if="messagingStore.activeConversation.type === 'group' && isConversationAdmin"
            @click="openParticipantsDialog"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Users class="h-4 w-4" />
            Manage Participants
          </button>

          <!-- Leave Conversation (any type, not creator) -->
          <button
            v-if="!isConversationCreator"
            @click="handleLeaveConversation"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <LogOut class="h-4 w-4" />
            Leave Conversation
          </button>

          <!-- Delete Conversation (creator only) -->
          <button
            v-if="isConversationCreator"
            @click="handleDeleteConversation"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            :disabled="isDeletingConversation"
          >
            <Loader2 v-if="isDeletingConversation" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            Delete Conversation
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showConfirmDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[70]"
          @click.self="closeConfirmDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm w-full mx-4 border border-white/10 overflow-hidden shadow-2xl"
            >
              <!-- Decorative top accent -->
              <div
                class="h-1 w-full"
                :class="
                  confirmDialogConfig.confirmVariant === 'danger'
                    ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500'
                    : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500'
                "
              />

              <!-- Header -->
              <div class="p-5 pb-0">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2 rounded-xl border"
                    :class="
                      confirmDialogConfig.confirmVariant === 'danger'
                        ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border-red-500/30'
                        : 'bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border-indigo-500/30'
                    "
                  >
                    <Trash2 v-if="confirmDialogConfig.confirmVariant === 'danger'" class="h-5 w-5 text-red-400" />
                    <MessageSquare v-else class="h-5 w-5 text-indigo-400" />
                  </div>
                  <h2 class="text-lg font-semibold text-white">{{ confirmDialogConfig.title }}</h2>
                </div>
              </div>

              <!-- Content -->
              <div class="p-5">
                <p class="text-sm text-zinc-400 leading-relaxed">{{ confirmDialogConfig.message }}</p>
              </div>

              <!-- Footer -->
              <div class="p-5 pt-0 flex gap-3">
                <button
                  @click="closeConfirmDialog"
                  class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl font-medium transition-all duration-200 border border-zinc-700/50"
                >
                  Cancel
                </button>
                <button
                  @click="handleConfirm"
                  class="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-lg"
                  :class="
                    confirmDialogConfig.confirmVariant === 'danger'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-500/25'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/25'
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
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="closeParticipantsDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden max-h-[85vh] flex flex-col shadow-2xl"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 flex-shrink-0" />

              <!-- Header -->
              <div class="p-5 border-b border-white/10 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl"
                  >
                    <Users class="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 class="text-lg font-semibold text-white">Participants</h2>
                </div>
                <button
                  @click="closeParticipantsDialog"
                  class="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                >
                  <X class="h-5 w-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="flex-1 overflow-y-auto p-5">
                <div class="space-y-2">
                  <div
                    v-for="participant in messagingStore.activeConversation.participants"
                    :key="participant.userId"
                    class="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div
                      class="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-medium text-white overflow-hidden flex-shrink-0"
                    >
                      <img
                        v-if="getParticipantAvatarUrl(participant)"
                        :src="getParticipantAvatarUrl(participant)!"
                        alt=""
                        class="w-full h-full object-cover"
                      />
                      <span v-else>{{ getParticipantDisplayName(participant).charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-white truncate">
                          {{ getParticipantDisplayName(participant) }}
                          <span
                            v-if="((participant as any).userId ?? (participant as any).user_id) === authStore.user?.id"
                            class="text-zinc-500"
                          >
                            (you)
                          </span>
                        </p>
                        <span
                          v-if="participant.role === 'admin'"
                          class="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 rounded"
                        >
                          Admin
                        </span>
                      </div>
                      <p class="text-xs text-zinc-500">Joined {{ formatTime(participant.joinedAt) }}</p>
                    </div>

                    <!-- Kick Button -->
                    <button
                      v-if="canKickParticipant(participant)"
                      @click="handleKickParticipant((participant as any).userId ?? (participant as any).user_id)"
                      :disabled="isKickingUser === ((participant as any).userId ?? (participant as any).user_id)"
                      class="p-2 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove from conversation"
                    >
                      <Loader2
                        v-if="isKickingUser === ((participant as any).userId ?? (participant as any).user_id)"
                        class="h-4 w-4 animate-spin"
                      />
                      <UserMinus v-else class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="p-5 border-t border-white/10">
                <button
                  @click="closeParticipantsDialog"
                  class="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl font-medium transition-all duration-200 border border-zinc-700/50"
                >
                  Close
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Fade transition for dropdown */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.15s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
