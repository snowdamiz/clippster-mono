<script setup lang="ts">

import { computed, onMounted } from 'vue';

import { invoke } from '@tauri-apps/api/core';

import { useEditor } from '../../../composables/useEditor';

import { useAiBroll } from '@/composables/useAiBroll';

import AIBrollPanel from '@/components/poi/AIBrollPanel.vue';

import {

  buildBrollVideoElement,

  buildBrollImageElement,

} from '../../../lib/timeline/element-utils';

import { hydrateVideoFileFromLocalUrl } from '../../../lib/media/hydrate-video-file-from-url';

import type { AiBrollPlannerOptions, AiBrollSuggestion } from '@/types/ai-broll';

import { generateUUID } from '../../../utils/id';

import { utf8ToBase64Url } from '@/utils/encoding';

import {

  editorMediaDestinationFilename,

  playbackFileLabel,

} from '@/utils/fsNames';

import { updateAiBrollSuggestion } from '@/services/database/ai-broll-suggestions';
import { videoCache } from '../../../video-cache/service';



const { editor, version } = useEditor();

const aiBroll = useAiBroll();



const activeProject = computed(() => {

  void version.value;

  return editor.project.getActiveOrNull();

});



const projectId = computed(() => activeProject.value?.metadata.id ?? null);



/** Persist/load suggestions by source clip when set, otherwise by editor project id. */

const brollScopeId = computed(

  () => activeProject.value?.settings.sourceClipId ?? projectId.value,

);



const transcriptWords = computed(() => {

  void version.value;

  return editor.transcript.getWords();

});



const clipDuration = computed(() => {

  void version.value;

  const scene = editor.scenes.getActiveSceneOrNull();

  if (!scene) return 0;

  const mainTrack = scene.tracks.find(

    (t): t is import('../../../types/timeline').VideoTrack =>

      t.type === 'video' && 'isMain' in t && Boolean(t.isMain),

  );

  if (!mainTrack) return 60;

  const total = mainTrack.elements.reduce(

    (max: number, el) => Math.max(max, el.startTime + el.duration),

    0,

  );

  return total || 60;

});



const aspectRatio = computed(() => {

  const size = activeProject.value?.settings.canvasSize;

  if (!size) return '9:16';

  const { width: w, height: h } = size;

  if (w === h) return '1:1';

  if (w > h) return '16:9';

  if (Math.abs(w / h - 4 / 5) < 0.05) return '4:5';

  return '9:16';

});



const canGenerate = computed(

  () => Boolean(projectId.value && brollScopeId.value && transcriptWords.value.length > 0),

);



onMounted(() => {

  if (brollScopeId.value) {

    void aiBroll.loadSuggestions(brollScopeId.value);

  }

});



async function onGenerate(options: AiBrollPlannerOptions) {

  if (!brollScopeId.value) return;

  await aiBroll.generateSuggestions({

    clipId: brollScopeId.value,

    clipStart: 0,

    clipEnd: clipDuration.value,

    aspectRatio: aspectRatio.value,

    transcriptWords: transcriptWords.value,

    transcriptSegments: [],

    plannerOptions: options,

  });

  if (aiBroll.error.value || aiBroll.suggestions.value.length === 0) return;

  const orientation = aspectRatio.value === '16:9' ? 'landscape' : 'portrait';

  await aiBroll.fetchAllCandidates(orientation);

}



async function onFetchAll() {

  const orientation = aspectRatio.value === '16:9' ? 'landscape' : 'portrait';

  await aiBroll.fetchAllCandidates(orientation);

}



async function registerMediaFromPath(

  localPath: string,

  mediaType: 'video' | 'image',

  name: string,

  duration: number | null,

  width?: number | null,

  height?: number | null,

): Promise<string | null> {

  if (!projectId.value) return null;



  const mediaId = generateUUID();

  const fileName = editorMediaDestinationFilename({

    id: mediaId,

    displayName: name,

    sourcePathHint: localPath,

    kind: mediaType,

  });



  const destPath = await invoke<string>('copy_file_to_project_media', {

    sourcePath: localPath,

    projectId: projectId.value,

    fileName,

  });



  let videoServerPort = 8642;

  try {

    videoServerPort = await invoke<number>('get_video_server_port');

  } catch {

    // dev fallback

  }



  const url = `http://localhost:${videoServerPort}/video/${utf8ToBase64Url(destPath)}`;

  const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

  const playbackName = playbackFileLabel(destPath, fileName, mediaType);

  const file = await hydrateVideoFileFromLocalUrl({

    url,

    name: playbackName,

    fallbackType: mime,

    diskPath: destPath,

  });



  let probedWidth = width ?? undefined;

  let probedHeight = height ?? undefined;

  if (mediaType === 'video' && (!probedWidth || !probedHeight)) {

    try {

      const probe = await invoke<{ width?: number; height?: number }>('validate_video_file', {

        filePath: destPath,

      });

      probedWidth = probe.width ?? probedWidth;

      probedHeight = probe.height ?? probedHeight;

    } catch {

      // non-fatal

    }

  }



  await editor.media.addMediaAsset({

    projectId: projectId.value,

    mediaAssetId: mediaId,

    asset: {

      name: fileName,

      type: mediaType,

      file,

      url,

      duration: duration ?? undefined,

      width: probedWidth,

      height: probedHeight,

      alreadyResolvedFilePath: destPath,

      importFileSizeBytes: file.size,

    },

  });



  return mediaId;

}



