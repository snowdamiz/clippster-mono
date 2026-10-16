<script setup lang="ts">
  /**
   * A single chat message: own messages are brand-tinted on the right, others
   * sit on a raised surface on the left. Handles system notes, deleted
   * messages, inline editing, image attachments and the time / edited / read
   * meta row (with edit + delete actions revealed on hover for own messages).
   *
   * Shared by the Messages page, the floating ChatWindow and (with
   * `readonly`, via AdminChatThread) the admin inboxes.
   *
   *   <MessageBubble :message="m" :is-own-message="mine" :is-editing="editingId === m.id" :edit-content="draft" @edit="…" />
   *   <MessageBubble :message="{ content, insertedAt, sender: { displayName } }" :is-own-message="own" readonly :show-status="false" />
   *
   * `message` only needs `content`; every other `Message` field is optional.
   */
  import { computed, getCurrentInstance } from 'vue';
  import { Check, CheckCheck, Pencil, Trash2 } from 'lucide-vue-next';
  import type { Message, MessageAttachment } from '@/services/messagingApi';
  import { formatTime as fmtTime } from '@/utils/dateTimeUtils';
  import { Button } from '@/components/ui/button';

  /** The parts of a `Message` the bubble renders (a full `Message` fits). */
  type BubbleMessage = Pick<Message, 'content'> &
    Partial<Pick<Message, 'messageType' | 'editedAt' | 'deletedAt' | 'readBy' | 'attachments'>> & {
      insertedAt?: string | null;
      sender?: { displayName?: string | null } | null;
    };

  const props = withDefaults(
    defineProps<{
      message: BubbleMessage;
      isOwnMessage: boolean;
      isEditing?: boolean;
      editContent?: string;
      /** Show the sender's name above other people's messages. */
      showSender?: boolean;
      /** Show Sent / Read on own messages. */
      showStatus?: boolean;
      /** Narrow layout for the floating chat window. */
      compact?: boolean;
      /** No edit / delete actions (read-only threads, e.g. admin inboxes). */
      readonly?: boolean;
    }>(),
    { isEditing: false, editContent: '', showSender: true, showStatus: true, compact: false, readonly: false }
  );

  const emit = defineEmits<{
    edit: [];
    delete: [];
    'update:editContent': [value: string];
    saveEdit: [];
    cancelEdit: [];
    openAttachment: [attachment: MessageAttachment];
  }>();

  const isDeleted = computed(() => !!props.message.deletedAt);
  const isEdited = computed(() => !!props.message.editedAt && !isDeleted.value);
  const isSystemMessage = computed(() => props.message.messageType === 'system');
  const hasText = computed(() => !!props.message.content && !!props.message.content.trim());
  const attachments = computed(() => (isDeleted.value ? [] : props.message.attachments || []));
  const isRead = computed(() => !!props.message.readBy && props.message.readBy.length > 1);
  const senderName = computed(
    () => props.message.sender?.displayName || (props.message.sender as any)?.display_name || 'Unknown'
  );

  /** Thumbnails are clickable only when the parent listens for `open-attachment`. */
  const canOpenAttachment = !!getCurrentInstance()?.vnode.props?.onOpenAttachment;

  function formatTime(dateString: string): string {
    return fmtTime(dateString);
  }
</script>

<template>
  <!-- System note -->
  <div v-if="isSystemMessage" class="flex justify-center py-1">
    <span class="rounded-full bg-surface px-2.5 py-0.5 text-2xs text-fg-subtle">{{ message.content }}</span>
  </div>

  <div v-else class="group/msg flex min-w-0 flex-col" :class="isOwnMessage ? 'items-end' : 'items-start'">
    <span v-if="!isOwnMessage && showSender && message.sender" class="mb-0.5 px-1 text-2xs font-medium text-fg-muted">
      {{ senderName }}
    </span>

    <!-- Bubble -->
    <div
      class="min-w-0 rounded-2xl text-sm leading-5 text-fg"
      :class="[
        compact ? 'max-w-[85%]' : 'max-w-[min(72%,560px)]',
        isEditing ? 'w-full max-w-[min(100%,560px)]' : '',
        isDeleted
          ? 'border border-dashed border-line px-3 py-1.5'
          : isOwnMessage
            ? 'rounded-br-md bg-[var(--brand-soft-hover)]'
            : 'rounded-bl-md border border-line-subtle bg-surface-raised',
        !isDeleted && !isEditing ? (hasText ? 'px-3 py-1.5' : 'p-1') : '',
        isEditing ? 'p-2' : '',
      ]"
    >
      <p v-if="isDeleted" class="text-xs italic text-fg-subtle">This message was deleted</p>

      <!-- Inline edit -->
      <template v-else-if="isEditing">
        <textarea
          :value="editContent"
          rows="2"
          class="block w-full resize-none rounded-md border border-line bg-surface-sunken px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-line focus:outline-none"
          @input="emit('update:editContent', ($event.target as HTMLTextAreaElement).value)"
          @keydown.enter.exact.prevent="emit('saveEdit')"
          @keydown.escape="emit('cancelEdit')"
        ></textarea>
        <div class="mt-1.5 flex items-center justify-end gap-1.5">
          <span class="mr-auto text-2xs text-fg-subtle">Enter to save · Esc to cancel</span>
          <Button variant="ghost" size="xs" @click="emit('cancelEdit')">Cancel</Button>
          <Button variant="brand" size="xs" @click="emit('saveEdit')">Save</Button>
        </div>
      </template>

      <template v-else>
        <p v-if="hasText" class="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{{ message.content }}</p>
        <div v-if="attachments.length" class="flex flex-wrap gap-1" :class="{ 'mt-1.5 -mx-1.5 mb-0.5': hasText }">
          <component
            :is="canOpenAttachment ? 'button' : 'div'"
            v-for="attachment in attachments"
            :key="attachment.id"
            :type="canOpenAttachment ? 'button' : undefined"
            class="block overflow-hidden rounded-xl bg-surface-sunken focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            :class="[compact ? 'max-w-[200px]' : 'max-w-[260px]', canOpenAttachment && 'transition-opacity hover:opacity-90']"
            :title="attachment.filename"
            @click="canOpenAttachment && emit('openAttachment', attachment)"
          >
            <img
              :src="attachment.thumbnailUrl || attachment.url"
              :alt="attachment.filename"
              loading="lazy"
              class="block max-h-[200px] w-full object-cover"
            />
          </component>
        </div>
      </template>
    </div>

    <!-- Meta row -->
    <div v-if="!isEditing" class="mt-0.5 flex items-center gap-1 px-1 text-2xs text-fg-subtle">
      <span
        v-if="isOwnMessage && !isDeleted && !readonly"
        class="mr-1 flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100"
      >
        <button
          type="button"
          class="grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
          aria-label="Edit message"
          @click="emit('edit')"
        >
          <Pencil class="size-3" />
        </button>
        <button
          type="button"
          class="grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
          aria-label="Delete message"
          @click="emit('delete')"
        >
          <Trash2 class="size-3" />
        </button>
      </span>
      <span v-if="message.insertedAt" class="tabular">{{ formatTime(message.insertedAt) }}</span>
      <span v-if="isEdited">· Edited</span>
      <span
        v-if="isOwnMessage && showStatus && !isDeleted"
        class="ml-0.5 inline-flex items-center"
        :class="isRead ? 'text-brand' : ''"
        :title="isRead ? 'Read' : 'Sent'"
        :aria-label="isRead ? 'Read' : 'Sent'"
      >
        <CheckCheck v-if="isRead" class="size-3" />
        <Check v-else class="size-3" />
      </span>
    </div>
  </div>
</template>
