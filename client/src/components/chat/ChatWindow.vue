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
import {
  X,
  Minus,
  Maximize2,
  Send,
  Users,
  User,
  Megaphone,
  Headset,
  ImageIcon,
  Paperclip,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-vue-next';

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

// Position offset based on index (stacked from right)
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
      // Expanded: position the window so it appears at the bubble location
      // Calculate position with boundary checking
      const windowWidth = 360;
      const windowHeight = 480;
      let leftPos = bubblePosition.value.x - windowWidth + 28;
      let topPos = bubblePosition.value.y;
      
      // Prevent going off left edge
      if (leftPos < 10) {
        leftPos = 10;
      }
      
      // Prevent going off right edge
      if (leftPos + windowWidth > window.innerWidth - 10) {
        leftPos = window.innerWidth - windowWidth - 10;
      }
      
      // Prevent going off top edge
      if (topPos < 10) {
        topPos = 10;
      }
      
      // Prevent going off bottom edge
      if (topPos + windowHeight > window.innerHeight - 10) {
        topPos = window.innerHeight - windowHeight - 10;
      }
      
      return {
        left: `${leftPos}px`,
        top: `${topPos}px`,
        right: 'auto',
        bottom: 'auto',
      };
    }
  } else if (isMinimized.value) {
    // On other pages, position to the left of the FAB
    // FAB is at bottom: 20px, right: 20px, size: 44px
    // Position bubbles stacked vertically to the left of FAB
    const leftOffset = 80; // 20px (FAB right) + 44px (FAB width) + 16px (gap)
    const verticalOffset = 20 + props.index * 68; // 20px base + 68px per bubble (56px + 12px gap)
    return {
      right: `${leftOffset}px`,
      bottom: `${verticalOffset}px`,
    };
  } else {
    // Full window: stacked from right
    const rightOffset = 68 + props.index * 372;
    return {
      right: `${rightOffset}px`,
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
    // Start position: bottom right corner, matching FAB position
    // FAB is at bottom: 20px, right: 20px
    // Stack bubbles to the left of FAB
    const startX = window.innerWidth - 80 - (props.index * 56); // 20px + 44px FAB + 16px gap + stacked left
    const startY = window.innerHeight - 64; // 20px from bottom + 44px bubble
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
    class="chat-window"
    :class="{ 'chat-window--minimized': isMinimized }"
    :style="windowStyle"
  >
    <!-- Minimized avatar bubble (only visible when minimized) -->
    <div 
      v-if="isMinimized" 
      class="chat-window__minimized-bubble" 
      :class="{ 'chat-window__minimized-bubble--draggable': isEditorPage, 'chat-window__minimized-bubble--dragging': isDragging }"
      @mousedown="startDrag"
      @click="handleBubbleClick"
    >
      <div class="chat-window__avatar" :class="conversation ? 'chat-window__avatar--' + conversation.type : ''">
        <img
          v-if="conversationAvatar"
          :src="conversationAvatar"
          :alt="conversationName"
          class="chat-window__avatar-img"
        />
        <template v-else>
          <Headset v-if="conversation?.type === 'support'" :size="20" />
          <Users v-else-if="conversation?.type === 'group'" :size="20" />
          <Megaphone v-else-if="conversation?.type === 'announcement'" :size="20" />
          <span v-else class="chat-window__avatar-initial">
            {{ conversationName.charAt(0).toUpperCase() }}
          </span>
        </template>
      </div>
      <span v-if="unreadCount > 0" class="chat-window__unread-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </div>

    <!-- Full chat window (only visible when not minimized) -->
    <template v-else>
    <!-- Header (always visible) -->
    <div class="chat-window__header" @click="toggleMinimize">
      <!-- Avatar -->
      <div class="chat-window__avatar" :class="conversation ? 'chat-window__avatar--' + conversation.type : ''">
        <img
          v-if="conversationAvatar"
          :src="conversationAvatar"
          :alt="conversationName"
          class="chat-window__avatar-img"
        />
        <template v-else>
          <Headset v-if="conversation?.type === 'support'" :size="16" />
          <Users v-else-if="conversation?.type === 'group'" :size="16" />
          <Megaphone v-else-if="conversation?.type === 'announcement'" :size="16" />
          <span v-else class="chat-window__avatar-initial">
            {{ conversationName.charAt(0).toUpperCase() }}
          </span>
        </template>
      </div>
      <span class="chat-window__name">{{ conversationName }}</span>
      <!-- Unread badge (when minimized) -->
      <span v-if="isMinimized && unreadCount > 0" class="chat-window__unread-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
      <div class="chat-window__header-actions" @click.stop>
        <button class="chat-window__header-btn" @click="handleExpand" title="Open in full page">
          <Maximize2 :size="14" />
        </button>
        <button class="chat-window__header-btn" @click="toggleMinimize" :title="isMinimized ? 'Expand' : 'Minimize'">
          <Minus :size="14" />
        </button>
        <button class="chat-window__header-btn chat-window__header-btn--close" @click="handleClose" title="Close">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Body (hidden when minimized) -->
    <template v-if="!isMinimized">
      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="chat-window__messages"
        @scroll="handleScroll"
      >
        <!-- Loading -->
        <div v-if="isLoadingLocal" class="chat-window__loading">
          <div class="chat-window__spinner"></div>
        </div>

        <!-- Message list -->
        <div v-else class="chat-window__msg-list">
          <div
            v-for="msg in windowMessages"
            :key="msg.id"
            class="chat-window__msg"
            :class="{
              'chat-window__msg--own': msg.senderId === authStore.user?.id,
              'chat-window__msg--other': msg.senderId !== authStore.user?.id,
              'chat-window__msg--system': msg.messageType === 'system',
              'chat-window__msg--deleted': !!msg.deletedAt,
            }"
          >
            <!-- System message -->
            <div v-if="msg.messageType === 'system'" class="chat-window__msg-system">
              {{ msg.content }}
            </div>

            <!-- Regular message -->
            <template v-else>
              <!-- Sender name for other's messages -->
              <span
                v-if="msg.senderId !== authStore.user?.id && msg.sender"
                class="chat-window__msg-sender"
              >
                {{ msg.sender.displayName || (msg.sender as any).display_name || 'Unknown' }}
              </span>
              <div class="chat-window__msg-bubble">
                <p v-if="msg.deletedAt" class="chat-window__msg-deleted">This message was deleted</p>
                <!-- Edit Mode -->
                <template v-else-if="editingMessageId === msg.id">
                  <textarea
                    v-model="editContent"
                    @keydown.enter.exact.prevent="saveEdit"
                    @keydown.escape="cancelEdit"
                    class="chat-window__edit-input"
                    rows="2"
                  ></textarea>
                  <div class="chat-window__edit-actions">
                    <button @click="saveEdit" class="chat-window__edit-btn chat-window__edit-btn--save">Save</button>
                    <button @click="cancelEdit" class="chat-window__edit-btn chat-window__edit-btn--cancel">Cancel</button>
                  </div>
                </template>
                <template v-else>
                  <p v-if="msg.content && msg.content.trim()" class="chat-window__msg-text">{{ msg.content }}</p>
                  <!-- Attachments -->
                  <div v-if="msg.attachments && msg.attachments.length > 0" class="chat-window__attachments">
                    <div
                      v-for="attachment in msg.attachments"
                      :key="attachment.id"
                      class="chat-window__attachment"
                    >
                      <img
                        :src="attachment.thumbnailUrl || attachment.url"
                        :alt="attachment.filename"
                        class="chat-window__attachment-img"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </template>
                <!-- Edit/Delete actions (own messages only) -->
                <div
                  v-if="msg.senderId === authStore.user?.id && !msg.deletedAt && editingMessageId !== msg.id"
                  class="chat-window__msg-actions"
                >
                  <button @click="startEdit(msg)" class="chat-window__msg-action" title="Edit">
                    <Pencil :size="12" />
                  </button>
                  <button @click="handleDelete(msg.id)" class="chat-window__msg-action chat-window__msg-action--delete" title="Delete">
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>
              <span class="chat-window__msg-time">
                {{ formatMsgTime(msg.insertedAt) }}
                <span v-if="msg.editedAt && !msg.deletedAt" class="chat-window__msg-edited">(edited)</span>
                <span
                  v-if="msg.senderId === authStore.user?.id && !msg.deletedAt"
                  class="chat-window__msg-status"
                  :class="{ 'chat-window__msg-status--read': msg.readBy && msg.readBy.length > 1 }"
                >
                  {{ msg.readBy && msg.readBy.length > 1 ? '• Read' : '• Sent' }}
                </span>
              </span>
            </template>
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="typingUserNames.length > 0" class="chat-window__typing">
          <div class="chat-window__typing-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="chat-window__typing-text">
            {{ typingUserNames.length === 1 ? typingUserNames[0] + ' is typing...' : typingUserNames.length + ' people typing...' }}
          </span>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-window__input-area">
        <!-- Attachment previews -->
        <div v-if="attachmentPreviews.length > 0" class="chat-window__attach-previews">
          <div
            v-for="(preview, idx) in attachmentPreviews"
            :key="idx"
            class="chat-window__attach-preview"
          >
            <img :src="preview.url" :alt="preview.name" class="chat-window__attach-preview-img" />
            <button class="chat-window__attach-preview-remove" @click="removeAttachment(idx)">
              <X :size="12" />
            </button>
          </div>
        </div>
        <div class="chat-window__input-row">
          <button
            class="chat-window__attach-btn"
            @click="handleAttachClick"
            :disabled="isUploadingAttachments"
            title="Attach image"
          >
            <Paperclip :size="16" />
          </button>
          <textarea
            v-model="messageInput"
            placeholder="Type a message..."
            rows="1"
            class="chat-window__input"
            @keydown="handleKeydown"
            @input="handleTyping"
            @paste="handlePaste"
          ></textarea>
          <button
            class="chat-window__send-btn"
            :disabled="(!messageInput.trim() && selectedAttachments.length === 0) || isUploadingAttachments"
            @click="handleSend"
          >
            <Loader2 v-if="isUploadingAttachments" :size="16" class="chat-window__send-spinner" />
            <Send v-else :size="16" />
          </button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="handleFileSelect"
        />
      </div>
    </template>
    </template>
  </div>
</template>

<style scoped>
.chat-window {
  position: fixed;
  bottom: 80px;
  z-index: 10001;
}

.chat-window:not(.chat-window--minimized) {
  width: 360px;
  min-width: 360px;
  max-width: 360px;
  height: 480px;
  background: var(--sidebar-surface, #141416);
  border: 1px solid var(--sidebar-border, #1f1f23);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-window--minimized {
  width: auto;
  height: auto;
}

/* Minimized bubble */
.chat-window__minimized-bubble {
  position: relative;
  width: 44px;
  height: 44px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.chat-window__minimized-bubble--draggable {
  cursor: move;
}

.chat-window__minimized-bubble--dragging {
  cursor: grabbing;
  opacity: 0.8;
}

.chat-window__minimized-bubble .chat-window__avatar {
  width: 44px;
  height: 44px;
  font-size: 18px;
  pointer-events: none;
}

.chat-window__minimized-bubble .chat-window__unread-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  pointer-events: none;
}

/* Header */
.chat-window__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--sidebar-bg, #0a0a0b);
  border-bottom: 1px solid var(--sidebar-border, #1f1f23);
  cursor: pointer;
  flex-shrink: 0;
  min-height: 48px;
  box-sizing: border-box;
}

.chat-window__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  color: var(--sidebar-text-muted, #71717a);
  font-size: 13px;
  font-weight: 600;
}

.chat-window__avatar--direct {
  background: var(--sidebar-accent, #0ea5e9);
  color: white;
}

.chat-window__avatar--group {
  background: #2563eb;
  color: white;
}

.chat-window__avatar--announcement {
  background: #dc2626;
  color: white;
}

.chat-window__avatar--support {
  background: #16a34a;
  color: white;
}

.chat-window__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.chat-window__avatar-initial {
  font-size: 13px;
  font-weight: 600;
}

.chat-window__name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--sidebar-text, #fafafa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-window__unread-badge {
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--sidebar-bg, #0a0a0b);
}

.chat-window__header-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.chat-window__header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text-muted, #71717a);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.chat-window__header-btn:hover {
  background: var(--sidebar-hover, rgba(255, 255, 255, 0.05));
  color: var(--sidebar-text, #fafafa);
}

.chat-window__header-btn--close:hover {
  background: #dc2626;
  color: white;
}

/* Messages */
.chat-window__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chat-window__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.chat-window__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--sidebar-border, #1f1f23);
  border-top-color: var(--sidebar-accent, #0ea5e9);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chat-window__msg-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-window__msg {
  max-width: 80%;
  display: flex;
  flex-direction: column;
}

.chat-window__msg--own {
  align-self: flex-end;
  align-items: flex-end;
}

.chat-window__msg--other {
  align-self: flex-start;
  align-items: flex-start;
}

.chat-window__msg--system {
  align-self: center;
  max-width: 100%;
}

.chat-window__msg-system {
  font-size: 11px;
  color: var(--sidebar-text-muted, #71717a);
  text-align: center;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.chat-window__msg-sender {
  font-size: 11px;
  font-weight: 500;
  color: var(--sidebar-text-muted, #71717a);
  margin-bottom: 2px;
  padding-left: 2px;
}

.chat-window__msg-bubble {
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
}

.chat-window__msg--own .chat-window__msg-bubble {
  background: var(--sidebar-accent, #0ea5e9);
  border-bottom-right-radius: 4px;
}

.chat-window__msg--other .chat-window__msg-bubble {
  border-bottom-left-radius: 4px;
}

.chat-window__msg--deleted .chat-window__msg-bubble {
  background: rgba(255, 255, 255, 0.06);
}

/* Edit/Delete actions */
.chat-window__msg {
  position: relative;
}

.chat-window__msg-actions {
  position: absolute;
  top: 50%;
  right: -60px;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.chat-window__msg:hover .chat-window__msg-actions {
  opacity: 1;
}

.chat-window__msg-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.chat-window__msg-action:hover {
  background: rgba(0, 0, 0, 0.7);
  color: white;
}

.chat-window__msg-action--delete:hover {
  background: #dc2626;
  color: white;
}

/* Edit mode */
.chat-window__edit-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--sidebar-surface, #141416);
  border: 1px solid var(--sidebar-border, #1f1f23);
  border-radius: 6px;
  font-size: 13px;
  color: var(--sidebar-text, #fafafa);
  resize: none;
  outline: none;
  font-family: inherit;
}

.chat-window__edit-input:focus {
  border-color: var(--sidebar-accent, #0ea5e9);
}

.chat-window__edit-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.chat-window__edit-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.chat-window__edit-btn--save {
  background: #10b981;
  color: white;
}

.chat-window__edit-btn--save:hover {
  background: #059669;
}

.chat-window__edit-btn--cancel {
  background: rgba(255, 255, 255, 0.1);
  color: var(--sidebar-text-muted, #71717a);
}

.chat-window__edit-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

.chat-window__msg-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--sidebar-text, #fafafa);
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-window__msg-deleted {
  margin: 0;
  font-size: 13px;
  font-style: italic;
  color: var(--sidebar-text-muted, #71717a);
}

/* Attachments */
.chat-window__attachments {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 140px));
  gap: 4px;
  margin-top: 4px;
  width: fit-content;
  max-width: 100%;
}

.chat-window__attachment {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.chat-window__attachment-img {
  width: 100%;
  height: auto;
  max-height: 180px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.chat-window__msg-time {
  font-size: 10px;
  color: var(--sidebar-text-muted, #71717a);
  margin-top: 2px;
  padding: 0 2px;
}

.chat-window__msg-edited {
  font-style: italic;
}

/* Read / Sent status */
.chat-window__msg-status {
  margin-left: 2px;
  opacity: 0.7;
}

.chat-window__msg--own .chat-window__msg-time {
  color: white;
  opacity: 0.85;
}

.chat-window__msg-status--read {
  color: #fef08a;
  opacity: 1;
  font-weight: 600;
}

/* Typing */
.chat-window__typing {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 11px;
  color: var(--sidebar-text-muted, #71717a);
}

.chat-window__typing-dots {
  display: flex;
  gap: 2px;
}

.chat-window__typing-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sidebar-text-muted, #71717a);
  animation: bounce 1.4s infinite ease-in-out both;
}

.chat-window__typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.chat-window__typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.chat-window__typing-text {
  font-style: italic;
}

/* Input */
.chat-window__input-area {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-top: 1px solid var(--sidebar-border, #1f1f23);
  background: var(--sidebar-surface, #141416);
  flex-shrink: 0;
  gap: 6px;
}

.chat-window__input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

/* Attachment previews */
.chat-window__attach-previews {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
}

.chat-window__attach-preview {
  position: relative;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--sidebar-border, #1f1f23);
}

.chat-window__attach-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-window__attach-preview-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.chat-window__attach-preview-remove:hover {
  background: #dc2626;
}

/* Paperclip button */
.chat-window__attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--sidebar-text-muted, #71717a);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.chat-window__attach-btn:hover:not(:disabled) {
  color: var(--sidebar-text, #fafafa);
  background: var(--sidebar-hover, rgba(255, 255, 255, 0.05));
}

.chat-window__attach-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Upload spinner */
.chat-window__send-spinner {
  animation: spin 0.8s linear infinite;
}

.chat-window__input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--sidebar-border, #1f1f23);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--sidebar-text, #fafafa);
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
  max-height: 80px;
  line-height: 1.4;
}

.chat-window__input:focus {
  border-color: var(--sidebar-accent, #0ea5e9);
}

.chat-window__input::placeholder {
  color: var(--sidebar-text-muted, #71717a);
}

.chat-window__send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: var(--sidebar-accent, #0ea5e9);
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, opacity 0.15s;
}

.chat-window__send-btn:hover:not(:disabled) {
  background: #0284c7;
}

.chat-window__send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
