<script setup lang="ts">
  /** While the AI builds the video: chat on the left, live steps and what it sees in the example on the right. */
  import { computed, ref } from 'vue';
  import ChatMessage from '@/components/create/chat/ChatMessage.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { SectionCard } from '@/components/ui/section-card';
  import { StatGrid, type StatItem } from '@/components/ui/stat-card';
  import type { AIChatMessage } from '@/types/ai-chat';
  import { formatDuration, listPhrase, plural } from '../format';
  import { useProject } from '../projectContext';
  import ExampleStrip from './ExampleStrip.vue';

  const { working, blueprint, song, policy, cancel } = useProject();

  const startedAt = new Date().toISOString();
  const exampleOpen = ref(true);

  const state = computed(() => working.value!);
  const maxSeconds = computed(() => policy.value?.max_output_seconds ?? 60);
  const exampleBlueprint = computed(() => (state.value.exampleReady ? blueprint.value : null));

  const step = computed(() => {
    const { exampleReady, sources, progress } = state.value;
    if (!exampleReady) return 0;
    if (!sources) return 1;
    if (!progress?.edited) return 2;
    return progress.checking ? 4 : 3;
  });

  const stepDetails = computed((): string[] => {
    const { sources, progress } = state.value;
    const shots = exampleBlueprint.value?.stats.shots ?? 0;
    const onBeat = exampleBlueprint.value?.stats.cutsOnBeat;
    const kinds = sources
      ? [plural(sources.videos, 'video'), plural(sources.photos, 'photo'), plural(sources.songs, 'song')].filter((part) => !part.startsWith('0 '))
      : [];
    const extras = [progress?.titles ? 'titles' : null, ...(progress?.graphics ?? []).map((label) => label.toLowerCase())].filter(
      (item): item is string => !!item
    );
    const built = listPhrase([...new Set(extras)]);
    const checked = progress?.stillsViewed ? `Looked at ${plural(progress.stillsViewed, 'still')} next to the example.` : 'Checking the timing and layout.';
    return [
      exampleBlueprint.value
        ? `Found ${plural(shots, 'shot')} in ${formatDuration(exampleBlueprint.value.duration)}.${onBeat != null ? ` Cuts land on the beat ${Math.round(onBeat * 100)}% of the time.` : ''}`
        : '',
      sources
        ? `${listPhrase(kinds)}. Found ${plural(sources.good, 'good moment')}${sources.skipped ? ` and skipped ${sources.skipped} shaky or blurry ones` : ''}.`
        : '',
      `Matching each example shot to your best moment${song.value ? ", timed to your song's beat" : ''}.`,
      built ? `${built.charAt(0).toUpperCase()}${built.slice(1)}.` : 'Cuts and camera moves matched to the example.',
      `${checked}${progress?.problemsFound ? ` Found and fixed ${plural(progress.problemsFound, 'problem')}.` : ''}`,
    ];
  });

  const exampleProgressText = computed(() => {
    const progress = state.value.exampleProgress;
    if (!progress) return '';
    return progress.progress > 0 && progress.progress < 100 ? `${progress.message} (${Math.round(progress.progress)}%)` : progress.message;
  });

  const steps = computed(() =>
    ['Watching your example', 'Watching your clips', 'Planning the edit', 'Building your video', 'Checking my work'].map((title, index) => ({
      title,
      detail: stepDetails.value[index],
      state: index < step.value ? 'done' : index === step.value ? 'active' : 'todo',
    }))
  );

  const messages = computed((): AIChatMessage[] => {
    const assistant = (id: number, content: string): AIChatMessage => ({ id, role: 'assistant', content, metadata: null, inserted_at: startedAt });
    const list: AIChatMessage[] = [
      { id: 1, role: 'user', content: state.value.request, metadata: null, inserted_at: startedAt },
      assistant(
        2,
        state.value.analyzingExample
          ? "On it. I'll watch your example first, then your clips. This takes a few minutes."
          : "On it. I'll watch your clips, then build your video. This takes a few minutes."
      ),
    ];
    const example = exampleBlueprint.value;
    if (example && example.duration > maxSeconds.value) {
      list.push(
        assistant(
          3,
          `Your example is ${formatDuration(example.duration)} and your video can be up to ${maxSeconds.value} seconds. I'll keep the same pacing and pick the best sections instead of squeezing it all in.`
        )
      );
    }
    state.value.notes.forEach((note, index) => list.push(assistant(10 + index, note)));
    return list;
  });

  const stats = computed((): StatItem[] => {
    const example = exampleBlueprint.value;
    if (!example) return [];
    const { stats: numbers, beats } = example;
    return [
      { label: 'Shots', value: numbers.shots },
      { label: 'Typical shot', value: `${numbers.medianShot.toFixed(1)}s` },
      { label: 'Beats per minute', value: beats?.bpm ? Math.round(beats.bpm) : '—' },
      { label: 'Cuts on the beat', value: numbers.cutsOnBeat != null ? `${Math.round(numbers.cutsOnBeat * 100)}%` : '—', tone: 'brand' },
    ];
  });
</script>

<template>
  <div class="mx-auto grid w-full max-w-[1100px] grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 p-6">
    <div class="flex flex-col gap-2.5">
      <ChatMessage v-for="message in messages" :key="message.id" :message="message" />
    </div>

    <div class="flex flex-col gap-4">
      <ol class="flex flex-col gap-2.5">
        <li v-for="item in steps" :key="item.title" class="flex items-start gap-2.5">
          <span
            class="mt-0.5 size-4 shrink-0 rounded-full border"
            :class="[item.state === 'todo' ? 'border-line-strong' : 'border-brand', item.state === 'done' && 'bg-brand']"
          />
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm" :class="[item.state === 'todo' ? 'text-fg-subtle' : 'text-fg', item.state === 'active' && 'font-semibold']">
              {{ item.title }}{{ item.state === 'active' ? '...' : '' }}
            </span>
            <span v-if="item.state === 'done'" class="text-xs text-fg-muted">{{ item.detail }}</span>
            <span v-else-if="item.state === 'active' && item.title === 'Watching your example' && exampleProgressText" class="text-xs text-fg-subtle">
              {{ exampleProgressText }}
            </span>
          </div>
        </li>
      </ol>

      <SectionCard v-if="exampleBlueprint" title="Here's what I see in your example" :body-class="exampleOpen ? 'px-4 py-3' : 'hidden'">
        <template #actions>
          <button type="button" class="text-xs text-fg-subtle hover:text-fg" @click="exampleOpen = !exampleOpen">
            {{ exampleOpen ? 'tap to hide' : 'tap to show' }}
          </button>
        </template>
        <div class="flex flex-col gap-3.5">
          <StatGrid size="sm" :items="stats" />
          <ExampleStrip :blueprint="exampleBlueprint" />
          <div v-if="exampleBlueprint.techniques?.length" class="flex flex-wrap gap-1.5">
            <Badge v-for="technique in exampleBlueprint.techniques" :key="technique" size="md">{{ technique }}</Badge>
          </div>
          <p class="text-xs text-fg-subtle">Something wrong? Just tell me, for example "the intro is 3 shots, not 2".</p>
        </div>
      </SectionCard>

      <div class="flex gap-2">
        <Button variant="ghost" @click="cancel()">Cancel</Button>
      </div>
    </div>
  </div>
</template>
