<script setup lang="ts">
  import {
    BUILT_IN_VIDEO_TEMPLATES,
    templatePreviewLook,
    type TemplateBinding,
    type TemplateManifest,
  } from '@clippster/template-schema';
  import { computed, onUnmounted, ref } from 'vue';
  import { Check, Loader2, Lock, RefreshCw, Unlock } from 'lucide-vue-next';
  import { useEditor } from '../../../composables/useEditor';
  import { useExportDialog } from '../../../composables/useExportDialog';
  import PanelSearchBar from './PanelSearchBar.vue';
  import TemplatePreview from './TemplatePreview.vue';
  import {
    commitTemplateDraft,
    mediaAssetsToCandidates,
    prepareTemplateDraft,
    type PreparedTemplateDraft,
  } from '../../../templates/service';
  import {
    discardTemplatePreview,
    paintTemplatePreview,
  } from '../../../templates/preview-session';
  import { extractTemplateDraft, loadLocalTemplateDrafts, saveLocalTemplateDraft } from '../../../templates/authoring';

  const { editor, version } = useEditor({
    subscribe: { project: true, media: true, timeline: true, playback: false, scenes: false, selection: false },
  });
  const { openExportDialog } = useExportDialog();
  const search = ref('');
  const category = ref('All');
  const selected = ref<TemplateManifest | null>(null);
  const draft = ref<PreparedTemplateDraft | null>(null);
  const lockedBindings = ref<TemplateBinding[]>([]);
  const preparing = ref(false);
  const applying = ref(false);
  const error = ref('');
  const announcement = ref('');
  const seed = ref(1);
  const localTemplates = ref(loadLocalTemplateDrafts());
  let prepareGeneration = 0;
  const allTemplates = computed(() => [...localTemplates.value, ...BUILT_IN_VIDEO_TEMPLATES]);

  const categories = computed(() => ['All', ...new Set(allTemplates.value.flatMap((template) => template.categories))]);
  const templates = computed(() => {
    const query = search.value.trim().toLowerCase();
    return allTemplates.value.filter(
      (template) =>
        (category.value === 'All' || template.categories.includes(category.value)) &&
        (!query ||
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.tags.some((tag) => tag.includes(query)))
    );
  });

  function saveCurrentAsTemplate() {
    const name = window.prompt('Template name');
    if (!name?.trim()) return;
    try {
      const manifest = extractTemplateDraft(editor, { name });
      saveLocalTemplateDraft(manifest);
      localTemplates.value = loadLocalTemplateDrafts();
      announcement.value = `${manifest.name} saved as a private template draft.`;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    }
  }
  const media = computed(() => {
    void version.value;
    return editor.media.getAssets().filter((asset) => !asset.ephemeral && asset.type !== 'audio');
  });
  const hasTimelineContent = computed(() => {
    void version.value;
    return editor.timeline.getTracks().some((track) => track.elements.length > 0);
  });
  const previewShots = computed(() =>
    (draft.value?.assignment.bindings ?? []).slice(0, 6).map((binding) => ({
      binding,
      asset: media.value.find((asset) => asset.id === binding.assetId),
    }))
  );
  const selectedLook = computed(() => (selected.value ? templatePreviewLook(selected.value) : null));
  const galleryItems = computed(() =>
    templates.value.map((template) => ({ template, look: templatePreviewLook(template) })),
  );

  function bindingFor(slotId: string): TemplateBinding | undefined {
    return draft.value?.assignment.bindings.find((binding) => binding.slotId === slotId);
  }

  async function prepare(manifest: TemplateManifest, regenerate = false) {
    const generation = ++prepareGeneration;
    selected.value = manifest;
    preparing.value = true;
    error.value = '';
    if (regenerate) seed.value += 1;
    try {
      const prepared = await prepareTemplateDraft({
        editor,
        manifest,
        seed: seed.value,
        lockedBindings: lockedBindings.value,
      });
      if (generation !== prepareGeneration) return;
      draft.value = prepared;
      paintTemplatePreview(editor, prepared);
      announcement.value = `Previewing ${manifest.name} with ${draft.value.assignment.bindings.length} filled slots. Apply to keep it.`;
    } catch (cause) {
      if (generation !== prepareGeneration) return;
      error.value = cause instanceof Error ? cause.message : String(cause);
      announcement.value = error.value;
      if (draft.value) paintTemplatePreview(editor, draft.value);
      else discardTemplatePreview(editor);
    } finally {
      if (generation === prepareGeneration) preparing.value = false;
    }
  }

  function returnToGallery() {
    prepareGeneration += 1;
    preparing.value = false;
    discardTemplatePreview(editor);
    selected.value = null;
    draft.value = null;
    lockedBindings.value = [];
  }

  onUnmounted(() => {
    prepareGeneration += 1;
    discardTemplatePreview(editor);
  });

  async function chooseSlotMedia(slotId: string, assetId: string) {
    const manifest = selected.value;
    const asset = media.value.find((item) => item.id === assetId);
    if (!manifest || !asset) return;
    const candidate = mediaAssetsToCandidates([asset])[0];
    const slot = manifest.slots.find((item) => item.id === slotId);
    if (!candidate || !slot) return;
    const duration = Math.min(candidate.durationMs, (slot.targetDuration.value * 1000) / slot.targetDuration.timescale);
    const manual: TemplateBinding = {
      slotId,
      assetId,
      sourceFingerprint: candidate.sourceFingerprint,
      sourceStartMs: 0,
      sourceEndMs: Math.max(1, duration),
      score: 1,
      reasonCodes: ['creator-selected'],
      locked: true,
    };
    lockedBindings.value = [...lockedBindings.value.filter((binding) => binding.slotId !== slotId), manual];
    await prepare(manifest);
  }

  async function toggleLock(slotId: string) {
    const existing = lockedBindings.value.find((binding) => binding.slotId === slotId);
    if (existing) lockedBindings.value = lockedBindings.value.filter((binding) => binding.slotId !== slotId);
    else {
      const binding = bindingFor(slotId);
      if (binding) lockedBindings.value = [...lockedBindings.value, { ...binding, locked: true }];
    }
    if (selected.value) await prepare(selected.value);
  }

  function applyDraft(quickExport = false) {
    if (!draft.value) return;
    if (
      hasTimelineContent.value &&
      !window.confirm(
        'Keep this Instant Edit on the timeline? You can undo the applied version as one step.'
      )
    ) {
      return;
    }
    applying.value = true;
    try {
      commitTemplateDraft(editor, draft.value);
      announcement.value = `${draft.value.manifest.name} applied. Every shot is now editable on the timeline.`;
      if (quickExport) openExportDialog();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      applying.value = false;
    }
  }
