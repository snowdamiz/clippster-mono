<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-b border-white/10 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">Subtitles</h3>
          <p class="mt-1 text-[10px] text-muted-foreground">
            Pick a style card to toggle subtitles for this workspace export flow.
          </p>
        </div>
        <div
          class="rounded-full border px-2 py-0.5 text-[10px] font-medium"
          :class="
            activePreset
              ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200'
              : 'border-white/10 bg-white/5 text-muted-foreground'
          "
        >
          {{ activePreset ? `Enabled: ${activePreset.name}` : 'Subtitles off' }}
        </div>
      </div>

      <p class="mt-3 text-[10px] text-muted-foreground">
        Drag subtitles in the preview to reposition them. Drag the corner handle to resize text. Nothing is added to the timeline.
      </p>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="space-y-6">
        <section v-for="group in presetGroups" :key="group.id" class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {{ group.label }}
            </h4>
            <span class="text-[10px] text-muted-foreground/60">{{ group.presets.length }}</span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="preset in group.presets"
              :key="preset.id"
              class="group overflow-hidden rounded-xl border text-left transition-all duration-150 active:scale-[0.98]"
              :class="
                activePresetId === preset.id
                  ? 'border-cyan-400/45 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
              "
              @click="togglePreset(preset.id)"
            >
              <div class="flex aspect-[4/3] items-center justify-center bg-zinc-950 px-3">
                <div class="flex items-center justify-center gap-1.5">
                  <span
                    class="select-none whitespace-nowrap leading-tight"
                    :style="preset.previewStyle"
                  >
                    {{ preset.sampleWords[0] }}
                  </span>
                  <span
                    v-if="preset.sampleWords[1]"
                    class="select-none whitespace-nowrap leading-tight"
                    :style="preset.highlightPreviewStyle"
                  >
                    {{ preset.sampleWords[1] }}
                  </span>
                </div>
              </div>

              <div class="space-y-1 px-3 py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <p
                    class="truncate text-[12px] font-medium"
                    :class="activePresetId === preset.id ? 'text-white' : 'text-zinc-200'"
                  >
                    {{ preset.name }}
                  </p>
                  <span
                    class="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                    :class="
                      activePresetId === preset.id
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'bg-white/5 text-muted-foreground'
                    "
                  >
                    {{ activePresetId === preset.id ? 'On' : 'Off' }}
                  </span>
                </div>
                <p class="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                  {{ preset.description }}
                </p>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { SubtitleSettings } from '@/types';
  import {
    WORKSPACE_SUBTITLE_PRESET_GROUPS,
    getWorkspaceSubtitlePresetById,
  } from '@/constants/workspace-subtitle-presets';

  interface Props {
    subtitleSettings?: SubtitleSettings | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    subtitleSettings: null,
  });

  const emit = defineEmits<{
    updateSubtitleSettings: [settings: SubtitleSettings | null];
  }>();

  const presetGroups = WORKSPACE_SUBTITLE_PRESET_GROUPS;
  const activePresetId = computed(() => props.subtitleSettings?.selectedPresetId ?? null);
  const activePreset = computed(() => getWorkspaceSubtitlePresetById(activePresetId.value));

  function togglePreset(presetId: string) {
    if (activePresetId.value === presetId) {
      emit('updateSubtitleSettings', null);
      return;
    }

    const preset = getWorkspaceSubtitlePresetById(presetId);
    if (!preset) return;

    emit('updateSubtitleSettings', {
      ...preset.settings,
      selectedPresetId: preset.id,
    });
  }
</script>