function sourceTrimOffset(candidateDuration: number | null | undefined, clipDurationSec: number): number {

  if (!candidateDuration || candidateDuration <= clipDurationSec + 0.5) return 0;

  const slack = candidateDuration - clipDurationSec;

  return Math.min(slack * 0.25, Math.max(0, slack - 1));

}



async function applyToTimeline(suggestion: AiBrollSuggestion) {

  if (!projectId.value) return;

  let working = suggestion;

  if (working.candidates.length === 0) {

    const orientation = aspectRatio.value === '16:9' ? 'landscape' : 'portrait';

    working = await aiBroll.fetchCandidatesForSuggestion(working, orientation);

  }

  const candidate =

    working.candidates.find((c) => c.id === working.selectedCandidateId) ??

    working.candidates[0];

  if (!candidate) return;



  const localPath = await aiBroll.ingestCandidate(working, candidate, projectId.value);

  const mediaId = await registerMediaFromPath(

    localPath,

    candidate.mediaType,

    `broll_${candidate.providerAssetId}`,

    candidate.duration ?? null,

    candidate.width,

    candidate.height,

  );

  if (!mediaId) return;



  const segmentDuration = working.endTime - working.startTime;

  const trimStart = sourceTrimOffset(candidate.duration, segmentDuration);



  const element =

    candidate.mediaType === 'video'

      ? buildBrollVideoElement({

          mediaId,

          name: `B-roll ${candidate.providerAssetId}`,

          duration: segmentDuration,

          startTime: working.startTime,

          trimStart,

        })

      : buildBrollImageElement({

          mediaId,

          name: `B-roll ${candidate.providerAssetId}`,

          duration: segmentDuration,

          startTime: working.startTime,

        });



  const insertedElementId = editor.timeline.insertElement({

    element,

    placement: { mode: 'auto' },

  });

  if (candidate.mediaType === 'video') {
    const asset = editor.media.getAssets().find((item) => item.id === mediaId);
    if (asset?.file) {
      void videoCache.getFrameAt({
        sinkKey: insertedElementId,
        file: asset.file,
        time: trimStart,
      }).catch(() => {});
    }
  }



  const applied = { ...working, status: 'applied' as const, localMediaPath: localPath };

  await updateAiBrollSuggestion(applied);

  aiBroll.suggestions.value = aiBroll.suggestions.value.map((s) =>

    s.id === applied.id ? applied : s,

  );

}



async function onApply(suggestionId: string) {

  const suggestion = aiBroll.suggestions.value.find((s) => s.id === suggestionId);

  if (!suggestion || suggestion.status === 'applied') return;

  await applyToTimeline(suggestion);

}



async function onApplyAll() {

  for (const s of aiBroll.suggestions.value.filter((x) => x.status === 'ready')) {

    await applyToTimeline(s);

  }

}



async function onRegenerate(suggestionId: string) {

  const suggestion = aiBroll.suggestions.value.find((s) => s.id === suggestionId);

  if (!suggestion) return;

  const orientation = aspectRatio.value === '16:9' ? 'landscape' : 'portrait';

  await aiBroll.regenerateSuggestion(suggestion, orientation);

}



async function onReject(suggestionId: string) {

  const suggestion = aiBroll.suggestions.value.find((s) => s.id === suggestionId);

  if (!suggestion) return;

  await aiBroll.rejectSuggestion(suggestion);

}



function onSelectCandidate(suggestionId: string, candidateId: string) {

  const idx = aiBroll.suggestions.value.findIndex((s) => s.id === suggestionId);

  if (idx < 0) return;

  aiBroll.suggestions.value[idx] = {

    ...aiBroll.suggestions.value[idx],

    selectedCandidateId: candidateId,

  };

}

</script>



<template>

  <div class="flex flex-col h-full min-h-0">

    <AIBrollPanel

      variant="editor"

      class="flex-1 min-h-0"

      :suggestions="aiBroll.suggestions.value"

      :is-generating="aiBroll.isGenerating.value"

      :is-fetching="aiBroll.isFetching.value"

      :error="aiBroll.error.value"

      :can-generate="canGenerate"

      :planner-options="aiBroll.options.value"

      :clip-duration="clipDuration"

      @close="() => {}"

      @generate="onGenerate"

      @fetch-all="onFetchAll"

      @apply="onApply"

      @apply-all="onApplyAll"

      @regenerate="onRegenerate"

      @reject="onReject"

      @select-candidate="onSelectCandidate"

    />

    <p v-if="!canGenerate" class="text-[11px] text-zinc-500 px-3 py-2 border-t border-zinc-800/80">

      Load or generate a transcript to use AI B-roll in the timeline.

    </p>

  </div>

</template>


