<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div
      v-if="!hideHeader"
      class="flex items-center justify-between py-3 border-b"
      style="border-color: var(--sidebar-border)"
    >
      <div class="flex items-center gap-3">
        <div class="clips-tab-header-icon w-8 h-8 rounded-lg flex items-center justify-center">
          <Video class="h-4 w-4" style="color: var(--sidebar-accent)" />
        </div>
        <div>
          <h3 class="text-sm font-semibold tracking-tight" style="color: var(--sidebar-text)">Clips</h3>
          <p class="text-[10px]" style="color: var(--sidebar-text-muted)">
            {{ clips.length > 0 ? `${clips.length} clip${clips.length !== 1 ? 's' : ''} detected` : 'No clips yet' }}
          </p>
        </div>
        <span
          v-if="vodPresetConfig"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
          style="background-color: rgba(16, 185, 129, 0.15); color: #6ee7b7"
          :title="`VOD Pre-Edit: ${vodPresetConfig.targetAspectRatio}`"
        >
          <LayoutDashboard class="w-2.5 h-2.5" />
          {{ vodPresetConfig.targetAspectRatio }}
        </span>
      </div>
      <div
        v-if="isGenerating && clips.length > 0 && generationStage !== 'finalizing'"
        class="flex items-center gap-2 min-w-[160px]"
      >
        <div class="flex-1 space-y-0.5">
          <div class="h-1 w-full rounded-full overflow-hidden" style="background-color: rgba(255, 255, 255, 0.05)">
            <div
              class="clips-tab-progress-bar h-full transition-all duration-500 ease-out"
              :class="{ 'animate-pulse': generationProgress === 0 }"
              :style="{ width: `${Math.max(generationProgress, 5)}%` }"
            ></div>
          </div>
          <div class="flex justify-between items-center text-[9px]" style="color: var(--sidebar-text-muted)">
            <span class="flex items-center gap-1">
              <LoaderIcon class="w-2 h-2 animate-spin" style="color: var(--sidebar-accent)" />
              <span class="truncate max-w-[80px]">{{ getCompactMessage() }}</span>
            </span>
            <span class="font-mono tabular-nums">{{ Math.round(generationProgress) }}%</span>
          </div>
        </div>
        <button
          @click="handleCancelDetection"
          class="clips-tab-cancel-btn p-1.5 rounded-md transition-colors"
          title="Cancel detection"
        >
          <XIcon class="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        v-else-if="clips.length > 0 && isAIAllowed && !clipDetectionDisabled"
        @click="handleDetectClips"
        class="clips-tab-header-btn group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all"
        title="Run clip detection again"
      >
        <Sparkles class="h-3 w-3 transition-colors" />
        Detect
      </button>
      <button
        v-else-if="clips.length > 0 && !isAIAllowed"
        @click="handleAddClip"
        class="clips-tab-header-btn group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all"
        title="Manually add a new clip"
      >
        <Plus class="h-3 w-3 transition-colors" />
        Add Clip
      </button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar clips-tab-scroll-container">
      <div
        v-if="isGenerating && (clips.length === 0 || generationStage === 'finalizing')"
        class="h-full flex flex-col items-center justify-center px-6"
      >
        <div class="w-full max-w-xs space-y-5">
          <div class="text-center space-y-2.5">
            <div class="relative mx-auto w-10 h-10">
              <div class="clips-tab-progress-ping absolute inset-0 rounded-full animate-ping duration-1000"></div>
              <div
                class="clips-tab-progress-icon-container relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
              >
                <component :is="stageIcon" class="w-4 h-4 transition-colors duration-300" :class="stageIconClass" />
              </div>
            </div>
            <div class="space-y-1">
              <h4 class="font-semibold text-xs tracking-wide uppercase" style="color: var(--sidebar-text)">
                {{ stageTitle }}
              </h4>
              <p class="text-xs leading-relaxed max-w-[240px] mx-auto" style="color: var(--sidebar-text-muted)">
                {{ stageDescription }}
              </p>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="h-1 w-full rounded-full overflow-hidden" style="background-color: rgba(255, 255, 255, 0.08)">
              <div
                class="clips-tab-progress-bar h-full transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': generationProgress === 0 }"
                :style="{ width: `${Math.max(generationProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[10px] px-0.5" style="color: var(--sidebar-text-muted)">
              <span class="flex items-center gap-1.5">
                <LoaderIcon class="w-2.5 h-2.5 animate-spin opacity-70" />
                {{ getLoadingMessage() }}
              </span>
              <span class="font-mono">{{ Math.round(generationProgress) }}%</span>
            </div>
          </div>
          <div class="flex flex-col items-center gap-2.5">
            <button
              @click="handleCancelDetection"
              class="clips-tab-cancel-progress-btn flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all"
              title="Cancel clip detection"
            >
              <StopCircle class="h-3 w-3" />
              Cancel
            </button>
          </div>
          <div v-if="generationError" class="clips-tab-error-box rounded-md p-2.5">
            <div class="flex items-start gap-2">
              <AlertTriangle class="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div class="text-left">
                <h4 class="font-medium text-red-400 text-[10px] mb-0.5">Error</h4>
                <p class="text-[10px] text-red-400/80 leading-snug">{{ generationError }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="clips.length > 0 && generationStage !== 'finalizing'" class="w-full" ref="clipsScrollContainer">
        <div class="space-y-6 py-4">
          <template v-for="section in clipSections" :key="section.title">
            <div
              v-if="section.title === 'Completed' && completedDownloadAllFileCount > 0"
              class="flex items-center justify-end px-1 mb-1"
            >
              <button
                type="button"
                class="clips-tab-download-btn group flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-md transition-all disabled:opacity-50 disabled:pointer-events-none"
                :disabled="isDownloadingAll"
                title="Copy all built clip files to a folder"
                @click.stop="onDownloadAllBuiltClips"
              >
                <LoaderIcon v-if="isDownloadingAll" class="h-3.5 w-3.5 animate-spin" />
                <DownloadIcon v-else class="h-3.5 w-3.5" />
                <span>Download all ({{ completedDownloadAllFileCount }})</span>
              </button>
            </div>
            <div class="flex items-center justify-between px-1" v-if="section.clips.length > 0">
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-1.5 rounded-full" :class="section.accentClass"></div>
                <h4
                  class="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style="color: var(--sidebar-text-muted)"
                >
                  {{ section.title }}
                </h4>
              </div>
              <span class="text-[10px]" style="color: var(--sidebar-text-muted); opacity: 0.7">
                {{ section.clips.length }}
              </span>
            </div>
            <div class="space-y-3 -mt-2" v-if="section.clips.length > 0">
              <WorkspaceClipCardView v-for="clip in section.clips" :key="clip.id" :clip="clip" :model="model" />
            </div>
          </template>
        </div>
      </div>
      <div v-else class="h-full flex items-center justify-center px-4">
        <div class="text-center max-w-xs">
          <div class="mb-6 flex flex-col items-center">
            <div class="relative mb-6">
              <div class="clips-tab-empty-icon w-16 h-16 rounded-xl flex items-center justify-center mx-auto">
                <Video class="h-7 w-7" style="color: var(--sidebar-accent)" />
              </div>
            </div>
            <h4 class="text-sm font-semibold mb-2" style="color: var(--sidebar-text)">No Clips Yet</h4>
            <template v-if="isAIAllowed && !clipDetectionDisabled">
              <p class="text-xs leading-relaxed mb-6 max-w-[200px]" style="color: var(--sidebar-text-muted)">
                Start detecting clips from your video using AI-powered analysis
              </p>
              <button
                @click="handleDetectClips"
                class="clips-tab-primary-btn group inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-black rounded-lg transition-all duration-200"
                title="Detect Clips"
              >
                <Sparkles class="h-3.5 w-3.5" />
                Detect Clips
              </button>
            </template>
            <template v-else-if="isAIAllowed && clipDetectionDisabled">
              <p class="text-xs leading-relaxed mb-6 max-w-[220px]" style="color: var(--sidebar-text-muted)">
                This video is already a single clip. Transcribe, edit, and build it from here.
              </p>
            </template>
            <template v-else>
              <p class="text-xs leading-relaxed mb-6 max-w-[200px]" style="color: var(--sidebar-text-muted)">
                Mark sections of your video as clips manually
              </p>
              <button
                @click="handleAddClip"
                class="clips-tab-primary-btn group inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white rounded-lg transition-all duration-200"
                title="Add Clip Manually"
              >
                <Plus class="h-3.5 w-3.5" />
                Add Clip
              </button>
              <p class="text-[10px] mt-3 max-w-[180px]" style="color: var(--sidebar-text-muted); opacity: 0.6">
                AI detection is disabled by your organization
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>
<slot />
</div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { Video, LayoutDashboard, Loader2 as LoaderIcon, X as XIcon, Sparkles, Plus, StopCircle, AlertTriangle, Download as DownloadIcon, ChevronDown as ChevronDownIcon, MoreVertical, Edit3, Settings2, Play as PlayIcon, Hammer, Rocket, Trash2, Flame, Clock as ClockIcon, Brain as BrainIcon, Check as CheckIcon } from 'lucide-vue-next';
import WorkspaceClipCardView from './WorkspaceClipCardView.vue';
export default defineComponent({ components: { Video, LayoutDashboard, LoaderIcon, XIcon, Sparkles, Plus, StopCircle, AlertTriangle, DownloadIcon, ChevronDownIcon, MoreVertical, Edit3, Settings2, PlayIcon, Hammer, Rocket, Trash2, Flame, ClockIcon, BrainIcon, CheckIcon, WorkspaceClipCardView }, props: { model: { type: Object, required: true } }, setup(props) { return props.model; } });
</script>
<style scoped src="@/styles/workspaceClips.css"></style>
<style src="@/styles/workspaceClipMenus.css"></style>
