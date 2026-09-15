<script setup lang="ts">
  import { computed } from 'vue';
  import { Sparkles } from 'lucide-vue-next';
  import { useEditor } from '../../../composables/useEditor';
  import type { ImageElement, VideoElement } from '../../../types/timeline';
  import { ReplaceTemplateSlotMediaCommand } from '../../../templates/replace-slot-command';

  const props = defineProps<{
    element: VideoElement | ImageElement;
    trackId: string;
  }>();
  const { editor, version } = useEditor({
    subscribe: { media: true, project: true, timeline: true, playback: false, scenes: false, selection: false },
  });
  const media = computed(() => {
    void version.value;
    const requiredSeconds =
      props.element.trimStart + props.element.duration * ('speed' in props.element ? (props.element.speed ?? 1) : 1);
    return editor.media
      .getAssets()
      .filter(
        (asset) =>
          !asset.ephemeral &&
          asset.type === props.element.type &&
          (asset.duration == null || asset.duration >= requiredSeconds)
      );
  });

  function replace(mediaId: string) {
    if (!props.element.templateSlotId) return;
    const asset = media.value.find((item) => item.id === mediaId);
    if (!asset) return;
    const fingerprint = `${asset.id}:${asset.file.size}:${asset.file.lastModified}`;
    editor.command.execute({
      command: new ReplaceTemplateSlotMediaCommand(
        props.trackId,
        props.element.id,
        props.element.templateSlotId,
        asset.id,
        fingerprint
      ),
    });
  }
</script>

<template>
  <div v-if="element.templateSlotId" class="border-b border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
    <div class="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-fuchsia-200">
      <Sparkles class="size-3.5" />
      Instant Edit slot
    </div>
    <p class="mb-2 text-[10px] text-zinc-500">{{ element.templateSlotId }}</p>
    <label class="block text-[10px] text-zinc-400">
      Replace slot media
      <select
        class="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200"
        :value="'mediaId' in element ? element.mediaId : ''"
        :aria-label="`Replace Instant Edit slot ${element.templateSlotId}`"
        @change="replace(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="asset in media" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
      </select>
    </label>
  </div>
</template>