</script>

<template>
  <div class="flex h-full flex-col" aria-label="Instant Edit video templates">
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <PanelSearchBar v-model="search" placeholder="Search templates...">
      <button
        type="button"
        class="shrink-0 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
        @click="saveCurrentAsTemplate"
      >
        Save
      </button>
    </PanelSearchBar>
    <div class="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5" aria-label="Template categories">
      <button
        v-for="item in categories"
        :key="item"
        type="button"
        :aria-pressed="category === item"
        :class="[
          'whitespace-nowrap rounded px-2 py-0.5 text-[10px]',
          category === item ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
        ]"
        @click="category = item"
      >
        {{ item }}
      </button>
    </div>

    <div v-if="!selected" class="flex-1 overflow-y-auto p-2">
      <div v-if="galleryItems.length === 0" class="flex h-full items-center justify-center">
        <p class="text-xs text-zinc-500">No templates found</p>
      </div>
      <div v-else class="grid grid-cols-2 gap-1.5">
        <button
          v-for="{ template, look } in galleryItems"
          :key="template.versionId"
          type="button"
          class="group relative overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-950 text-left transition-colors hover:border-white/15"
          :aria-label="`${template.name}. ${look.actionLabel}`"
          @click="prepare(template)"
        >
          <TemplatePreview :manifest="template" />
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6">
            <p class="text-[10px] font-medium leading-tight text-zinc-200 group-hover:text-white">
              {{ template.name }}
            </p>
            <p class="mt-0.5 truncate text-[9px] text-zinc-500">
              {{ look.actionLabel }}
            </p>
          </div>
        </button>
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center gap-2 border-b border-white/10 px-2 py-1.5">
        <button type="button" class="text-xs text-zinc-400 hover:text-zinc-200" @click="returnToGallery">
          Back
        </button>
        <span class="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{{ selected.name }}</span>
        <button
          type="button"
          class="rounded p-1 text-zinc-400 hover:bg-white/5"
          aria-label="Regenerate unlocked slots"
          :disabled="preparing"
          @click="prepare(selected, true)"
        >
          <RefreshCw :class="['size-3.5', preparing && 'animate-spin']" />
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <div class="relative mb-2 overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-950">
          <div v-if="previewShots.length" class="grid aspect-video grid-cols-3 grid-rows-2 gap-px bg-black" aria-label="Personalized template storyboard">
            <div
              v-for="{ binding, asset } in previewShots"
              :key="binding.slotId"
              class="relative overflow-hidden bg-zinc-900"
            >
              <img
                v-if="asset?.thumbnailUrl"
                :src="asset.thumbnailUrl"
                alt=""
                class="size-full object-cover opacity-75"
              />
              <span class="absolute inset-x-1 bottom-1 truncate text-[8px] text-white drop-shadow">
                {{ Math.round(binding.sourceStartMs / 100) / 10 }}s
              </span>
            </div>
          </div>
          <TemplatePreview v-else :manifest="selected" featured />
          <Loader2
            v-if="preparing"
            class="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-white"
          />
        </div>
        <p class="mb-1 text-[11px] text-zinc-300">{{ selected.description }}</p>
        <p v-if="selectedLook" class="mb-2 text-[10px] text-zinc-500">
          {{ selectedLook.actionLabel }} · {{ selectedLook.transitionLabel }} ·
          {{ selectedLook.motionLabel }} · {{ selectedLook.effectLabel }}
        </p>
        <p v-if="media.length === 0" class="rounded bg-amber-500/10 p-2 text-[10px] text-amber-300">
          Import project media before filling this template.
        </p>
        <p v-if="error" role="alert" class="mb-2 rounded bg-red-500/10 p-2 text-[10px] text-red-300">{{ error }}</p>
        <p v-for="warning in draft?.assignment.warnings ?? []" :key="warning" class="mb-1 text-[10px] text-amber-300">
          {{ warning }}
        </p>
        <ul class="space-y-1.5" aria-label="Template slots">
          <li v-for="slot in selected.slots" :key="slot.id" class="rounded-lg border border-white/[0.06] bg-zinc-950 p-2">
            <div class="mb-1 flex items-center gap-1">
              <Check v-if="bindingFor(slot.id)" class="size-3 text-emerald-400" />
              <span class="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                {{ slot.label }}
                <span v-if="slot.required" class="text-red-300">*</span>
              </span>
              <button
                type="button"
                class="p-0.5 text-zinc-400"
                :aria-label="`${lockedBindings.some((item) => item.slotId === slot.id) ? 'Unlock' : 'Lock'} ${slot.label}`"
                @click="toggleLock(slot.id)"
              >
                <Lock v-if="lockedBindings.some((item) => item.slotId === slot.id)" class="size-3" />
                <Unlock v-else class="size-3" />
              </button>
            </div>
            <p class="mb-1 text-[9px] text-zinc-500">
              {{ slot.role }} · {{ Math.round((slot.targetDuration.value / slot.targetDuration.timescale) * 10) / 10 }}s
              · {{ slot.fit }}
            </p>
            <select
              class="w-full rounded border border-white/10 bg-zinc-900 px-1.5 py-1 text-[10px] text-zinc-200"
              :value="bindingFor(slot.id)?.assetId ?? ''"
              :aria-label="`Media for ${slot.label}`"
              @change="chooseSlotMedia(slot.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Choose media</option>
              <option v-for="asset in media" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <p v-if="bindingFor(slot.id)" class="mt-1 truncate text-[9px] text-zinc-500">
              {{ bindingFor(slot.id)?.reasonCodes.join(' · ') }}
            </p>
          </li>
        </ul>
      </div>
      <div class="border-t border-white/10 p-2">
        <button
          type="button"
          class="w-full rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-white/15 disabled:opacity-40"
          :disabled="
            !draft || preparing || applying || draft.assignment.warnings.some((item) => item.startsWith('Required'))
          "
          @click="applyDraft(false)"
        >
          {{ applying ? 'Applying…' : 'Use template' }}
        </button>
        <button
          type="button"
          class="mt-1.5 w-full rounded-md px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          :disabled="!draft || preparing || applying"
          @click="applyDraft(true)"
        >
          Quick Export
        </button>
      </div>
    </div>
  </div>
</template>
