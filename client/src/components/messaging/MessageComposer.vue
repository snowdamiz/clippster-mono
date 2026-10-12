<script setup lang="ts">
  /**
   * Message composer: pending image attachments, attach button, auto-growing
   * textarea and send button. The parent owns the text (v-model), the
   * attachment list and all sending logic; this component only renders and
   * forwards events (`keydown`, `input`, `paste`, `attach`, `send`,
   * `remove-attachment`). Shared by the Messages page, ChatWindow and the
   * admin inboxes (Staff messages, Customer service).
   *
   *   <MessageComposer v-model="draft" :attachments="previews" @keydown="onKey" @attach="pick" @send="send" />
   *   <MessageComposer v-model="draft" hide-attach send-on-enter centered @send="send" />   (text-only)
   *
   * `send-on-enter` sends on Enter (Shift+Enter = new line) without the
   * parent handling `keydown`; `centered` keeps the input in the same 860px
   * column as a centered thread.
   */
  import { computed, nextTick, ref, watch } from 'vue';
  import { Loader2, Paperclip, SendHorizontal, X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      attachments?: { url: string; name: string; size?: string }[];
      uploading?: boolean;
      placeholder?: string;
      /** Tighter padding for the floating chat window. */
      compact?: boolean;
      /** Text-only: no attach button. */
      hideAttach?: boolean;
      disabled?: boolean;
      /** Enter sends, Shift+Enter adds a new line. */
      sendOnEnter?: boolean;
      /** Constrain the input to the centered 860px thread column. */
      centered?: boolean;
    }>(),
    {
      attachments: () => [],
      uploading: false,
      placeholder: 'Write a message…',
      compact: false,
      hideAttach: false,
      disabled: false,
      sendOnEnter: false,
      centered: false,
    }
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string];
    keydown: [event: KeyboardEvent];
    input: [event: Event];
    paste: [event: ClipboardEvent];
    attach: [];
    send: [];
    removeAttachment: [index: number];
  }>();

  const textarea = ref<HTMLTextAreaElement | null>(null);

  function resize() {
    const el = textarea.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  const canSend = computed(
    () => !props.disabled && !props.uploading && (!!props.modelValue.trim() || props.attachments.length > 0)
  );

  function onInput(event: Event) {
    emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
    emit('input', event);
    resize();
  }

  function onKeydown(event: KeyboardEvent) {
    emit('keydown', event);
    if (props.sendOnEnter && event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (canSend.value) emit('send');
    }
  }

  watch(
    () => props.modelValue,
    () => nextTick(resize)
  );

  defineExpose({ focus: () => textarea.value?.focus() });
</script>

<template>
  <div class="shrink-0 border-t border-line-subtle" :class="compact ? 'p-2' : 'px-4 py-3'">
    <!-- Pending attachments -->
    <div v-if="attachments.length > 0" class="mb-2 flex flex-wrap gap-2">
      <div
        v-for="(preview, index) in attachments"
        :key="index"
        class="group relative overflow-hidden rounded-lg border border-line bg-surface-sunken"
        :class="compact ? 'size-12' : 'size-14'"
        :title="preview.size ? `${preview.name} · ${preview.size}` : preview.name"
      >
        <img :src="preview.url" :alt="preview.name" class="size-full object-cover" />
        <button
          type="button"
          class="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-[var(--overlay)] text-fg opacity-0 transition-opacity hover:bg-canvas group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Remove attachment"
          @click="emit('removeAttachment', index)"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>

    <div
      class="flex items-end gap-1 rounded-xl border border-line bg-surface-raised p-1 transition-[border-color,box-shadow] focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
      :class="[hideAttach && 'pl-2', centered && 'mx-auto max-w-[860px]']"
    >
      <Button
        v-if="!hideAttach"
        variant="ghost"
        size="icon-sm"
        aria-label="Attach image"
        title="Attach image"
        :disabled="uploading"
        @click="emit('attach')"
      >
        <Paperclip />
      </Button>
      <textarea
        ref="textarea"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        rows="1"
        class="max-h-32 min-h-[var(--control-sm)] flex-1 resize-none self-center bg-transparent px-1 py-1 text-sm leading-5 text-fg placeholder:text-fg-subtle focus:outline-none disabled:opacity-50"
        @input="onInput"
        @keydown="onKeydown"
        @paste="emit('paste', $event)"
      ></textarea>
      <Button
        variant="brand"
        size="icon-sm"
        aria-label="Send message"
        title="Send"
        :disabled="!canSend"
        @click="emit('send')"
      >
        <Loader2 v-if="uploading" class="animate-spin" />
        <SendHorizontal v-else />
      </Button>
    </div>
  </div>
</template>
