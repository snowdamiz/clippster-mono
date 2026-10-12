<script setup lang="ts">
  /**
   * Message composer for the AI chat panels (AI Video, AI Thumbnail, AI Image):
   * an auto-growing textarea above a tool row — attach / reference buttons go
   * in `#tools`, the send button sits on the right. Enter sends, Shift+Enter
   * adds a new line.
   *
   *   <ChatComposer v-model="draft" placeholder="Describe…" :can-send="!busy" @send="send">
   *     <template #tools><Button variant="ghost" size="icon-sm" title="Attach"><Paperclip /></Button></template>
   *   </ChatComposer>
   */
  import { computed, nextTick, onMounted, ref, watch } from 'vue';
  import { Loader2, Send } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      placeholder?: string;
      /** Disables typing and sending. */
      disabled?: boolean;
      /** Extra gate for the send button (e.g. while a reply is pending). */
      canSend?: boolean;
      /** Shows a spinner in the send button. */
      sending?: boolean;
      maxHeight?: number;
    }>(),
    { placeholder: 'Message…', disabled: false, canSend: true, sending: false, maxHeight: 140 }
  );

  const emit = defineEmits<{ 'update:modelValue': [value: string]; send: [value: string] }>();

  const textarea = ref<HTMLTextAreaElement | null>(null);

  const sendEnabled = computed(() => !props.disabled && props.canSend && !!props.modelValue.trim());

  function resize() {
    const el = textarea.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, props.maxHeight)}px`;
  }

  function onInput(event: Event) {
    emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
    resize();
  }

  function send() {
    if (!sendEnabled.value) return;
    emit('send', props.modelValue.trim());
  }

  watch(
    () => props.modelValue,
    () => nextTick(resize)
  );
  onMounted(resize);

  defineExpose({ focus: () => textarea.value?.focus() });
</script>

<template>
  <div
    class="rounded-xl border border-line bg-surface-raised transition-[border-color,box-shadow] focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
    :class="disabled && 'opacity-60'"
  >
    <textarea
      ref="textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="1"
      class="block max-h-[var(--composer-max)] min-h-9 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none disabled:cursor-not-allowed"
      :style="{ '--composer-max': `${maxHeight}px` }"
      @input="onInput"
      @keydown.enter.exact.prevent="send"
    />
    <div class="flex items-center gap-0.5 px-1.5 pb-1.5">
      <slot name="tools" />
      <Button
        :variant="sendEnabled || sending ? 'brand' : 'subtle'"
        size="icon-sm"
        class="ml-auto"
        title="Send"
        aria-label="Send message"
        :disabled="!sendEnabled"
        @click="send"
      >
        <Loader2 v-if="sending" class="animate-spin" />
        <Send v-else />
      </Button>
    </div>
  </div>
</template>
