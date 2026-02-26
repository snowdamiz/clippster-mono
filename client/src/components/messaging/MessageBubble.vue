<script setup lang="ts">
import { computed } from 'vue';
import type { Message } from '@/services/messagingApi';
import { formatTime as fmtTime, formatMessageTime, formatDate as fmtDate } from '@/utils/dateTimeUtils';

const props = defineProps<{
  message: Message;
  isOwnMessage: boolean;
  isEditing: boolean;
  editContent: string;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  'update:editContent': [value: string];
  saveEdit: [];
  cancelEdit: [];
}>();

const isDeleted = computed(() => !!props.message.deletedAt);
const isEdited = computed(() => !!props.message.editedAt && !isDeleted.value);
const isSystemMessage = computed(() => props.message.messageType === 'system');

function formatTime(dateString: string): string {
  return fmtTime(dateString);
}

function formatDate(dateString: string): string {
  return formatMessageTime(dateString);
}
</script>

<template>
  <div 
    class="message-bubble"
    :class="{ 
      own: isOwnMessage, 
      other: !isOwnMessage,
      system: isSystemMessage,
      deleted: isDeleted
    }"
  >
    <!-- System message -->
    <template v-if="isSystemMessage">
      <div class="system-message">
        {{ message.content }}
      </div>
    </template>

    <!-- Regular message -->
    <template v-else>
      <!-- Sender info (for other's messages) -->
      <div v-if="!isOwnMessage && message.sender" class="sender-info">
        <div class="sender-avatar">
          <img 
            v-if="message.sender.avatarUrl" 
            :src="message.sender.avatarUrl" 
            :alt="message.sender.displayName"
            class="sender-avatar-image"
          />
          <span v-else class="sender-avatar-initial">
            {{ message.sender.displayName.charAt(0).toUpperCase() }}
          </span>
        </div>
        <span class="sender-name">{{ message.sender.displayName }}</span>
      </div>

      <!-- Message content -->
      <div class="message-content">
        <!-- Editing mode -->
        <template v-if="isEditing">
          <textarea
            :value="editContent"
            @input="emit('update:editContent', ($event.target as HTMLTextAreaElement).value)"
            @keydown.enter.prevent="emit('saveEdit')"
            @keydown.escape="emit('cancelEdit')"
            class="edit-input"
            rows="2"
          ></textarea>
          <div class="edit-actions">
            <button class="edit-btn save" @click="emit('saveEdit')">Save</button>
            <button class="edit-btn cancel" @click="emit('cancelEdit')">Cancel</button>
          </div>
        </template>

        <!-- Normal display -->
        <template v-else>
          <p v-if="isDeleted" class="deleted-text">This message was deleted</p>
          <p v-else class="message-text">{{ message.content }}</p>
        </template>
      </div>

      <!-- Message meta -->
      <div class="message-meta">
        <span class="message-time">{{ formatTime(message.insertedAt) }}</span>
        <span v-if="isEdited" class="edited-label">(edited)</span>
      </div>

      <!-- Actions (for own messages) -->
      <div v-if="isOwnMessage && !isDeleted && !isEditing" class="message-actions">
        <button class="action-btn" @click="emit('edit')" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="action-btn delete" @click="emit('delete')" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.message-bubble {
  max-width: 70%;
  position: relative;
}

.message-bubble.own {
  align-self: flex-end;
  margin-left: auto;
}

.message-bubble.other {
  align-self: flex-start;
}

.message-bubble.system {
  align-self: center;
  max-width: 100%;
}

.system-message {
  font-size: 12px;
  color: var(--text-tertiary, #666);
  text-align: center;
  padding: 8px 16px;
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 12px;
}

.sender-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.sender-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--accent-color, #7c3aed);
  color: white;
}

.sender-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.sender-avatar-initial {
  font-size: 11px;
  font-weight: 600;
}

.sender-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #888);
}

.message-content {
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--bg-tertiary, #2a2a2a);
}

.message-bubble.own .message-content {
  background: var(--accent-color, #7c3aed);
  border-bottom-right-radius: 4px;
}

.message-bubble.other .message-content {
  border-bottom-left-radius: 4px;
}

.message-bubble.deleted .message-content {
  background: var(--bg-tertiary, #2a2a2a);
}

.message-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #fff);
  white-space: pre-wrap;
  word-break: break-word;
}

.deleted-text {
  margin: 0;
  font-size: 14px;
  font-style: italic;
  color: var(--text-tertiary, #666);
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 0 4px;
}

.message-bubble.own .message-meta {
  justify-content: flex-end;
}

.message-time {
  font-size: 11px;
  color: var(--text-tertiary, #666);
}

.edited-label {
  font-size: 11px;
  color: var(--text-tertiary, #666);
}

.message-actions {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.message-bubble.own .message-actions {
  left: -60px;
}

.message-bubble:hover .message-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--bg-tertiary, #333);
  color: var(--text-secondary, #888);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
  background: var(--bg-hover, #444);
  color: var(--text-primary, #fff);
}

.action-btn.delete:hover {
  background: #dc2626;
  color: white;
}

.edit-input {
  width: 100%;
  background: var(--bg-secondary, #222);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  padding: 8px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
}

.edit-input:focus {
  border-color: var(--accent-color, #7c3aed);
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.edit-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.edit-btn.save {
  background: var(--accent-color, #7c3aed);
  color: white;
}

.edit-btn.save:hover {
  background: var(--accent-hover, #6d28d9);
}

.edit-btn.cancel {
  background: var(--bg-tertiary, #333);
  color: var(--text-secondary, #888);
}

.edit-btn.cancel:hover {
  background: var(--bg-hover, #444);
}
</style>
