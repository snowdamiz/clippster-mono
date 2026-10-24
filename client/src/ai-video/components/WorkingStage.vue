<script setup lang="ts">
  /** While the AI builds the video: live steps and what it sees in the example, if any. The chat narrates alongside. */
  import { computed, ref } from 'vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { SectionCard } from '@/components/ui/section-card';
  import { StatGrid, type StatItem } from '@/components/ui/stat-card';
  import { formatDuration, listPhrase, plural } from '../format';
  import { useProject } from '../projectContext';
  import ExampleStrip from './ExampleStrip.vue';

  const { working, analysis, blueprint, media, song, cancel } = useProject();

  const exampleOpen = ref(true);

  const state = computed(() => working.value!);
  const withExample = computed(() => state.value.analyzingExample || !!blueprint.value);
  const exampleBlueprint = computed(() => (state.value.exampleReady ? blueprint.value : null));

  const exampleProgressText = computed(() => {
    const progress = analysis.example;
    if (!progress) return '';
    return progress.progress > 0 && progress.progress < 100
      ? `${progress.message} (${Math.round(progress.progress)}%)`
      : progress.message;
  });

  /** The run's steps in order; the first unfinished one is active. Example and clip steps only appear when there is one. */
  const steps = computed(() => {
    const { exampleReady, sources, progress } = state.value;
    const example = exampleBlueprint.value;
    const list: Array<{ title: string; done: boolean; detail: string; progress?: string }> = [];

    if (withExample.value) {
      const onBeat = example?.stats.cutsOnBeat;
      list.push({
        title: 'Watching your example',
        done: exampleReady,
        detail: example
          ? `Found ${plural(example.stats.shots, 'shot')} in ${formatDuration(example.duration)}.${onBeat != null ? ` Cuts land on the beat ${Math.round(onBeat * 100)}% of the time.` : ''}`
          : '',
        progress: exampleProgressText.value,
      });
    }
    if (media.value.length) {
      const kinds = sources
        ? [plural(sources.videos, 'video'), plural(sources.photos, 'photo'), plural(sources.songs, 'song')].filter(
            (part) => !part.startsWith('0 ')
          )
        : [];
      list.push({
        title: 'Watching your clips',
        done: !!sources,
        detail: sources
          ? `${listPhrase(kinds)}. Found ${plural(sources.good, 'good moment')}${sources.skipped ? ` and skipped ${sources.skipped} shaky or blurry ones` : ''}.`
          : '',
      });
    }

    const beat = song.value ? ", timed to your song's beat" : '';
    list.push({
      title: 'Planning the edit',
      done: !!progress?.edited,
      detail: withExample.value
        ? `Matching each example shot to your best moment${beat}.`
        : `Laying out the scenes and pacing from your description${beat}.`,
    });

    const extras = [
      progress?.scenes ? plural(progress.scenes, 'designed scene') : null,
      progress?.titles ? 'titles' : null,
      ...(progress?.graphics ?? []).map((label) => label.toLowerCase()),
    ].filter((item): item is string => !!item);
    const built = listPhrase([...new Set(extras)]);
    list.push({
      title: 'Building your video',
      done: !!progress?.checking,
      detail: built ? `${built.charAt(0).toUpperCase()}${built.slice(1)}.` : 'Cuts, motion and graphics in place.',
    });

    const looked = progress?.stillsViewed
      ? `Looked at ${plural(progress.stillsViewed, 'still')}${withExample.value ? ' next to the example' : ''}.`
      : 'Checking the timing and layout.';
    list.push({
      title: 'Checking my work',
      done: false,
      detail: `${looked}${progress?.problemsFound ? ` Found and fixed ${plural(progress.problemsFound, 'problem')}.` : ''}`,
    });

    const active = list.findIndex((item) => !item.done);
    return list.map((item, index) => ({
      ...item,
      state: index < active ? 'done' : index === active ? 'active' : 'todo',
    }));
  });

  const stats = computed((): StatItem[] => {
    const example = exampleBlueprint.value;
    if (!example) return [];
    const { stats: numbers, beats } = example;
    return [
      { label: 'Shots', value: numbers.shots },
      { label: 'Typical shot', value: `${numbers.medianShot.toFixed(1)}s` },
      { label: 'Beats per minute', value: beats?.bpm ? Math.round(beats.bpm) : '—' },
      {
        label: 'Cuts on the beat',
        value: numbers.cutsOnBeat != null ? `${Math.round(numbers.cutsOnBeat * 100)}%` : '—',
        tone: 'brand',
      },
    ];
  });
</script>

<template>
  <div class="mx-auto flex w-full max-w-[720px] flex-col gap-5 p-6">
    <div class="flex flex-col gap-4">
      <ol class="flex flex-col gap-2.5">
        <li v-for="item in steps" :key="item.title" class="flex items-start gap-2.5">
          <span
            class="mt-0.5 size-4 shrink-0 rounded-full border"
            :class="[
              item.state === 'todo' ? 'border-line-strong' : 'border-brand',
              item.state === 'done' && 'bg-brand',
            ]"
          />
          <div class="flex min-w-0 flex-col gap-0.5">
            <span
              class="text-sm"
              :class="[
                item.state === 'todo' ? 'text-fg-subtle' : 'text-fg',
                item.state === 'active' && 'font-semibold',
              ]"
            >
              {{ item.title }}{{ item.state === 'active' ? '...' : '' }}
            </span>
            <span v-if="item.state === 'done'" class="text-xs text-fg-muted">{{ item.detail }}</span>
            <span v-else-if="item.state === 'active' && item.progress" class="text-xs text-fg-subtle">
              {{ item.progress }}
            </span>
          </div>
        </li>
      </ol>

      <SectionCard
        v-if="exampleBlueprint"
        title="Here's what I see in your example"
        :body-class="exampleOpen ? 'px-4 py-3' : 'hidden'"
      >
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
          <p class="text-xs text-fg-subtle">
            Something wrong? Just tell me, for example "the intro is 3 shots, not 2".
          </p>
        </div>
      </SectionCard>

      <div class="flex gap-2">
        <Button variant="ghost" @click="cancel()">Cancel</Button>
      </div>
    </div>
  </div>
</template>
