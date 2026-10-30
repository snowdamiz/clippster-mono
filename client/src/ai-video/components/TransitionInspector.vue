<script setup lang="ts">
  import { computed } from 'vue';
  import { SHOT_TRANSITIONS, type EditDocument, type ShotTransition } from '../types';
  const props = defineProps<{ document: EditDocument; selected: string | null }>();
  const emit = defineEmits<{ apply: [document: EditDocument] }>();
  const shot = computed(() => props.document.shots.find((shot) => `transition:${shot.id}` === props.selected));
  function change(transitionIn: ShotTransition) {
    emit('apply', {
      ...props.document,
      shots: props.document.shots.map((item) => (item === shot.value ? { ...item, transitionIn } : item)),
    });
  }
</script>
<template>
  <div v-if="shot" class="flex flex-col gap-3">
    <span class="text-sm font-semibold text-fg">Transition</span>
    <label class="flex flex-col gap-1 text-xs text-fg-muted">
      Incoming transition
      <select
        aria-label="Incoming transition"
        class="h-8 rounded-md border border-line bg-surface px-2 text-fg"
        :value="shot.transitionIn"
        @change="change(($event.target as HTMLSelectElement).value as ShotTransition)"
      >
        <option v-for="transition in SHOT_TRANSITIONS" :key="transition" :value="transition">{{ transition }}</option>
      </select>
    </label>
    <p class="text-xs text-fg-subtle">
      Applies at the start of {{ shot.scene?.label || shot.description }}. Choose cut to remove the transition.
    </p>
  </div>
</template>
