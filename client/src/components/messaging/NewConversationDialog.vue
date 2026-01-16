<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMessagingStore } from '@/stores/messaging';
import api from '@/services/api';

const props = defineProps<{
  organizationId: number;
}>();

const emit = defineEmits<{
  close: [];
  created: [conversationId: number];
}>();

const messagingStore = useMessagingStore();

type ConversationType = 'direct' | 'group' | 'announcement';

const conversationType = ref<ConversationType>('direct');
const groupName = ref('');
const announcementContent = ref('');
const selectedUserIds = ref<number[]>([]);
const searchQuery = ref('');
const isLoading = ref(false);
const members = ref<Array<{ id: number; userId: number; displayName: string; avatarUrl: string | null; role: string }>>([]);

const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value;
  const query = searchQuery.value.toLowerCase();
  return members.value.filter(m => 
    m.displayName.toLowerCase().includes(query)
  );
});

const canCreate = computed(() => {
  switch (conversationType.value) {
    case 'direct':
      return selectedUserIds.value.length === 1;
    case 'group':
      return groupName.value.trim() && selectedUserIds.value.length >= 1;
    case 'announcement':
      return announcementContent.value.trim();
    default:
      return false;
  }
});

onMounted(async () => {
  await loadMembers();
});

async function loadMembers() {
  try {
    const response = await api.get<{ data: Array<{ id: number; user_id: number; user: { display_name: string; avatar_url: string | null }; role: string }> }>(
      `/organizations/${props.organizationId}/members`
    );
    members.value = response.data.data.map(m => ({
      id: m.id,
      userId: m.user_id,
      displayName: m.user?.display_name || 'Unknown',
      avatarUrl: m.user?.avatar_url || null,
      role: m.role
    }));
  } catch (error) {
    console.error('Failed to load members:', error);
  }
}

function toggleUserSelection(userId: number) {
  if (conversationType.value === 'direct') {
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

function isUserSelected(userId: number): boolean {
  return selectedUserIds.value.includes(userId);
}

async function handleCreate() {
  if (!canCreate.value) return;

  isLoading.value = true;
  try {
    let conversation;
    
    switch (conversationType.value) {
      case 'direct':
        conversation = await messagingStore.startDirectConversation(selectedUserIds.value[0]);
        break;
      case 'group':
        conversation = await messagingStore.startGroupConversation(groupName.value.trim(), selectedUserIds.value);
        break;
      case 'announcement':
        conversation = await messagingStore.sendAnnouncement(announcementContent.value.trim());
        break;
    }

    if (conversation) {
      emit('created', conversation.id);
    }
  } catch (error) {
    console.error('Failed to create conversation:', error);
  } finally {
    isLoading.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="handleClose">
    <div class="dialog">
      <div class="dialog-header">
        <h2>New Conversation</h2>
        <button class="close-btn" @click="handleClose">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Conversation type selector -->
        <div class="type-selector">
          <button 
            class="type-btn"
            :class="{ active: conversationType === 'direct' }"
            @click="conversationType = 'direct'; selectedUserIds = []"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Direct
          </button>
          <button 
            class="type-btn"
            :class="{ active: conversationType === 'group' }"
            @click="conversationType = 'group'; selectedUserIds = []"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Group
          </button>
          <button 
            class="type-btn"
            :class="{ active: conversationType === 'announcement' }"
            @click="conversationType = 'announcement'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 11 18-5v12L3 13v-2z"/>
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
            </svg>
            Announcement
          </button>
        </div>

        <!-- Group name input -->
        <div v-if="conversationType === 'group'" class="form-group">
          <label>Group Name</label>
          <input 
            v-model="groupName"
            type="text"
            placeholder="Enter group name..."
            class="text-input"
          />
        </div>

        <!-- Announcement content -->
        <div v-if="conversationType === 'announcement'" class="form-group">
          <label>Announcement Message</label>
          <textarea 
            v-model="announcementContent"
            placeholder="Enter your announcement..."
            class="text-input"
            rows="4"
          ></textarea>
          <p class="hint">This will be sent to all organization members.</p>
        </div>

        <!-- Member selection (for direct and group) -->
        <div v-if="conversationType !== 'announcement'" class="form-group">
          <label>{{ conversationType === 'direct' ? 'Select User' : 'Select Members' }}</label>
          
          <!-- Search -->
          <div class="search-input">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input 
              v-model="searchQuery"
              type="text"
              placeholder="Search members..."
            />
          </div>

          <!-- Members list -->
          <div class="members-list">
            <div
              v-for="member in filteredMembers"
              :key="member.userId"
              class="member-item"
              :class="{ selected: isUserSelected(member.userId) }"
              @click="toggleUserSelection(member.userId)"
            >
              <div class="member-avatar">
                <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.displayName" />
                <span v-else>{{ member.displayName.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.displayName }}</span>
                <span class="member-role">{{ member.role }}</span>
              </div>
              <div class="selection-indicator">
                <svg v-if="isUserSelected(member.userId)" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>

            <div v-if="filteredMembers.length === 0" class="no-members">
              No members found
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="cancel-btn" @click="handleClose">Cancel</button>
        <button 
          class="create-btn"
          :disabled="!canCreate || isLoading"
          @click="handleCreate"
        >
          {{ isLoading ? 'Creating...' : 'Create' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-primary, #1a1a1a);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #333);
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #888);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.close-btn:hover {
  background: var(--bg-tertiary, #333);
  color: var(--text-primary, #fff);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.type-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  background: var(--bg-secondary, #222);
  color: var(--text-secondary, #888);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.type-btn:hover {
  border-color: var(--accent-color, #7c3aed);
  color: var(--text-primary, #fff);
}

.type-btn.active {
  background: var(--accent-color, #7c3aed);
  border-color: var(--accent-color, #7c3aed);
  color: white;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #888);
}

.text-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  background: var(--bg-secondary, #222);
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.text-input:focus {
  border-color: var(--accent-color, #7c3aed);
}

.text-input::placeholder {
  color: var(--text-tertiary, #666);
}

textarea.text-input {
  resize: vertical;
  min-height: 80px;
}

.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-tertiary, #666);
}

.search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  background: var(--bg-secondary, #222);
  margin-bottom: 12px;
}

.search-input svg {
  color: var(--text-tertiary, #666);
  flex-shrink: 0;
}

.search-input input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary, #fff);
  font-size: 14px;
  outline: none;
}

.search-input input::placeholder {
  color: var(--text-tertiary, #666);
}

.members-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border-color, #333);
}

.member-item:last-child {
  border-bottom: none;
}

.member-item:hover {
  background: var(--bg-hover, #2a2a2a);
}

.member-item.selected {
  background: rgba(124, 58, 237, 0.15);
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary, #333);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-avatar span {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #888);
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.member-role {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary, #666);
  text-transform: capitalize;
}

.selection-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color, #7c3aed);
}

.no-members {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary, #888);
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #333);
}

.cancel-btn,
.create-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.cancel-btn {
  background: var(--bg-tertiary, #333);
  color: var(--text-secondary, #888);
}

.cancel-btn:hover {
  background: var(--bg-hover, #444);
}

.create-btn {
  background: var(--accent-color, #7c3aed);
  color: #000;
}

.create-btn:hover:not(:disabled) {
  background: var(--accent-hover, #6d28d9);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
