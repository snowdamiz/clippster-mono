<template>
  <PageLayout
    title="Staff messages"
    description="Internal messaging for admins and moderators"
    :icon="MessagesSquare"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Staff messages' }]"
  >
    <div class="flex min-h-0 flex-1">
      <!-- ── Conversation list pane ─────────────────────────────────── -->
      <aside class="flex w-[clamp(220px,32%,320px)] shrink-0 flex-col border-r border-line-subtle">
        <div class="flex shrink-0 items-center gap-1.5 px-3 py-2.5">
          <SearchField v-model="searchQuery" placeholder="Search conversations" size="sm" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            title="New conversation"
            @click="showNewConversationDialog = true"
          >
            <SquarePen />
          </Button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <!-- Loading skeleton -->
          <AdminChatListSkeleton v-if="loadingConversations && !conversations.length" />

          <div v-else class="flex animate-fade-in flex-col gap-0.5">
            <ConversationRow
              v-for="conv in filteredConversations"
              :key="conv.id"
              :name="getConversationName(conv)"
              :type="conv.type === 'group' ? 'group' : 'direct'"
              :preview="conv.last_message_preview"
              :time="formatTime(conv.last_message_at)"
              :active="conv.id === selectedConversation?.id"
              @select="selectConversation(conv)"
            />

            <EmptyState
              v-if="searchQuery && filteredConversations.length === 0"
              size="sm"
              :icon="SearchX"
              title="No matches"
              :description="`No conversations match “${searchQuery}”.`"
            />
            <EmptyState
              v-else-if="conversations.length === 0"
              size="sm"
              :icon="MessagesSquare"
              title="No conversations yet"
              description="Start chatting with other admins and moderators."
            >
              <Button variant="secondary" size="sm" @click="showNewConversationDialog = true">
                <Plus />
                New conversation
              </Button>
            </EmptyState>
          </div>
        </div>
      </aside>

      <!-- ── Chat pane ──────────────────────────────────────────────── -->
      <section class="flex min-w-0 flex-1 flex-col">
        <template v-if="selectedConversation">
          <AdminChatHeader
            :title="getConversationName(selectedConversation)"
            :type="selectedConversation.type === 'group' ? 'group' : 'direct'"
            :subtitle="
              selectedConversation.type === 'direct'
                ? 'Direct message'
                : `${selectedConversation.participants?.length || 0} members · ${getParticipantNames(selectedConversation)}`
            "
          />

          <!-- Messages -->
          <div ref="messagesContainer" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <AdminChatThread
              v-if="loadingMessages || messages.length > 0"
              :key="selectedConversation.id"
              :messages="threadMessages"
              :loading="loadingMessages"
            />
            <EmptyState
              v-else
              size="sm"
              :icon="MessageSquare"
              title="No messages yet"
              description="Say hello to get the conversation started."
            />
          </div>

          <MessageComposer v-model="newMessage" hide-attach send-on-enter centered @send="sendMessage" />
        </template>

        <!-- No conversation selected -->
        <EmptyState
          v-else
          :icon="MessagesSquare"
          title="Select a conversation"
          description="Choose a conversation from the list or start a new one."
        >
          <Button variant="secondary" @click="showNewConversationDialog = true">
            <MessageSquarePlus />
            New conversation
          </Button>
        </EmptyState>
      </section>
    </div>

    <!-- New staff conversation -->
    <Modal
      v-model:open="showNewConversationDialog"
      title="New staff conversation"
      description="Message another admin or moderator, or start a group."
      :icon="MessageSquarePlus"
      size="md"
      body-class="flex flex-col gap-4"
    >
      <SegmentedControl
        :model-value="newConversationType"
        :options="conversationTypeOptions"
        block
        @update:model-value="setConversationType"
      />

      <Field v-if="newConversationType === 'group'" label="Group name" for="staff-group-name" required>
        <Input id="staff-group-name" v-model="newConversationName" placeholder="e.g. Moderation team" />
      </Field>

      <Field :label="newConversationType === 'direct' ? 'Recipient' : 'Participants'" required>
        <SearchField v-model="staffSearchQuery" placeholder="Search staff by name or email" size="sm" />
      </Field>

      <div class="-mx-1 -mt-2 flex min-h-[160px] flex-col gap-0.5">
        <button
          v-for="staff in filteredStaffMembers"
          :key="staff.id"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
          :class="isStaffSelected(staff.id) ? 'bg-brand-soft' : 'hover:bg-surface-hover'"
          :aria-pressed="isStaffSelected(staff.id)"
          @click="toggleStaffMember(staff.id)"
        >
          <ConversationAvatar :name="staff.name || staff.email" :src="staff.avatar_url" type="user" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-fg">{{ staff.name || staff.email }}</span>
            <span class="block truncate text-xs text-fg-subtle">
              {{ staff.is_admin ? 'Admin' : 'Moderator' }}<template v-if="staff.name"> · {{ staff.email }}</template>
            </span>
          </span>
          <span
            class="grid size-4 shrink-0 place-items-center border transition-colors"
            :class="[
              newConversationType === 'direct' ? 'rounded-full' : 'rounded',
              isStaffSelected(staff.id) ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong',
            ]"
          >
            <Check v-if="isStaffSelected(staff.id)" class="size-3" />
          </span>
        </button>

        <EmptyState
          v-if="filteredStaffMembers.length === 0"
          size="sm"
          :icon="Users"
          :title="staffSearchQuery ? 'No staff match your search' : 'No other staff members'"
        />
      </div>

      <template #footer>
        <Button variant="ghost" @click="showNewConversationDialog = false">Cancel</Button>
        <Button variant="primary" :disabled="!canCreateConversation" @click="createConversation">
          {{ newConversationType === 'direct' ? 'Start conversation' : 'Create group' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { formatDate as fmtDate, formatTime as fmtTime } from '@/utils/dateTimeUtils';
import {
  MessagesSquare,
  Plus,
  Users,
  MessageSquare,
  MessageSquarePlus,
  SquarePen,
  SearchX,
  Check,
} from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import ConversationAvatar from '@/components/messaging/ConversationAvatar.vue';
import ConversationRow from '@/components/messaging/ConversationRow.vue';
import { AdminChatHeader, AdminChatListSkeleton, AdminChatThread, type AdminChatMessage } from '@/components/admin/chat';
import MessageComposer from '@/components/messaging/MessageComposer.vue';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

const conversationTypeOptions: SegmentedOption<'direct' | 'group'>[] = [
  { label: 'Direct message', value: 'direct' },
  { label: 'Group chat', value: 'group' },
];

const conversations = ref<any[]>([]);
const selectedConversation = ref<any>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const loadingConversations = ref(false);
const loadingMessages = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

const showNewConversationDialog = ref(false);
const newConversationType = ref<'direct' | 'group'>('direct');
const newConversationName = ref('');
const selectedStaffMembers = ref<number | number[]>(0);
const staffMembers = ref<any[]>([]);

const staffMemberOptions = computed(() => 
  staffMembers.value.map(staff => ({
    label: staff.name || staff.email,
    value: staff.id
  }))
);

// ── View helpers (search, selection list, thread mapping) ───────────────
const searchQuery = ref('');
const staffSearchQuery = ref('');

const filteredConversations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return conversations.value;
  return conversations.value.filter((conv: any) => getConversationName(conv).toLowerCase().includes(query));
});

