<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Header (hidden when integrated into a parent panel such as MediaPanel) -->
    <div
      v-if="!hideHeader"
      class="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-3"
    >
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="text-sm font-semibold text-fg">Clips</h3>
        <span class="tabular text-xs text-fg-subtle">
          {{ clips.length > 0 ? clips.length : 'None yet' }}
        </span>
        <Badge v-if="vodPresetConfig" variant="brand" :title="`VOD Pre-Edit: ${vodPresetConfig.targetAspectRatio}`">
          <LayoutDashboard />
          {{ vodPresetConfig.targetAspectRatio }}
        </Badge>
      </div>

      <!-- Compact progress (hidden while finalizing — the centered progress shows then) -->
      <InlineProgress
        v-if="isGenerating && clips.length > 0 && generationStage !== 'finalizing'"
        :label="getCompactMessage()"
        :progress="generationProgress"
        cancel-title="Cancel detection"
        @cancel="handleCancelDetection"
      />
      <Button
        v-else-if="clips.length > 0 && isAIAllowed && !clipDetectionDisabled"
        variant="ghost"
        size="xs"
        title="Run clip detection again"
        @click="handleDetectClips"
      >
        <Sparkles />
        Detect
      </Button>
      <Button
        v-else-if="clips.length > 0 && !isAIAllowed"
        variant="ghost"
        size="xs"
        title="Manually add a new clip"
        @click="handleAddClip"
      >
        <Plus />
        Add clip
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Progress state (while generating with no clips yet, or while finalizing) -->
      <div
        v-if="isGenerating && (clips.length === 0 || generationStage === 'finalizing')"
        class="flex h-full flex-col items-center justify-center px-6 py-8"
      >
        <div class="flex w-full max-w-[280px] flex-col items-center gap-4 text-center">
          <IconTile :icon="stageIcon" tone="ai" size="md" />
          <div class="flex flex-col gap-1">
            <h4 class="text-sm font-semibold text-fg">{{ stageTitle }}</h4>
            <p class="text-xs text-fg-muted">{{ stageDescription }}</p>
          </div>

          <div class="flex w-full flex-col gap-1.5">
            <div class="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                class="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                :class="{ 'animate-pulse': generationProgress === 0 }"
                :style="{ width: `${Math.max(generationProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex items-center justify-between text-2xs text-fg-muted">
              <span class="flex items-center gap-1.5">
                <LoaderIcon class="size-3 animate-spin" />
                {{ getLoadingMessage() }}
              </span>
              <span class="tabular">{{ Math.round(generationProgress) }}%</span>
            </div>
          </div>

          <Button variant="secondary" size="sm" title="Cancel clip detection" @click="handleCancelDetection">
            <StopCircle />
            Cancel
          </Button>

          <Alert v-if="generationError" variant="destructive" class="text-left">
            <AlertTriangle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{{ generationError }}</AlertDescription>
          </Alert>
        </div>
      </div>

      <!-- Clips list (hidden while finalizing to show progress) -->
      <div
        v-else-if="clips.length > 0 && generationStage !== 'finalizing'"
        ref="clipsScrollContainer"
        class="w-full animate-fade-in"
      >
        <div class="flex flex-col gap-4 px-2 py-3">
          <template v-for="section in clipSections" :key="section.title">
            <section v-if="section.clips.length > 0" class="flex flex-col gap-0.5">
              <SectionHeader
                :title="section.title"
                :count="section.clips.length"
                variant="eyebrow"
                class="mb-1 min-h-6 px-1.5"
              >
                <Button
                  v-if="section.title === 'Completed' && completedDownloadAllFileCount > 0"
                  variant="ghost"
                  size="xs"
                  :loading="isDownloadingAll"
                  title="Copy all built clip files to a folder"
                  @click.stop="onDownloadAllBuiltClips"
                >
                  <DownloadIcon v-if="!isDownloadingAll" />
                  Download all ({{ completedDownloadAllFileCount }})
                </Button>
              </SectionHeader>

              <div
                v-for="clip in section.clips"
                :key="clip.id"
                :ref="(el) => setClipRef(el, clip.id)"
                class="group relative flex cursor-pointer gap-3 rounded-lg p-1.5 transition-colors"
                :class="
                  props.playingClipId === clip.id
                    ? 'bg-brand-soft'
                    : hoveredTimelineClipId === clip.id || hoveredClipId === clip.id
                      ? 'bg-surface-hover'
                      : 'hover:bg-surface-hover'
                "
                :aria-current="props.playingClipId === clip.id ? 'true' : undefined"
                @click="onClipClick(clip.id)"
              >
                <!-- Thumbnail -->
                <div class="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                  <!-- Persisted/generated FFmpeg thumbnails — always prefer these over per-row FramedThumbnail.
                       Framed thumbnails used full-VOD seeks per clip row (slow/failed on long sources). -->
                  <img
                    v-if="getClipThumbnail(clip.id)"
                    :src="getClipThumbnail(clip.id)!"
                    :alt="clip.current_version_name || clip.name || 'Clip thumbnail'"
                    class="size-full object-cover"
                  />
                  <div v-else class="grid size-full place-items-center text-fg-disabled">
                    <LoaderIcon v-if="thumbnailStore.isLoading(clip.id)" class="size-4 animate-spin" />
                    <Video v-else class="size-5" />
                  </div>
                  <span
                    class="tabular absolute bottom-1 right-1 rounded bg-black/70 px-1 text-2xs font-medium leading-4 text-white"
                  >
                    {{ formatDuration(getClipDuration(clip)) }}
                  </span>
                  <!-- Building overlay -->
                  <div
                    v-if="clip.build_status === 'building'"
                    class="absolute inset-0 grid place-items-center bg-black/60"
                    title="Building..."
                  >
                    <LoaderIcon class="size-5 animate-spin text-brand" />
                  </div>
                </div>

                <!-- Content -->
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <div class="flex items-start justify-between gap-1">
                    <h5 class="line-clamp-2 min-w-0 text-sm font-medium leading-5 text-fg">
                      <span class="tabular mr-1 text-xs font-normal text-fg-subtle">
                        #{{ clipIndexMap.get(clip.id)! + 1 }}
                      </span>
                      {{ clip.current_version_name || clip.name || 'Untitled clip' }}
                    </h5>

                    <!-- Actions -->
                    <div class="-mr-0.5 -mt-0.5 flex shrink-0 items-center">
                      <!-- Quick download (when builds exist) -->
                      <DropdownMenu v-if="hasCompletedBuilds(clip)">
                        <DropdownMenuTrigger as-child>
                          <button
                            type="button"
                            class="flex h-6 items-center gap-0.5 rounded-md px-1 text-fg-muted transition-colors hover:bg-surface-active hover:text-fg data-[state=open]:bg-surface-active data-[state=open]:text-fg"
                            title="Download clip"
                            aria-label="Download clip"
                            @click.stop
                          >
                            <DownloadIcon class="size-3.5" />
                            <ChevronDownIcon class="size-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-[220px]" @click.stop>
                          <DropdownMenuLabel>Downloads ({{ getDownloadableFilesCount(clip) }})</DropdownMenuLabel>
                          <DropdownMenuItem
                            v-for="(file, fileIdx) in getDownloadableFiles(clip)"
                            :key="`${file.build.id}-${fileIdx}`"
                            class="h-auto min-h-8 py-1"
                            @select="onSaveFile(file.filePath)"
                          >
                            <DownloadIcon />
                            <span class="min-w-0 flex-1">
                              <span class="flex items-center gap-1.5 text-sm">
                                <span v-if="file.aspectRatio" class="font-medium text-fg">{{ file.aspectRatio }}</span>
                                <span class="tabular text-xs text-fg-subtle">#{{ file.build.build_number }}</span>
                              </span>
                              <span v-if="file.build.completed_at" class="block text-2xs text-fg-subtle">
                                {{ formatBuildDate(file.build.completed_at) }}
                              </span>
                            </span>
                          </DropdownMenuItem>
                          <!-- Legacy download fallback -->
                          <DropdownMenuItem
                            v-if="getDownloadableFilesCount(clip) === 0 && clip.built_file_path"
                            class="h-auto min-h-8 py-1"
                            @select="onSaveBuiltClip(clip)"
                          >
                            <DownloadIcon />
                            <span class="min-w-0 flex-1">
                              <span class="block text-sm">Download</span>
                              <span v-if="clip.built_at" class="block text-2xs text-fg-subtle">
                                {{ formatBuildDate(clip.built_at) }}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <!-- More actions -->
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <button
                            type="button"
                            class="grid size-6 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-active hover:text-fg data-[state=open]:bg-surface-active data-[state=open]:text-fg"
                            title="Clip actions"
                            aria-label="Clip actions"
                            @click.stop
                          >
                            <MoreVertical class="size-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-[200px]" @click.stop>
                          <DropdownMenuItem v-if="allowEditor !== false" @select="onEditClip(clip.id)">
                            <Edit3 />
                            Edit clip
                          </DropdownMenuItem>
                          <DropdownMenuItem v-if="props.showAdjustClipButton" @select="onAdjustClip(clip.id)">
                            <Settings2 />
                            Adjust clip
                          </DropdownMenuItem>
                          <DropdownMenuItem @select="onPlayClip(clip)">
                            <PlayIcon />
                            Play clip
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem v-if="clip.build_status !== 'building'" @select="onBuildClip(clip)">
                            <Hammer />
                            {{ hasCompletedBuilds(clip) ? 'Rebuild clip' : 'Build clip' }}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="clip.build_status !== 'building' && !hasCompletedBuilds(clip)"
                            @select="onPublishNow(clip)"
                          >
                            <Rocket />
                            Publish now
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="clip.build_status === 'building'"
                            :class="dangerItemClass"
                            @select="handleCancelBuild(clip.id)"
                          >
                            <StopCircle />
                            Cancel build
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="inEditorStore.isInEditor(clip.id)"
                            @select="onClearFromInEditor(clip.id)"
                          >
                            <XIcon />
                            Clear “In editor” status
                          </DropdownMenuItem>
                          <!-- Delete (only if not built) -->
                          <template v-if="!hasCompletedBuilds(clip)">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem :class="dangerItemClass" @select="onDeleteClip(clip.id)">
                              <Trash2 />
                              Delete clip
                            </DropdownMenuItem>
                          </template>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <!-- Metrics -->
                  <div class="flex flex-wrap items-center gap-1">
                    <Badge
                      v-if="
                        clip.current_version_virality_score !== undefined &&
                        clip.current_version_virality_score !== null
                      "
                      :variant="getViralityBadgeVariant(clip.current_version_virality_score)"
                      title="Predicted virality score"
                    >
                      <Flame />
                      <span class="tabular">{{ Math.round(clip.current_version_virality_score) }}%</span>
                    </Badge>
                    <Badge
                      v-if="inEditorStore.isInEditor(clip.id)"
                      variant="brand"
                      title="This clip is currently open in the video editor"
                    >
                      <Edit3 />
                      In editor
                    </Badge>
                    <Badge v-if="hasCompletedBuilds(clip)" variant="success" title="Built files">
                      <CheckIcon />
                      {{ getDownloadableFilesCount(clip) || 1 }} file{{
                        (getDownloadableFilesCount(clip) || 1) !== 1 ? 's' : ''
                      }}
                    </Badge>
                    <span
                      v-if="clip.current_version_confidence_score"
                      class="tabular inline-flex items-center gap-1 px-0.5 text-2xs font-medium"
                      :class="getConfidenceColorClass(clip.current_version_confidence_score)"
                      title="AI confidence score"
                    >
                      <BrainIcon class="size-3" />
                      {{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%
                    </span>
                  </div>

                  <!-- Detection reason -->
                  <p
                    v-if="clip.current_version_detection_reason"
                    class="line-clamp-1 text-xs text-fg-subtle"
                    :title="clip.current_version_detection_reason"
                  >
                    {{ clip.current_version_detection_reason }}
                  </p>

                  <!-- Footer -->
                  <div class="mt-auto flex min-w-0 items-center gap-3 text-2xs text-fg-subtle">
                    <span class="tabular shrink-0 whitespace-nowrap">
                      <ClockIcon class="-mt-px mr-1 inline size-3" />
                      {{ formatTime(clip.current_version_start_time || 0) }} –
                      {{ formatTime(clip.current_version_end_time || 0) }}
                    </span>
                    <span class="ms-auto flex min-w-0 items-center gap-2">
                      <span v-if="clip.run_number" class="flex shrink-0 items-center gap-1 whitespace-nowrap">
                        <span
                          class="size-1.5 rounded-full"
                          :style="{ backgroundColor: clip.session_run_color || '#10B981' }"
                        ></span>
                        Run {{ clip.run_number }}
                      </span>
                      <span
                        v-if="getPromptDisplayName(clip.session_prompt)"
                        class="max-w-[100px] truncate"
                        :title="getPromptDisplayName(clip.session_prompt)"
                      >
                        {{ getPromptDisplayName(clip.session_prompt) }}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </template>
        </div>
      </div>

      <!-- Empty state -->
      <template v-else>
        <EmptyState
          v-if="isAIAllowed && !clipDetectionDisabled"
          :icon="Sparkles"
          tone="ai"
          size="sm"
          title="No clips yet"
          description="Find the best moments in this video with AI-powered clip detection."
          class="h-full"
        >
          <Button variant="primary" size="sm" @click="handleDetectClips">
            <Sparkles />
            Detect clips
          </Button>
        </EmptyState>
        <EmptyState
          v-else-if="isAIAllowed && clipDetectionDisabled"
          :icon="Video"
          size="sm"
          title="No clips yet"
          description="This video is already a single clip. Transcribe, edit and build it from here."
          class="h-full"
        />
        <EmptyState
          v-else
          :icon="Video"
          size="sm"
          title="No clips yet"
          description="Mark sections of your video as clips manually. AI detection is disabled by your organization."
          class="h-full"
        >
          <Button variant="primary" size="sm" @click="handleAddClip">
            <Plus />
            Add clip
          </Button>
        </EmptyState>
      </template>
    </div>

    <!-- Build Settings Dialog -->
    <slot />
  </div>
</template>
<script lang="ts">
  import { defineComponent, markRaw } from 'vue';
  import { clipsViewPresentation } from '@/lib/sharedViewPresentation';
  import {
    PlayIcon,
    BrainIcon,
    ClockIcon,
    Hammer,
    DownloadIcon,
    LoaderIcon,
    CheckIcon,
    AlertTriangle,
    Trash2,
    Video,
    Flame,
    XIcon,
    StopCircle,
    ChevronDownIcon,
    Sparkles,
    Edit3,
    MoreVertical,
    Plus,
    Settings2,
    LayoutDashboard,
    Rocket,
  } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Button } from '@/components/ui/button';
  import { IconTile } from '@/components/ui/icon-tile';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SectionHeader } from '@/components/ui/section-header';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import InlineProgress from '@/components/workspace/InlineProgress.vue';
  export default defineComponent({
    components: {
      PlayIcon,
      BrainIcon,
      ClockIcon,
      Hammer,
      DownloadIcon,
      LoaderIcon,
      CheckIcon,
      AlertTriangle,
      Trash2,
      Video,
      Flame,
      XIcon,
      StopCircle,
      ChevronDownIcon,
      Sparkles,
      Edit3,
      MoreVertical,
      Plus,
      Settings2,
      LayoutDashboard,
      Rocket,
      Badge,
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuTrigger,
      Button,
      IconTile,
      EmptyState,
      SectionHeader,
      Alert,
      AlertDescription,
      AlertTitle,
      InlineProgress,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, clipsViewPresentation(props.model), {
        PlayIcon: markRaw(PlayIcon),
        BrainIcon: markRaw(BrainIcon),
        ClockIcon: markRaw(ClockIcon),
        Hammer: markRaw(Hammer),
        DownloadIcon: markRaw(DownloadIcon),
        LoaderIcon: markRaw(LoaderIcon),
        CheckIcon: markRaw(CheckIcon),
        AlertTriangle: markRaw(AlertTriangle),
        Trash2: markRaw(Trash2),
        Video: markRaw(Video),
        Flame: markRaw(Flame),
        XIcon: markRaw(XIcon),
        StopCircle: markRaw(StopCircle),
        ChevronDownIcon: markRaw(ChevronDownIcon),
        Sparkles: markRaw(Sparkles),
        Edit3: markRaw(Edit3),
        MoreVertical: markRaw(MoreVertical),
        Plus: markRaw(Plus),
        Settings2: markRaw(Settings2),
        LayoutDashboard: markRaw(LayoutDashboard),
        Rocket: markRaw(Rocket),
        Badge: markRaw(Badge),
        DropdownMenu: markRaw(DropdownMenu),
        DropdownMenuContent: markRaw(DropdownMenuContent),
        DropdownMenuItem: markRaw(DropdownMenuItem),
        DropdownMenuLabel: markRaw(DropdownMenuLabel),
        DropdownMenuSeparator: markRaw(DropdownMenuSeparator),
        DropdownMenuTrigger: markRaw(DropdownMenuTrigger),
        Button: markRaw(Button),
        IconTile: markRaw(IconTile),
        EmptyState: markRaw(EmptyState),
        SectionHeader: markRaw(SectionHeader),
        Alert: markRaw(Alert),
        AlertDescription: markRaw(AlertDescription),
        AlertTitle: markRaw(AlertTitle),
        InlineProgress: markRaw(InlineProgress),
      });
    },
  });
</script>
