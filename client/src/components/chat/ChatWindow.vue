<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';
import { useChatPopout } from '@/composables/useChatPopout';
import { messagingSocket } from '@/services/messagingSocket';
import { formatTime } from '@/utils/dateTimeUtils';
import type { Conversation, Message, MessageAttachment } from '@/services/messagingApi';
import { getAttachmentDownloadUrl, uploadMessageAttachments } from '@/services/messagingApi';
import { compressImages, validateImageFile, formatFileSize } from '@/utils/imageCompression';
import { X, Minus, Maximize2, Loader2 } from 'lucide-vue-next';
import ConversationAvatar from '@/components/messaging/ConversationAvatar.vue';
import MessageBubble from '@/components/messaging/MessageBubble.vue';
import MessageComposer from '@/components/messaging/MessageComposer.vue';
import TypingIndicator from '@/components/messaging/TypingIndicator.vue';
import { Button } from '@/components/ui/button';

const props = defineProps<{
  conversationId: number;
  index: number;
}>();

const messagingStore = useMessagingStore();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { closeChat } = useChatPopout();

// Draggable state
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const bubblePosition = ref({ x: 0, y: 0 });

// Check if on editor pages where bubbles should be draggable
const isEditorPage = computed(() => {
  return route.path === '/editor' || route.path === '/ai-video';
});

const messageInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const isMinimized = ref(false);
const isJoined = ref(false);
const isLoadingLocal = ref(false);

// Edit state
const editingMessageId = ref<number | null>(null);
const editContent = ref('');