const filteredStaffMembers = computed(() => {
  const query = staffSearchQuery.value.trim().toLowerCase();
  if (!query) return staffMembers.value;
  return staffMembers.value.filter((staff: any) =>
    `${staff.name || ''} ${staff.email || ''}`.toLowerCase().includes(query)
  );
});

const isStaffSelected = (id: number) =>
  Array.isArray(selectedStaffMembers.value) ? selectedStaffMembers.value.includes(id) : selectedStaffMembers.value === id;

/** Direct messages pick one recipient (a number); groups pick several (an array). */
const toggleStaffMember = (id: number) => {
  if (newConversationType.value === 'direct') {
    selectedStaffMembers.value = id;
    return;
  }
  const current = Array.isArray(selectedStaffMembers.value) ? selectedStaffMembers.value : [];
  selectedStaffMembers.value = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
};

const setConversationType = (type: 'direct' | 'group') => {
  if (type === newConversationType.value) return;
  newConversationType.value = type;
  selectedStaffMembers.value = type === 'direct' ? 0 : [];
};

const threadMessages = computed<AdminChatMessage[]>(() =>
  messages.value.map((message: any) => ({
    id: message.id,
    content: message.content,
    time: message.inserted_at || null,
    senderId: message.sender_id,
    senderName: getSenderName(message),
    own: message.sender_id === currentUserId.value,
  }))
);

