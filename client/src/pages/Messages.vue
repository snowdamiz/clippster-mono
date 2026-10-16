<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useMessagingStore } from '@/stores/messaging';
  import { useAuthStore } from '@/stores/auth';
  import { formatConversationTime, formatTime } from '@/utils/dateTimeUtils';
  import api from '@/services/api';
  import type { Conversation, Message, MessageAttachment } from '@/services/messagingApi';
  import { checkSupportConversation, getOrCreateSupportConversation, uploadMessageAttachments, getAttachmentDownloadUrl } from '@/services/messagingApi';
  import { compressImages, validateImageFile, formatFileSize } from '@/utils/imageCompression';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import ConversationAvatar from '@/components/messaging/ConversationAvatar.vue';
  import ConversationRow from '@/components/messaging/ConversationRow.vue';
  import MessageBubble from '@/components/messaging/MessageBubble.vue';
  import MessageComposer from '@/components/messaging/MessageComposer.vue';
  import TypingIndicator from '@/components/messaging/TypingIndicator.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    MessageSquare,
    MessageSquarePlus,
    SquarePen,
    Bell,
    BellOff,
    Users,
    User,
    Check,
    Trash2,
    Loader2,
    MoreHorizontal,
    UserMinus,
    LogOut,
    Download,
    SearchX,
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
  const isStartingSupport = ref(false);

  // Attachment state
  const selectedAttachments = ref<File[]>([]);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const isUploadingAttachments = ref(false);
  const showImageViewer = ref(false);
  const viewerImageUrl = ref('');
  const viewerImageFilename = ref('');

  const attachmentPreviews = computed(() => {
    return selectedAttachments.value.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: formatFileSize(file.size)
    }));
  });

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
    messagingStore.cleanupPageOnly();
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

  function formatConversationDate(dateString: string): string {
    return formatConversationTime(dateString);
  }

  function formatMessageTime(dateString: string): string {
    return formatTime(dateString);
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
    const hasAttachments = selectedAttachments.value.length > 0;
    
    if (!content && !hasAttachments) return;

    const originalContent = content;
    const attachmentsToSend = [...selectedAttachments.value];
    
    messageInput.value = '';
    selectedAttachments.value = [];

    try {
      let attachmentData: any[] = [];
      
      // Upload attachments if any
      if (hasAttachments && messagingStore.activeConversationId) {
        isUploadingAttachments.value = true;
        const compressed = await compressImages(attachmentsToSend, 15);
        const uploaded = await uploadMessageAttachments(messagingStore.activeConversationId, compressed);
        attachmentData = uploaded;
        isUploadingAttachments.value = false;
      }
      
      await messagingStore.sendMessage(content || ' ', attachmentData);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      messageInput.value = originalContent;
      selectedAttachments.value = attachmentsToSend;
      isUploadingAttachments.value = false;
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
      title: 'Delete message',
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
      title: 'Delete conversation',
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
      title: 'Remove participant',
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
      supportConversation.value = await checkSupportConversation();
    } catch (error) {
      console.error('Failed to load support conversation:', error);
    } finally {
      isLoadingSupportConversation.value = false;
    }
  }

  async function selectSupportConversation() {
    // Ensure messaging store is initialized (socket connected)
    if (!messagingStore.isInitialized) {
      await messagingStore.initialize();
    }

    // Create conversation on demand if it doesn't exist yet
    if (!supportConversation.value) {
      try {
        supportConversation.value = await getOrCreateSupportConversation();
        if (supportConversation.value) {
          messagingStore.addConversation(supportConversation.value);
        }
      } catch (error) {
        console.error('Failed to create support conversation:', error);
        return;
      }
    }

    if (supportConversation.value) {
      await messagingStore.setActiveConversation(supportConversation.value.id);
    }
  }

  async function openSupportChat() {
    isStartingSupport.value = true;
    try {
      await selectSupportConversation();
    } catch (error) {
      console.error('Failed to open support chat:', error);
    } finally {
      isStartingSupport.value = false;
    }
  }

  function handleLeaveConversation() {
    if (!messagingStore.activeConversation) return;
    const conversationId = messagingStore.activeConversation.id;
    closeConversationMenu();

    showConfirm({
      title: 'Leave conversation',
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

  // Attachment handling functions
  async function handleAttachClick() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        const files = await Promise.all(
          selected.map(async (path) => {
            const response = await fetch(`http://localhost:1420/${path}`);
            const blob = await response.blob();
            const filename = path.split(/[\\/]/).pop() || 'image.jpg';
            return new File([blob], filename, { type: blob.type });
          })
        );
        
        const validFiles = files.filter(file => validateImageFile(file, 15));
        selectedAttachments.value.push(...validFiles);
      } else if (selected && typeof selected === 'string') {
        const path: string = selected;
        const response = await fetch(`http://localhost:1420/${path}`);
        const blob = await response.blob();
        const filename = path.split(/[\\/]/).pop() || 'image.jpg';
        const file = new File([blob], filename, { type: blob.type });
        
        if (validateImageFile(file, 15)) {
          selectedAttachments.value.push(file);
        }
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      const files = Array.from(target.files).filter(file => validateImageFile(file, 15));
      selectedAttachments.value.push(...files);
      target.value = '';
    }
  }

  async function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file && validateImageFile(file, 15)) {
          selectedAttachments.value.push(file);
        }
      }
    }
  }

  function removeAttachment(index: number) {
    selectedAttachments.value.splice(index, 1);
  }

  function openImageViewer(url: string, filename: string) {
    viewerImageUrl.value = url;
    viewerImageFilename.value = filename;
    showImageViewer.value = true;
  }

  function closeImageViewer() {
    showImageViewer.value = false;
    viewerImageUrl.value = '';
    viewerImageFilename.value = '';
  }

  function downloadImage(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }

  // ── Presentation helpers (layout only) ────────────────────────────────
  const conversationTypeOptions = [
    { value: 'direct' as const, label: 'Direct message', icon: User },
    { value: 'group' as const, label: 'Group chat', icon: Users },
  ];

  function setNewConversationType(type: 'direct' | 'group') {
    newConversationType.value = type;
    selectedUserIds.value = [];
  }

  const activeConversationSubtitle = computed(() => {
    const conv = messagingStore.activeConversation;
    if (!conv) return '';
    if (conv.type === 'direct') return 'Direct message';
    if (conv.type === 'group') return `${conv.participants.length} members`;
    if (conv.type === 'support') return 'Clippster support team';
    return 'Announcement';
  });

  function messageTime(message: Message): string {
    return (message as any).insertedAt || (message as any).inserted_at || '';
  }

  function dayKey(dateString: string): string {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  /** "Today" / "Yesterday" / "Mon, Oct 6" divider above the first message of each day. */
  function dayDividerLabel(index: number): string | null {
    const current = messageTime(sortedMessages.value[index]);
    if (!current) return null;
    const previous = index > 0 ? messageTime(sortedMessages.value[index - 1]) : '';
    if (previous && dayKey(previous) === dayKey(current)) return null;
    const date = new Date(current);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(current) === dayKey(today.toISOString())) return 'Today';
    if (dayKey(current) === dayKey(yesterday.toISOString())) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
  }

  /** Sender names only in group-style chats, and only when the sender changes. */
  function showSenderName(index: number): boolean {
    if (messagingStore.activeConversation?.type === 'direct') return false;
    const message = sortedMessages.value[index];
    const previous = sortedMessages.value[index - 1];
    return !previous || previous.senderId !== message.senderId || previous.messageType === 'system' || !!dayDividerLabel(index);
  }

  function participantUserId(participant: any): number {
    return participant.userId ?? participant.user_id;
  }
