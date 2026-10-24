<script setup lang="ts">
  /**
   * The session chat. Before the first build it is the free planning chat (the AI asks what's
   * missing and keeps a plan); while a build runs it narrates; afterwards each message is a paid change.
   */
  import { computed, nextTick, ref, watch } from 'vue';
  import { Sparkles } from 'lucide-vue-next';
  import ChatChip from '@/components/create/chat/ChatChip.vue';
  import ChatComposer from '@/components/create/chat/ChatComposer.vue';
  import ChatMessage from '@/components/create/chat/ChatMessage.vue';
  import ChatStatusCard from '@/components/create/chat/ChatStatusCard.vue';
  import ChatTypingIndicator from '@/components/create/chat/ChatTypingIndicator.vue';
  import { Button } from '@/components/ui/button';
  import type { AIChatMessage } from '@/types/ai-chat';
  import { formatDuration } from '../format';
  import { useProject } from '../projectContext';
  import VideoPlanCard from './VideoPlanCard.vue';

  const {
    session,
    document,
    media,
    clips,
    song,
    hasExample,
    aspect,
    blueprint,
    plan,
    hasPlanChat,
    planPending,
    planDraft,
    pendingMessage,
    running,
    working,
    analysis,
    policy,
    canBuild,
    goCost,
    ...project
  } = useProject();

  const thread = ref<HTMLElement | null>(null);
  const changeDraft = ref('');
  const startedAt = new Date().toISOString();

  const maxSeconds = computed(() => policy.value?.max_output_seconds ?? 60);
  const busy = computed(() => !!running.value || !!planPending.value);
  const composerText = computed({
    get: () => (document.value ? changeDraft.value : planDraft.value),
    set: (value: string) => (document.value ? (changeDraft.value = value) : (planDraft.value = value)),
  });

  /** Opens every chat, like the image creator's first message. Not sent to the AI. */
  const greeting = computed(() => {
    const length = `Videos can be up to ${maxSeconds.value} seconds.`;
    if (hasExample.value)
      return `What's your video about? I'll copy how your example is edited and plan the scenes with you before anything is built. ${length}`;
    if (clips.value.length)
      return `What should this video do? I'll look through your clips and plan the edit with you before anything is built. ${length}`;
    return `What's the video for, and what should it say? I'll ask only what I need, then show you a scene-by-scene plan. You can add an example in Sources & setup for me to copy. ${length}`;
  });

  const messages = computed((): AIChatMessage[] => {
    const message = (id: number, role: AIChatMessage['role'], content: string): AIChatMessage => ({
      id,
      role,
      content,
      metadata: null,
      inserted_at: startedAt,
    });
    const list: AIChatMessage[] = [message(0, 'assistant', greeting.value), ...(session.value?.messages ?? [])];
    const pending = planPending.value ?? pendingMessage.value;
    if (pending) list.push(message(-1, 'user', pending));

    const build = working.value;
    if (build) {
      list.push(message(-2, 'user', build.request));
      list.push(
        message(
          -3,
          'assistant',
          build.analyzingExample
            ? `On it. I'll watch your example first${media.value.length ? ', then your clips' : ''}. This takes a few minutes.`
            : media.value.length
              ? "On it. I'll watch your clips, then build your video. This takes a few minutes."
              : "On it. I'll design your video. This takes a few minutes."
        )
      );
      const example = blueprint.value;
      if (build.exampleReady && example && example.duration > maxSeconds.value) {
        list.push(
          message(
            -4,
            'assistant',
            `Your example is ${formatDuration(example.duration)} and your video can be up to ${maxSeconds.value} seconds. I'll keep the same pacing and pick the best sections instead of squeezing it all in.`
          )
        );
      }
      build.notes.forEach((note, index) => list.push(message(-10 - index, 'assistant', note)));
    }
    return list;
  });
  /** Only the newest plan gets a card; earlier versions are just messages. */
  const planMessageId = computed(
    () => [...messages.value].reverse().find((message) => message.metadata?.plan)?.id ?? null
  );
  const shape = computed(() => (blueprint.value ? "the example's shape" : aspect.value));

  const waitingFor = computed(() => {
    const example = analysis.example;
    if (example)
      return example.progress > 0 && example.progress < 100
        ? `${example.message} (${Math.round(example.progress)}%)...`
        : `${example.message}...`;
    const clipsProgress = analysis.clips;
    if (clipsProgress)
      return `Looking through your clips (${Math.min(clipsProgress.done + 1, clipsProgress.total)} of ${clipsProgress.total})...`;
    return 'Thinking...';
  });

  const suggestions = computed(() => {
    const title = document.value?.overlays.find((overlay) => overlay.lane === 'text');
    return [
      'Make the intro faster',
      title ? `Change "${title.label}" to something punchier` : 'Add a bold title at the start',
      song.value ? 'Make the cuts hit the beat harder' : 'Use a different shot before the ending',
    ];
  });

  const placeholder = computed(() => {
    if (document.value) return 'Tell it what to change…';
    if (!hasPlanChat.value) return 'Describe your video…';
    return plan.value ? 'Ask for any change to the plan…' : 'Answer, or tell it more about your video…';
  });

  const note = computed(() => {
    const credits = policy.value?.credits;
    if (!credits) return '';
    return document.value
      ? `Changes use ${credits.revise} credits each`
      : `Planning is free · building uses ${goCost.value ?? credits.generate} credits`;
  });

  function send(text: string) {
    const message = text.trim();
    if (!message || busy.value) return;
    if (document.value) {
      changeDraft.value = '';
      void project.revise(message);
    } else {
      void project.sendPlan(message);
    }
  }

  watch(
    () => [messages.value.length, busy.value],
    () => nextTick(() => thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: 'smooth' })),
    { immediate: true }
  );
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex h-9 shrink-0 items-center gap-1.5 border-b border-line-subtle px-4 text-xs text-fg-muted">
      <Sparkles class="size-3.5 shrink-0 text-ai" />
      <span class="truncate">{{ note }}</span>
    </div>

    <div ref="thread" class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-3">
      <template v-for="message in messages" :key="message.id">
        <ChatMessage :message="message" />
        <VideoPlanCard v-if="message.id === planMessageId && plan" :plan="plan" :media="media" :shape="shape" />
      </template>
      <ChatTypingIndicator v-if="planPending" :label="waitingFor" />
      <div v-else-if="running === 'revise'" class="flex items-center gap-2">
        <ChatTypingIndicator label="Working on it..." />
        <Button variant="link" size="xs" @click="project.cancel()">Cancel</Button>
      </div>
      <ChatStatusCard
        v-else-if="running === 'generate'"
        class="mt-1"
        title="Building your video"
        description="Follow along on the right."
      />
    </div>

    <div class="flex shrink-0 flex-col gap-2 border-t border-line-subtle p-3">
      <Button v-if="!document" variant="primary" block :disabled="!canBuild" @click="project.build()">
        <Sparkles />
        {{ plan ? 'Build this video' : 'Just build it' }}
        <template v-if="goCost !== null">· {{ goCost }} credits</template>
      </Button>
      <details v-else class="text-xs text-fg-subtle">
        <summary class="cursor-pointer">Suggested changes</summary>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <ChatChip
            v-for="suggestion in suggestions"
            :key="suggestion"
            :label="suggestion"
            interactive
            :disabled="busy"
            @click="send(suggestion)"
          />
        </div>
      </details>
      <ChatComposer
        v-model="composerText"
        :placeholder="placeholder"
        :disabled="!!running"
        :can-send="!busy"
        :sending="busy"
        @send="send"
      />
    </div>
  </div>
</template>