// Attachment state
const selectedAttachments = ref<File[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isUploadingAttachments = ref(false);

const attachmentPreviews = computed(() => {
  return selectedAttachments.value.map(file => ({
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    size: formatFileSize(file.size),
  }));
});

// Local typing tracking for this window
const localTypingUsers = ref<Set<number>>(new Set());
let typingTimeout: ReturnType<typeof setTimeout> | null = null;

const conversation = computed<Conversation | undefined>(() => {
  return messagingStore.conversations.get(props.conversationId);
});

const windowMessages = computed<Message[]>(() => {
  const msgs = messagingStore.messages.get(props.conversationId) || [];
  return [...msgs].sort((a, b) => {
    const aTime = (a as any).insertedAt || (a as any).inserted_at;
    const bTime = (b as any).insertedAt || (b as any).inserted_at;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
});

const unreadCount = computed(() => {
  return messagingStore.unreadCounts.get(props.conversationId) || 0;
});

const conversationName = computed(() => {
  const conv = conversation.value;
  if (!conv) return 'Chat';
  if (conv.name) return conv.name;
  if (conv.type === 'support') return 'Support';
  if (conv.type === 'direct') {
    const other = conv.participants.find((p) => {
      const pUserId = (p as any).userId ?? (p as any).user_id;
      return pUserId !== authStore.user?.id;
    });
    if (!other?.user) return 'Unknown User';
    return other.user.displayName || (other.user as any).display_name || 'Unknown User';
  }
  if (conv.type === 'announcement') return 'Announcement';
  return 'Group Chat';
});

const conversationAvatar = computed(() => {
  const conv = conversation.value;
  if (!conv || conv.type !== 'direct') return null;
  const other = conv.participants.find((p) => {
    const pUserId = (p as any).userId ?? (p as any).user_id;
    return pUserId !== authStore.user?.id;
  });
  if (!other?.user) return null;
  return other.user.avatarUrl || (other.user as any).avatar_url || null;
});

const typingUserNames = computed(() => {
  const names: string[] = [];
  localTypingUsers.value.forEach((userId) => {
    const conv = conversation.value;
    if (!conv) return;
    const participant = conv.participants.find((p) => {
      const pUserId = (p as any).userId ?? (p as any).user_id;
      return pUserId === userId;
    });
    if (participant?.user) {
      const name = participant.user.displayName || (participant.user as any).display_name;
      if (name && name !== 'Unknown User') names.push(name);
    }
  });
  return names;
});

// Layout: windows sit in the bottom-right corner (the chat entry point lives in
// the title bar now), stacked right-to-left; minimized windows collapse to
// avatar bubbles stacked bottom-up. On editor pages the bubble is draggable.
const EDGE = 16;
const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;
const WINDOW_GAP = 12;
const BUBBLE_SIZE = 44;

const windowStyle = computed(() => {
  if (isEditorPage.value) {
    // On editor pages, always use bubble position (whether minimized or expanded)
    if (isMinimized.value) {
      return {
        left: `${bubblePosition.value.x}px`,
        top: `${bubblePosition.value.y}px`,
        right: 'auto',
        bottom: 'auto',
      };
    } else {
      // Expanded: position the window so it appears at the bubble location, kept on screen
      let leftPos = bubblePosition.value.x - WINDOW_WIDTH + BUBBLE_SIZE;
      let topPos = bubblePosition.value.y;

      if (leftPos < 10) leftPos = 10;
      if (leftPos + WINDOW_WIDTH > window.innerWidth - 10) leftPos = window.innerWidth - WINDOW_WIDTH - 10;
      if (topPos < 10) topPos = 10;
      if (topPos + WINDOW_HEIGHT > window.innerHeight - 10) topPos = window.innerHeight - WINDOW_HEIGHT - 10;

      return {
        left: `${leftPos}px`,
        top: `${topPos}px`,
        right: 'auto',
        bottom: 'auto',
      };
    }
  } else if (isMinimized.value) {
    // Bubbles stacked vertically in the bottom-right corner
    return {
      right: `${EDGE}px`,
      bottom: `${EDGE + props.index * (BUBBLE_SIZE + WINDOW_GAP)}px`,
    };
  } else {
    // Full windows stacked from the right
    return {
      right: `${EDGE + props.index * (WINDOW_WIDTH + WINDOW_GAP)}px`,
      bottom: `${EDGE}px`,
    };
  }
});

// Drag handlers
const hasDragged = ref(false);

function startDrag(event: MouseEvent) {
  if (!isEditorPage.value || !isMinimized.value) return;
  
  isDragging.value = true;
  hasDragged.value = false;
  dragOffset.value = {
    x: event.clientX - bubblePosition.value.x,
    y: event.clientY - bubblePosition.value.y,
  };
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  
  hasDragged.value = true;
  bubblePosition.value = {
    x: event.clientX - dragOffset.value.x,
    y: event.clientY - dragOffset.value.y,
  };
}

function stopDrag() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

function handleBubbleClick() {
  // Only toggle if we didn't drag
  if (hasDragged.value) {
    hasDragged.value = false;
    return;
  }
  toggleMinimize();
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

async function joinConversation() {
  if (isJoined.value) return;
  isLoadingLocal.value = true;

  try {
    // Join the conversation channel for real-time messages
    await messagingSocket.joinConversation(props.conversationId, {
      onNewMessage: (message: Message) => {
        // Add to store
        const msgs = messagingStore.messages.get(props.conversationId) || [];
        if (!msgs.find((m) => m.id === message.id)) {
          messagingStore.messages.set(props.conversationId, [...msgs, message]);
        }
        // Update conversation preview
        const conv = messagingStore.conversations.get(props.conversationId);
        if (conv) {
          conv.lastMessageAt = message.insertedAt;
          conv.lastMessagePreview = message.content.slice(0, 100);
          messagingStore.conversations.set(props.conversationId, { ...conv });
        }
        if (isAtBottom.value && !isMinimized.value) {
          scrollToBottom();
        }
      },
      onMessageEdited: (message: Message) => {
        const msgs = messagingStore.messages.get(props.conversationId);
        if (msgs) {
          const idx = msgs.findIndex((m) => m.id === message.id);
          if (idx !== -1) {
            msgs[idx] = message;
            messagingStore.messages.set(props.conversationId, [...msgs]);
          }
        }
      },
      onMessageDeleted: (event: { messageId: number }) => {
        const msgs = messagingStore.messages.get(props.conversationId);
        if (msgs) {
          const idx = msgs.findIndex((m) => m.id === event.messageId);
          if (idx !== -1) {
            msgs[idx] = { ...msgs[idx], deletedAt: new Date().toISOString() };
            messagingStore.messages.set(props.conversationId, [...msgs]);
          }
        }
      },
      onTyping: (event: { userId: number }) => {
        if (event.userId === authStore.user?.id) return;
        localTypingUsers.value.add(event.userId);
        localTypingUsers.value = new Set(localTypingUsers.value);
        setTimeout(() => {
          localTypingUsers.value.delete(event.userId);
          localTypingUsers.value = new Set(localTypingUsers.value);
        }, 3000);
      },
      onRead: () => {
        // Mark as read in unread counts
        messagingStore.unreadCounts.set(props.conversationId, 0);
      },
    });

    isJoined.value = true;

    // Load messages if not already loaded
    if (!messagingStore.messages.has(props.conversationId)) {
      await messagingStore.loadMessages(props.conversationId);
    }

    // Mark as read
    messagingStore.markAsRead(props.conversationId);

    // Wait for loading to finish and DOM to update before scrolling
    await nextTick();
    isLoadingLocal.value = false;
    await nextTick();
    scrollToBottom(false);
  } catch (error) {
    console.error('[ChatWindow] Failed to join conversation:', error);
    isLoadingLocal.value = false;
  }
}

function leaveConversation() {
  if (isJoined.value) {
    messagingSocket.leaveConversation(props.conversationId);
    isJoined.value = false;
  }
}

async function handleSend() {
  const content = messageInput.value.trim();
  const hasAttachments = selectedAttachments.value.length > 0;

  if (!content && !hasAttachments) return;

  const originalContent = messageInput.value;
  const attachmentsToSend = [...selectedAttachments.value];

  messageInput.value = '';
  selectedAttachments.value = [];

  try {
    let attachmentData: any[] = [];

    if (hasAttachments) {
      isUploadingAttachments.value = true;
      const compressed = await compressImages(attachmentsToSend, 15);
      const uploaded = await uploadMessageAttachments(props.conversationId, compressed);
      attachmentData = uploaded;
      isUploadingAttachments.value = false;
    }

    await messagingSocket.sendMessage(props.conversationId, content || ' ', attachmentData);
    scrollToBottom();
  } catch (error) {
    console.error('[ChatWindow] Failed to send message:', error);
    messageInput.value = originalContent;
    selectedAttachments.value = attachmentsToSend;
    isUploadingAttachments.value = false;
  }
}

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
    console.error('[ChatWindow] Error selecting files:', error);
  }
}

function handlePaste(event: ClipboardEvent) {
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

function startEdit(msg: Message) {
  editingMessageId.value = msg.id;
  editContent.value = msg.content;
}

function cancelEdit() {
  editingMessageId.value = null;
  editContent.value = '';
}

async function saveEdit() {
  if (!editingMessageId.value || !editContent.value.trim()) return;
  try {
    await messagingSocket.editMessage(props.conversationId, editingMessageId.value, editContent.value.trim());
    cancelEdit();
  } catch (error) {
    console.error('[ChatWindow] Failed to edit message:', error);
  }
}

async function handleDelete(messageId: number) {
  try {
    await messagingSocket.deleteMessage(props.conversationId, messageId);
  } catch (error) {
    console.error('[ChatWindow] Failed to delete message:', error);
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

function removeAttachment(index: number) {
  selectedAttachments.value.splice(index, 1);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

function handleTyping() {
  if (typingTimeout) clearTimeout(typingTimeout);
  messagingSocket.sendTyping(props.conversationId);
  typingTimeout = setTimeout(() => {
    typingTimeout = null;
  }, 2000);
}

function handleClose() {
  leaveConversation();
  closeChat(props.conversationId);
}

function toggleMinimize() {
  isMinimized.value = !isMinimized.value;
  if (!isMinimized.value) {
    scrollToBottom(false);
    messagingStore.markAsRead(props.conversationId);
  }
}

function handleExpand() {
  leaveConversation();
  closeChat(props.conversationId);
  router.push('/messages');
}

function formatMsgTime(dateString: string): string {
  return formatTime(dateString);
}

/** Sender names only in group-style chats, and only when the sender changes. */
function showSenderName(index: number): boolean {
  if (conversation.value?.type === 'direct') return false;
  const msg = windowMessages.value[index];
  const prev = windowMessages.value[index - 1];
  return !prev || prev.senderId !== msg.senderId || prev.messageType === 'system';
}

// Scroll to bottom when new messages arrive
watch(
  () => windowMessages.value.length,
  (newLength, oldLength) => {
    if (isMinimized.value) return;
    
    // On initial load (0 -> N messages), always scroll to bottom
    if (oldLength === 0 && newLength > 0) {
      scrollToBottom(false);
      return;
    }
    
    // For subsequent messages, only scroll if already at bottom
    if (isAtBottom.value) {
      scrollToBottom();
    }
  }
);

// Mark as read when un-minimized
watch(isMinimized, (minimized) => {
  if (!minimized && unreadCount.value > 0) {
    messagingStore.markAsRead(props.conversationId);
  }
});

onMounted(() => {
  joinConversation();
  
  // Initialize bubble position for editor pages
  if (isEditorPage.value) {
    // Start position: bottom-right corner, stacked to the left
    const startX = window.innerWidth - EDGE - BUBBLE_SIZE - props.index * (BUBBLE_SIZE + WINDOW_GAP);
    const startY = window.innerHeight - EDGE - BUBBLE_SIZE;
    bubblePosition.value = { x: startX, y: startY };
  }
});

onUnmounted(() => {
  leaveConversation();
  if (typingTimeout) clearTimeout(typingTimeout);
});
</script>

<template>
  <div
    class="chat-window fixed z-[10001]"
    :class="
      isMinimized
        ? ''
        : 'flex h-[min(480px,calc(100vh-var(--titlebar-height)-32px))] w-[360px] flex-col overflow-hidden rounded-xl bg-surface-raised shadow-[var(--shadow-lg)]'
    "
    :style="windowStyle"
  >
    <!-- Minimized: avatar bubble -->
    <button
      v-if="isMinimized"
      type="button"
      class="relative grid size-11 select-none place-items-center rounded-full shadow-[var(--shadow-md)] transition-transform hover:scale-105 focus-visible:shadow-[var(--focus-ring)]"
      :class="isEditorPage ? (isDragging ? 'cursor-grabbing opacity-80' : 'cursor-move') : ''"
      :aria-label="`Open chat with ${conversationName}`"
      :title="conversationName"
      @mousedown="startDrag"
      @click="handleBubbleClick"
    >
      <ConversationAvatar
        :name="conversationName"
        :src="conversationAvatar"
        :type="conversation?.type"
        size="lg"
        class="pointer-events-none !bg-surface-raised"
      />
      <span
        v-if="unreadCount > 0"
        class="tabular pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-fg ring-2 ring-canvas"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Full chat window -->
    <template v-else>
      <!-- Header (click to minimize) -->
      <div
        class="flex h-12 shrink-0 cursor-pointer items-center gap-2.5 border-b border-line-subtle pl-3 pr-1.5 transition-colors hover:bg-surface-hover"
        @click="toggleMinimize"
      >
        <ConversationAvatar :name="conversationName" :src="conversationAvatar" :type="conversation?.type" size="sm" />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{{ conversationName }}</span>
        <div class="flex shrink-0 items-center" @click.stop>
          <Button variant="ghost" size="icon-xs" aria-label="Open in Messages" title="Open in Messages" @click="handleExpand">
            <Maximize2 />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Minimize" title="Minimize" @click="toggleMinimize">
            <Minus />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Close" title="Close" @click="handleClose">
            <X />
          </Button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="min-h-0 flex-1 overflow-y-auto px-3 py-3" @scroll="handleScroll">
        <!-- Spinner only when nothing is cached yet, delayed like a skeleton -->
        <div v-if="isLoadingLocal && windowMessages.length === 0" class="skeleton-group flex h-full items-center justify-center">
          <Loader2 class="size-5 animate-spin text-fg-subtle" />
        </div>

        <div v-else class="flex animate-fade-in flex-col gap-2">
          <p v-if="windowMessages.length === 0" class="py-8 text-center text-xs text-fg-subtle">
            No messages yet — say hi.
          </p>
          <MessageBubble
            v-for="(msg, index) in windowMessages"
            :key="msg.id"
            compact
            :message="msg"
            :is-own-message="msg.senderId === authStore.user?.id"
            :is-editing="editingMessageId === msg.id"
            :edit-content="editContent"
            :show-sender="showSenderName(index)"
            @edit="startEdit(msg)"
            @delete="handleDelete(msg.id)"
            @update:edit-content="editContent = $event"
            @save-edit="saveEdit"
            @cancel-edit="cancelEdit"
          />
          <TypingIndicator v-if="typingUserNames.length > 0" :user-names="typingUserNames" />
        </div>
      </div>

      <!-- Composer -->
      <MessageComposer
        v-model="messageInput"
        compact
        placeholder="Type a message…"
        :attachments="attachmentPreviews"
        :uploading="isUploadingAttachments"
        @keydown="handleKeydown"
        @input="handleTyping"
        @paste="handlePaste"
        @attach="handleAttachClick"
        @send="handleSend"
        @remove-attachment="removeAttachment"
      />
      <input ref="fileInputRef" type="file" accept="image/*" multiple hidden @change="handleFileSelect" />
    </template>
  </div>
</template>