</script>

<template>
  <PageLayout title="Messages" description="Chat with your team and organization members" :icon="MessageSquare">
    <div class="flex min-h-0 flex-1">
      <!-- ── Conversation list pane ─────────────────────────────────── -->
      <aside class="flex w-[clamp(220px,32%,320px)] shrink-0 flex-col border-r border-line-subtle">
        <div class="flex h-12 shrink-0 items-center gap-1.5 border-b border-line-subtle px-3">
          <SearchField v-model="searchQuery" placeholder="Search conversations" size="sm" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            title="New conversation"
            @click="openNewConversationDialog"
          >
            <SquarePen />
          </Button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <!-- Loading skeleton (first load only; re-initialising keeps the list) -->
          <div v-if="messagingStore.isLoading && messagingStore.conversationList.length === 0" class="flex flex-col gap-1">
            <div v-for="i in 5" :key="i" class="flex items-center gap-2.5 px-2.5 py-2">
              <div class="skeleton size-9 shrink-0 !rounded-full" />
              <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                <div class="skeleton h-3 w-2/5" />
                <div class="skeleton h-2.5 w-4/5" />
              </div>
            </div>
          </div>

          <div v-else class="flex animate-fade-in flex-col gap-0.5">
            <!-- Pinned support chat (always visible) -->
            <ConversationRow
              v-if="!searchQuery"
              name="Clippster Customer Support"
              type="support"
              pinned
              :preview="supportConversation?.lastMessagePreview || 'Get help from our support team'"
              :time="supportConversation?.lastMessageAt ? formatConversationDate(supportConversation.lastMessageAt) : ''"
              :unread="supportConversation ? getUnreadCount(supportConversation.id) : 0"
              :active="!!supportConversation && supportConversation.id === messagingStore.activeConversationId"
              @select="selectSupportConversation"
            />
            <div v-if="!searchQuery && filteredConversations.length > 0" class="mx-2.5 my-1 h-px bg-line-subtle" />

            <ConversationRow
              v-for="conv in filteredConversations"
              :key="conv.id"
              :name="getConversationName(conv)"
              :type="conv.type"
              :avatar-url="getConversationAvatar(conv)"
              :preview="conv.lastMessagePreview"
              :time="conv.lastMessageAt ? formatConversationDate(conv.lastMessageAt) : ''"
              :unread="getUnreadCount(conv.id)"
              :muted="conv.muted"
              :active="conv.id === messagingStore.activeConversationId"
              @select="selectConversation(conv.id)"
            />

            <EmptyState
              v-if="searchQuery && filteredConversations.length === 0"
              size="sm"
              :icon="SearchX"
              title="No matches"
              :description="`No conversations match “${searchQuery}”.`"
            />
            <EmptyState
              v-else-if="!searchQuery && filteredConversations.length === 0"
              size="sm"
              title="No conversations yet"
              description="Start a direct message or a group chat."
            />
          </div>
        </div>
      </aside>

      <!-- ── Chat pane ──────────────────────────────────────────────── -->
      <section class="flex min-w-0 flex-1 flex-col">
        <template v-if="messagingStore.activeConversation">
          <!-- Chat header -->
          <header class="flex h-12 shrink-0 items-center gap-2.5 border-b border-line-subtle px-4">
            <ConversationAvatar
              :name="getConversationName(messagingStore.activeConversation)"
              :src="getConversationAvatar(messagingStore.activeConversation)"
              :type="messagingStore.activeConversation.type"
              size="sm"
            />
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-sm font-semibold text-fg">
                {{ getConversationName(messagingStore.activeConversation) }}
              </h2>
              <p class="truncate text-xs text-fg-subtle">{{ activeConversationSubtitle }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                :class="{ '!text-warning': messagingStore.activeConversation.muted }"
                :aria-label="messagingStore.activeConversation.muted ? 'Unmute' : 'Mute'"
                :title="messagingStore.activeConversation.muted ? 'Unmute' : 'Mute'"
                @click="messagingStore.toggleMute(messagingStore.activeConversation.id)"
              >
                <BellOff v-if="messagingStore.activeConversation.muted" />
                <Bell v-else />
              </Button>
              <DropdownMenu v-model:open="showConversationMenu">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm" aria-label="Conversation options" title="Conversation options">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="min-w-48">
                  <DropdownMenuItem
                    v-if="messagingStore.activeConversation.type === 'group' && isConversationAdmin"
                    @click="openParticipantsDialog"
                  >
                    <Users />
                    Manage participants
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="!isConversationCreator" @click="handleLeaveConversation">
                    <LogOut />
                    Leave conversation
                  </DropdownMenuItem>
                  <template v-if="isConversationCreator">
                    <DropdownMenuSeparator v-if="messagingStore.activeConversation.type === 'group' && isConversationAdmin" />
                    <DropdownMenuItem
                      class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                      :disabled="isDeletingConversation"
                      @click="handleDeleteConversation"
                    >
                      <Loader2 v-if="isDeletingConversation" class="animate-spin" />
                      <Trash2 v-else />
                      Delete conversation
                    </DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <!-- Messages -->
          <div ref="messagesContainer" class="min-h-0 flex-1 overflow-y-auto px-4 py-4" @scroll="handleScroll">
            <!-- Delayed like a skeleton so fast loads never flash the spinner -->
            <div v-if="messagingStore.isLoadingMessages" class="skeleton-group flex justify-center py-6">
              <Loader2 class="size-5 animate-spin text-fg-subtle" />
            </div>

            <!-- Keyed by conversation so switching threads eases in -->
            <div :key="messagingStore.activeConversation.id" class="mx-auto flex max-w-[860px] animate-enter flex-col gap-2">
              <template v-for="(message, index) in sortedMessages" :key="message.id">
                <div v-if="dayDividerLabel(index)" class="flex items-center gap-3 py-2">
                  <div class="h-px flex-1 bg-line-subtle" />
                  <span class="text-2xs font-medium text-fg-subtle">{{ dayDividerLabel(index) }}</span>
                  <div class="h-px flex-1 bg-line-subtle" />
                </div>
                <MessageBubble
                  :message="message"
                  :is-own-message="message.senderId === authStore.user?.id"
                  :is-editing="editingMessageId === message.id"
                  :edit-content="editContent"
                  :show-sender="showSenderName(index)"
                  @edit="startEdit(message)"
                  @delete="deleteMessage(message.id)"
                  @update:edit-content="editContent = $event"
                  @save-edit="saveEdit"
                  @cancel-edit="cancelEdit"
                  @open-attachment="(a) => openImageViewer(a.url, a.filename)"
                />
              </template>

              <TypingIndicator v-if="typingUserNames.length > 0" :user-names="typingUserNames" />
            </div>
          </div>

          <!-- Composer -->
          <MessageComposer
            v-model="messageInput"
            :attachments="attachmentPreviews"
            :uploading="isUploadingAttachments"
            @keydown="handleInputKeydown"
            @input="handleTyping"
            @paste="handlePaste"
            @attach="handleAttachClick"
            @send="sendMessage"
            @remove-attachment="removeAttachment"
          />
        </template>

        <!-- No conversation selected -->
        <EmptyState
          v-else
          :icon="MessageSquare"
          title="Select a conversation"
          description="Choose a conversation from the list or start a new one."
        >
          <Button variant="secondary" @click="openNewConversationDialog">
            <MessageSquarePlus />
            New conversation
          </Button>
        </EmptyState>
      </section>
    </div>

  <!-- New conversation -->
  <Modal
    :open="showNewConversationDialog"
    title="New conversation"
    description="Message someone directly or start a group chat."
    :icon="MessageSquarePlus"
    size="md"
    body-class="flex flex-col gap-4"
    @close="closeNewConversationDialog"
  >
    <SegmentedControl
      :model-value="newConversationType"
      :options="conversationTypeOptions"
      block
      @update:model-value="setNewConversationType"
    />

    <Field v-if="newConversationType === 'group'" label="Group name">
      <Input v-model="newGroupName" placeholder="e.g. Highlights team" />
    </Field>

    <Field :label="newConversationType === 'direct' ? 'Recipient' : 'Members'">
      <SearchField v-model="memberSearchQuery" placeholder="Search people by name or email" :loading="isSearchingUsers" autofocus />
    </Field>

    <div class="-mx-1 flex min-h-[176px] flex-col gap-0.5">
      <button
        v-for="user in filteredMembers"
        :key="user.id"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
        :class="selectedUserIds.includes(user.id) ? 'bg-brand-soft' : 'hover:bg-surface-hover'"
        :aria-pressed="selectedUserIds.includes(user.id)"
        @click="toggleUserSelection(user.id)"
      >
        <ConversationAvatar :name="user.name || user.email" :src="user.avatar_url" type="user" size="sm" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-fg">{{ user.name || user.email }}</span>
          <span class="block truncate text-xs text-fg-subtle">
            {{ user.account_type === 'organization' ? 'Organization' : 'User' }}
          </span>
        </span>
        <span
          class="grid size-4 shrink-0 place-items-center border transition-colors"
          :class="[
            newConversationType === 'direct' ? 'rounded-full' : 'rounded',
            selectedUserIds.includes(user.id) ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong',
          ]"
        >
          <Check v-if="selectedUserIds.includes(user.id)" class="size-3" :stroke-width="3" />
        </span>
      </button>

      <p
        v-if="filteredMembers.length === 0 && !isSearchingUsers && memberSearchQuery.trim().length >= 2"
        class="py-8 text-center text-sm text-fg-muted"
      >
        No users found
      </p>
      <p v-if="memberSearchQuery.trim().length < 2 && !isSearchingUsers" class="py-8 text-center text-sm text-fg-subtle">
        Type at least 2 characters to search
      </p>
    </div>

    <template #footer>
      <span v-if="newConversationType === 'group' && selectedUserIds.length" class="mr-auto text-xs text-fg-muted">
        {{ selectedUserIds.length }} selected
      </span>
      <Button variant="ghost" @click="closeNewConversationDialog">Cancel</Button>
      <Button variant="primary" :disabled="!canCreateConversation" @click="createConversation">Create</Button>
    </template>
  </Modal>

  <!-- Confirmation -->
  <ConfirmationModal
    :show="showConfirmDialog"
    :title="confirmDialogConfig.title"
    :message="confirmDialogConfig.message"
    suffix=""
    :confirm-text="confirmDialogConfig.confirmText"
    :variant="confirmDialogConfig.confirmVariant === 'danger' ? 'destructive' : 'default'"
    :show-cannot-undone-text="false"
    @close="closeConfirmDialog"
    @confirm="handleConfirm"
  />

  <!-- Image viewer -->
  <Modal :open="showImageViewer" :title="viewerImageFilename || 'Image'" size="xl" flush @close="closeImageViewer">
    <div class="grid place-items-center bg-surface-sunken p-3">
      <img :src="viewerImageUrl" :alt="viewerImageFilename" class="max-h-[70vh] max-w-full rounded-lg object-contain" />
    </div>
    <template #footer>
      <Button variant="ghost" @click="closeImageViewer">Close</Button>
      <Button variant="secondary" @click="downloadImage(viewerImageUrl, viewerImageFilename)">
        <Download />
        Download
      </Button>
    </template>
  </Modal>

  <!-- Participants -->
  <Modal
    :open="showParticipantsDialog && !!messagingStore.activeConversation"
    title="Participants"
    :description="messagingStore.activeConversation ? `${messagingStore.activeConversation.participants.length} members` : undefined"
    :icon="Users"
    size="sm"
    @close="closeParticipantsDialog"
  >
    <div v-if="messagingStore.activeConversation" class="-mx-1 flex flex-col gap-0.5">
      <div
        v-for="participant in messagingStore.activeConversation.participants"
        :key="participant.userId"
        class="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      >
        <ConversationAvatar
          :name="getParticipantDisplayName(participant)"
          :src="getParticipantAvatarUrl(participant)"
          type="user"
          size="sm"
        />
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="truncate text-sm font-medium text-fg">{{ getParticipantDisplayName(participant) }}</span>
            <span v-if="participantUserId(participant) === authStore.user?.id" class="shrink-0 text-xs text-fg-subtle">
              (you)
            </span>
            <Badge v-if="participant.role === 'admin'" variant="brand">Admin</Badge>
          </div>
          <p class="truncate text-xs text-fg-subtle">Joined {{ formatConversationDate(participant.joinedAt) }}</p>
        </div>
        <Button
          v-if="canKickParticipant(participant)"
          variant="ghost"
          size="icon-sm"
          class="hover:!bg-danger-soft hover:!text-danger"
          aria-label="Remove from conversation"
          title="Remove from conversation"
          :disabled="isKickingUser === participantUserId(participant)"
          @click="handleKickParticipant(participantUserId(participant))"
        >
          <Loader2 v-if="isKickingUser === participantUserId(participant)" class="animate-spin" />
          <UserMinus v-else />
        </Button>
      </div>
    </div>
  </Modal>
  </PageLayout>
</template>