const canCreateConversation = computed(() => {
  if (newConversationType.value === 'direct') {
    return typeof selectedStaffMembers.value === 'number' && selectedStaffMembers.value > 0;
  } else {
    return newConversationName.value.trim() && Array.isArray(selectedStaffMembers.value) && selectedStaffMembers.value.length > 0;
  }
});

const loadConversations = async () => {
  loadingConversations.value = true;
  try {
    const response = await api.get('/staff/conversations');
    conversations.value = response.data.conversations || [];
  } catch (error) {
    console.error('Failed to load conversations:', error);
  } finally {
    loadingConversations.value = false;
  }
};

const loadStaffMembers = async () => {
  try {
    const response = await api.get('/admin/users');
    staffMembers.value = (response.data.users || []).filter(
      (u: any) => (u.is_admin || u.is_moderator) && u.id !== currentUserId.value
    );
  } catch (error) {
    console.error('Failed to load staff members:', error);
  }
};

const selectConversation = async (conv: any) => {
  selectedConversation.value = conv;
  messages.value = [];
  await loadMessages(conv.id);
};

const loadMessages = async (conversationId: number) => {
  loadingMessages.value = true;
  try {
    const response = await api.get(`/staff/conversations/${conversationId}/messages`);
    messages.value = response.data.messages || [];
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    loadingMessages.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConversation.value) return;
  
  try {
    const response = await api.post(
      `/staff/conversations/${selectedConversation.value.id}/messages`,
      { content: newMessage.value }
    );
    messages.value.push(response.data.message);
    newMessage.value = '';
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};

const createConversation = async () => {
  try {
    let response;
    if (newConversationType.value === 'direct') {
      response = await api.post('/staff/conversations/direct', {
        target_user_id: selectedStaffMembers.value
      });
    } else {
      response = await api.post('/staff/conversations/group', {
        name: newConversationName.value,
        participant_ids: Array.isArray(selectedStaffMembers.value) ? selectedStaffMembers.value : [selectedStaffMembers.value]
      });
    }
    
    conversations.value.unshift(response.data.conversation);
    showNewConversationDialog.value = false;
    newConversationType.value = 'direct';
    newConversationName.value = '';
    selectedStaffMembers.value = 0;
    
    selectConversation(response.data.conversation);
  } catch (error) {
    console.error('Failed to create conversation:', error);
  }
};

const getConversationName = (conv: any) => {
  if (conv.name) return conv.name;
  if (conv.type === 'direct') {
    const otherParticipant = conv.participants?.find((p: any) => p.user_id !== currentUserId.value);
    return otherParticipant?.user?.name || otherParticipant?.user?.email || 'Unknown';
  }
  return 'Group Chat';
};

const getParticipantNames = (conv: any) => {
  if (!conv.participants) return '';
  return conv.participants
    .map((p: any) => p.user?.name || p.user?.email)
    .filter(Boolean)
    .join(', ');
};

const getSenderName = (message: any) => {
  const sender = selectedConversation.value?.participants?.find(
    (p: any) => p.user_id === message.sender_id
  );
  return sender?.user?.name || sender?.user?.email || 'Unknown';
};

const formatTime = (timestamp: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return fmtDate(date);
};

const formatMessageTime = (timestamp: string) => {
  if (!timestamp) return '';
  return fmtTime(timestamp);
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

onMounted(() => {
  loadConversations();
  loadStaffMembers();
});
</script>
