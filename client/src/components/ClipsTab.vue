<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header (can be hidden when integrated into parent tabs) -->
    <div v-if="!hideHeader" class="flex items-center justify-between py-3 border-b border-border/20">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 bg-gradient-to-br from-violet-500/15 to-purple-600/15 rounded-lg flex items-center justify-center border border-violet-500/25 shadow-sm shadow-violet-500/5"
        >
          <Video class="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-foreground tracking-tight">Clips</h3>
          <p class="text-[10px] text-muted-foreground/70">
            {{ clips.length > 0 ? `${clips.length} clip${clips.length !== 1 ? 's' : ''} detected` : 'No clips yet' }}
          </p>
        </div>
      </div>

      <!-- Compact Progress Bar (when detecting) -->
      <div v-if="isGenerating && clips.length > 0" class="flex items-center gap-2 min-w-[160px]">
        <div class="flex-1 space-y-0.5">
          <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500 ease-out"
              :class="{ 'animate-pulse': generationProgress === 0 }"
              :style="{ width: `${Math.max(generationProgress, 5)}%` }"
            ></div>
          </div>
          <div class="flex justify-between items-center text-[9px] text-muted-foreground/70">
            <span class="flex items-center gap-1">
              <LoaderIcon class="w-2 h-2 animate-spin text-violet-400" />
              <span class="truncate max-w-[80px]">{{ getCompactMessage() }}</span>
            </span>
            <span class="font-mono tabular-nums">{{ Math.round(generationProgress) }}%</span>
          </div>
        </div>
        <button
          @click="handleCancelDetection"
          class="p-1.5 hover:bg-red-500/15 rounded-md transition-colors text-muted-foreground/60 hover:text-red-400"
          title="Cancel detection"
        >
          <XIcon class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Detect Button (when not detecting and has clips) - Only show if AI is allowed -->
      <button
        v-else-if="clips.length > 0 && isAIAllowed"
        @click="handleDetectClips"
        class="group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-all border border-white/[0.06] hover:border-white/[0.1]"
        title="Run clip detection again"
      >
        <Sparkles class="h-3 w-3 group-hover:text-violet-400 transition-colors" />
        Detect
      </button>

      <!-- Add Clip Button (when AI is not allowed and has clips) -->
      <button
        v-else-if="clips.length > 0 && !isAIAllowed"
        @click="handleAddClip"
        class="group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-all border border-white/[0.06] hover:border-white/[0.1]"
        title="Manually add a new clip"
      >
        <Plus class="h-3 w-3 group-hover:text-emerald-400 transition-colors" />
        Add Clip
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Progress State (only when no clips exist yet) -->
      <div v-if="isGenerating && clips.length === 0" class="h-full flex flex-col items-center justify-center px-6">
        <div class="w-full max-w-xs space-y-5">
          <!-- Icon & Status -->
          <div class="text-center space-y-2.5">
            <div class="relative mx-auto w-10 h-10">
              <div class="absolute inset-0 rounded-full bg-primary/5 animate-ping duration-1000"></div>
              <div
                class="relative w-10 h-10 rounded-full bg-background border border-border/50 shadow-sm flex items-center justify-center"
              >
                <component :is="stageIcon" class="w-4 h-4 transition-colors duration-300" :class="stageIconClass" />
              </div>
            </div>

            <div class="space-y-1">
              <h4 class="font-semibold text-foreground text-xs tracking-wide uppercase">{{ stageTitle }}</h4>
              <p class="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">{{ stageDescription }}</p>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-1.5">
            <div class="h-1 w-full bg-secondary/30 rounded-full overflow-hidden">
              <div
                class="h-full bg-primary transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': generationProgress === 0 }"
                :style="{ width: `${Math.max(generationProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-muted-foreground px-0.5">
              <span class="flex items-center gap-1.5">
                <LoaderIcon class="w-2.5 h-2.5 animate-spin opacity-70" />
                {{ getLoadingMessage() }}
              </span>
              <span class="font-mono">{{ Math.round(generationProgress) }}%</span>
            </div>
          </div>

          <!-- Time Estimate & Cancel Button -->
          <div class="flex flex-col items-center gap-2.5">
            <div
              class="inline-flex items-center gap-1.5 text-[9px] text-muted-foreground/70 bg-secondary/20 px-2 py-0.5 rounded-full border border-border/10"
            >
              <ClockIcon class="w-2.5 h-2.5" />
              {{ getTimeEstimate() }}
            </div>
            <button
              @click="handleCancelDetection"
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-red-400 bg-muted/30 hover:bg-red-500/10 border border-border/40 hover:border-red-500/40 rounded-md transition-all"
              title="Cancel clip detection"
            >
              <StopCircle class="h-3 w-3" />
              Cancel
            </button>
          </div>

          <!-- Status Message (if extra details) -->
          <div
            v-if="generationMessage && generationMessage !== getLoadingMessage()"
            class="text-[10px] text-center text-muted-foreground/80 bg-muted/20 rounded px-2.5 py-1.5 border border-border/20"
          >
            {{ generationMessage }}
          </div>

          <!-- Error State -->
          <div v-if="generationError" class="bg-red-500/5 border border-red-500/20 rounded-md p-2.5">
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
      <!-- Clips List State -->
      <div
        v-else-if="clips.length > 0"
        class="w-full flex-1 overflow-y-auto custom-scrollbar"
        ref="clipsScrollContainer"
      >
        <!-- Clips Grid -->
        <div class="space-y-3 py-4">
          <div
            v-for="(clip, index) in sortedClips"
            :key="clip.id"
            :ref="(el) => setClipRef(el, clip.id)"
            :class="[
              'group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg cursor-pointer transition-all duration-200',
              // Playing clip gets green styling
              props.isPlayingSegments && props.playingClipId === clip.id
                ? 'ring-1 ring-green-500/50 bg-green-500/[0.04] border-green-500/50 shadow-lg shadow-green-500/10'
                : 'hover:border-border/80 hover:bg-card/70 hover:shadow-lg hover:shadow-black/10',
            ]"
            :style="{
              // Prioritize playing state over all other states
              borderColor:
                props.isPlayingSegments && props.playingClipId === clip.id
                  ? undefined
                  : !props.isPlayingSegments && (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                    ? clip.session_run_color || '#8B5CF6'
                    : undefined,
              borderWidth:
                !props.isPlayingSegments && (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                  ? '1px'
                  : undefined,
            }"
            @click="onClipClick(clip.id)"
          >
            <!-- Left accent bar -->
            <div
              v-if="clip.run_number"
              class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 rounded-l-lg"
              :style="{
                backgroundColor: clip.session_run_color || '#8B5CF6',
                opacity: props.isPlayingSegments && props.playingClipId === clip.id ? '1' : '0.6',
              }"
            ></div>

            <div class="flex gap-3 p-3 pl-4">
              <!-- Thumbnail -->
              <div class="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden bg-black/30 border border-border/30">
                <img
                  v-if="getClipThumbnail(clip.id)"
                  :src="getClipThumbnail(clip.id)!"
                  :alt="clip.current_version_name || clip.name || 'Clip thumbnail'"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Video class="w-6 h-6 text-muted-foreground/40" />
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0 flex flex-col">
                <!-- Header: Title & Actions -->
                <div class="flex items-start justify-between gap-2 mb-1.5">
                  <div class="flex items-start gap-2 min-w-0">
                    <span class="text-xs font-bold text-foreground/30 mt-0.5 tabular-nums select-none">
                      #{{ index + 1 }}
                    </span>
                    <h5 class="text-[14px] font-semibold text-foreground leading-snug line-clamp-2">
                      {{ clip.current_version_name || clip.name || 'Untitled Clip' }}
                    </h5>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-0.5 flex-shrink-0">
                    <!-- Quick Download Button (when downloads available) -->
                    <div v-if="hasCompletedBuilds(clip)" class="relative" data-action-menu>
                      <button
                        :ref="(el) => setDropdownButtonRef(el, clip.id)"
                        class="p-1.5 hover:bg-green-500/15 rounded-md transition-colors text-green-500/70 hover:text-green-400 flex items-center gap-0.5"
                        :class="{ 'bg-green-500/15 text-green-400': openDownloadDropdownId === clip.id }"
                        title="Download clip"
                        @click.stop="toggleDownloadDropdown(clip.id)"
                      >
                        <DownloadIcon class="h-4 w-4" />
                        <ChevronDownIcon class="h-2.5 w-2.5" />
                      </button>

                      <!-- Download Dropdown - Teleported to body -->
                      <Teleport to="body">
                        <div
                          v-if="openDownloadDropdownId === clip.id"
                          class="fixed z-[9999] w-[220px] bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl shadow-black/20 py-1.5 overflow-hidden"
                          :style="getDropdownPosition(clip.id)"
                          data-action-menu
                          @click.stop
                        >
                          <div
                            class="px-3 py-1.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider"
                          >
                            Downloads ({{ getDownloadableFilesCount(clip) }})
                          </div>

                          <!-- Download items -->
                          <button
                            v-for="(file, fileIdx) in getDownloadableFiles(clip)"
                            :key="`${file.build.id}-${fileIdx}`"
                            class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-green-500/15 hover:text-green-400 transition-colors"
                            @click.stop="
                              onSaveFile(file.filePath);
                              closeDownloadDropdown();
                            "
                          >
                            <DownloadIcon class="h-4 w-4 text-green-500/70 flex-shrink-0" />
                            <div class="flex-1 min-w-0 text-left">
                              <div class="text-xs font-medium truncate flex items-center gap-1.5">
                                <span v-if="file.aspectRatio" class="text-green-400/80">{{ file.aspectRatio }}</span>
                                <span class="text-muted-foreground/60">#{{ file.build.build_number }}</span>
                              </div>
                              <div v-if="file.build.completed_at" class="text-[10px] text-muted-foreground/50 mt-0.5">
                                {{ formatBuildDate(file.build.completed_at) }}
                              </div>
                            </div>
                          </button>

                          <!-- Legacy download fallback -->
                          <button
                            v-if="getDownloadableFilesCount(clip) === 0 && clip.built_file_path"
                            class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-green-500/15 hover:text-green-400 transition-colors"
                            @click.stop="
                              onSaveBuiltClip(clip);
                              closeDownloadDropdown();
                            "
                          >
                            <DownloadIcon class="h-4 w-4 text-green-500/70 flex-shrink-0" />
                            <div class="flex-1 min-w-0 text-left">
                              <div class="text-xs font-medium">Download</div>
                              <div v-if="clip.built_at" class="text-[10px] text-muted-foreground/50 mt-0.5">
                                {{ formatBuildDate(clip.built_at) }}
                              </div>
                            </div>
                          </button>
                        </div>
                      </Teleport>
                    </div>

                    <!-- More Actions Menu -->
                    <div class="relative" data-action-menu>
                      <button
                        :ref="(el) => setActionMenuButtonRef(el, clip.id)"
                        class="p-1.5 hover:bg-white/10 rounded-md transition-colors text-foreground/50 hover:text-foreground"
                        :class="{ 'bg-white/10 text-foreground': openActionMenuId === clip.id }"
                        title="Clip actions"
                        @click.stop="toggleActionMenu(clip.id)"
                      >
                        <MoreVertical class="h-4 w-4" />
                      </button>

                      <!-- Action Menu Dropdown - Teleported to body -->
                      <Teleport to="body">
                        <div
                          v-if="openActionMenuId === clip.id"
                          class="fixed z-[9999] w-[200px] bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl shadow-black/20 py-1.5 overflow-hidden"
                          :style="getActionMenuPosition(clip.id)"
                          data-action-menu
                          @click.stop
                        >
                          <!-- Edit Clip -->
                          <button
                            class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-violet-500/15 hover:text-violet-400 transition-colors"
                            @click.stop="
                              onEditClip(clip.id);
                              closeActionMenu();
                            "
                          >
                            <Edit3 class="h-4 w-4" />
                            <span>Edit Clip</span>
                          </button>

                          <!-- Play Clip -->
                          <button
                            class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-blue-500/15 hover:text-blue-400 transition-colors"
                            @click.stop="
                              onPlayClip(clip);
                              closeActionMenu();
                            "
                          >
                            <PlayIcon class="h-4 w-4" />
                            <span>Play Clip</span>
                          </button>

                          <!-- Divider -->
                          <div class="my-1.5 border-t border-border/40"></div>

                          <!-- Build Clip -->
                          <button
                            v-if="clip.build_status !== 'building'"
                            class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-green-500/15 hover:text-green-400 transition-colors"
                            @click.stop="
                              onBuildClip(clip);
                              closeActionMenu();
                            "
                          >
                            <Hammer class="h-4 w-4" />
                            <span>Build Clip</span>
                          </button>

                          <!-- Delete (only if not built) -->
                          <template v-if="!hasCompletedBuilds(clip)">
                            <div class="my-1.5 border-t border-border/40"></div>
                            <button
                              class="w-full px-3 py-2 flex items-center gap-3 text-sm text-red-400/90 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                              @click.stop="
                                onDeleteClip(clip.id);
                                closeActionMenu();
                              "
                            >
                              <Trash2 class="h-4 w-4" />
                              <span>Delete Clip</span>
                            </button>
                          </template>
                        </div>
                      </Teleport>
                    </div>
                  </div>
                </div>

                <!-- Metrics Row -->
                <div class="flex items-center flex-wrap gap-1.5 mb-2">
                  <!-- Virality Score -->
                  <div
                    v-if="
                      clip.current_version_virality_score !== undefined && clip.current_version_virality_score !== null
                    "
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
                    :class="getViralityColorClass(clip.current_version_virality_score)"
                    title="Predicted Virality Score"
                  >
                    <Flame class="h-2.5 w-2.5" />
                    <span>{{ Math.round(clip.current_version_virality_score) }}%</span>
                  </div>

                  <!-- Duration -->
                  <div
                    class="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 bg-secondary/40 px-1.5 py-0.5 rounded"
                  >
                    <ClockIcon class="h-2.5 w-2.5 opacity-70" />
                    <span>
                      {{
                        formatDuration((clip.current_version_end_time || 0) - (clip.current_version_start_time || 0))
                      }}
                    </span>
                  </div>

                  <!-- Confidence (Subtle) -->
                  <div
                    v-if="clip.current_version_confidence_score"
                    class="inline-flex items-center gap-1 text-[10px] font-medium px-1"
                    :class="getConfidenceColorClass(clip.current_version_confidence_score)"
                    title="AI Confidence Score"
                  >
                    <BrainIcon class="h-2.5 w-2.5" />
                    <span>{{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%</span>
                  </div>
                </div>

                <!-- Description (if avail) -->
                <p
                  v-if="clip.current_version_detection_reason"
                  class="text-[11px] text-muted-foreground/70 line-clamp-1 mb-1.5 leading-relaxed italic"
                >
                  "{{ clip.current_version_detection_reason }}"
                </p>

                <!-- Footer Info -->
                <div class="flex items-center justify-between text-[10px] text-muted-foreground/50 mt-auto">
                  <div class="flex items-center gap-2">
                    <span class="font-mono">
                      {{ formatTime(clip.current_version_start_time || 0) }} -
                      {{ formatTime(clip.current_version_end_time || 0) }}
                    </span>

                    <!-- Build Status -->
                    <span v-if="clip.build_status === 'building'" class="text-blue-400 flex items-center gap-1">
                      <LoaderIcon class="h-2.5 w-2.5 animate-spin" />
                      Building...
                      <button
                        @click.stop="handleCancelBuild(clip.id)"
                        class="ml-1 p-0.5 hover:bg-red-500/20 rounded transition-colors text-muted-foreground hover:text-red-400"
                        title="Cancel build"
                      >
                        <XIcon class="h-2.5 w-2.5" />
                      </button>
                    </span>
                    <span v-else-if="hasCompletedBuilds(clip)" class="text-green-400 flex items-center gap-1">
                      <CheckIcon class="h-2.5 w-2.5" />
                      {{ getDownloadableFilesCount(clip) || 1 }} File{{
                        (getDownloadableFilesCount(clip) || 1) !== 1 ? 's' : ''
                      }}
                    </span>
                  </div>

                  <!-- Run Info -->
                  <div class="flex items-center gap-2">
                    <span v-if="clip.run_number" class="flex items-center gap-1">
                      <div
                        class="w-1 h-1 rounded-full"
                        :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                      ></div>
                      Run {{ clip.run_number }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Default State -->
      <div v-else class="h-full flex items-center justify-center px-4">
        <div class="text-center max-w-xs">
          <div class="mb-6 flex flex-col items-center">
            <!-- Animated icon container -->
            <div class="relative mb-6">
              <!-- Outer glow ring -->
              <div
                class="absolute inset-0 w-20 h-20 -m-2 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 blur-xl animate-pulse"
              ></div>
              <!-- Icon container -->
              <div
                class="relative w-16 h-16 bg-gradient-to-br from-violet-500/15 to-purple-600/15 rounded-xl flex items-center justify-center border border-violet-500/20 shadow-lg shadow-violet-500/5"
              >
                <Video class="h-7 w-7 text-violet-400" />
              </div>
              <!-- Decorative dots -->
              <div class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-400/40"></div>
              <div class="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 rounded-full bg-purple-400/30"></div>
            </div>

            <h4 class="text-sm font-semibold text-foreground mb-2">No Clips Yet</h4>

            <!-- AI Allowed: Show Detect Clips -->
            <template v-if="isAIAllowed">
              <p class="text-xs text-muted-foreground/80 leading-relaxed mb-6 max-w-[200px]">
                Start detecting clips from your video using AI-powered analysis
              </p>
              <button
                @click="handleDetectClips"
                class="group inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98]"
                title="Detect Clips"
              >
                <Sparkles class="h-3.5 w-3.5" />
                Detect Clips
              </button>
            </template>

            <!-- AI Not Allowed: Show Add Clip -->
            <template v-else>
              <p class="text-xs text-muted-foreground/80 leading-relaxed mb-6 max-w-[200px]">
                Mark sections of your video as clips manually
              </p>
              <button
                @click="handleAddClip"
                class="group inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-lg transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
                title="Add Clip Manually"
              >
                <Plus class="h-3.5 w-3.5" />
                Add Clip
              </button>
              <p class="text-[10px] text-muted-foreground/60 mt-3 max-w-[180px]">
                AI detection is disabled by your organization
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Build Settings Dialog -->
    <ClipBuildSettingsDialog
      v-model="showBuildSettingsDialog"
      :clip="clipToBuild"
      :watermark-settings="watermarkSettings"
      :default-intro="creatorDefaultIntro"
      :default-outro="creatorDefaultOutro"
      :thumbnail-url="videoThumbnailUrl"
      :subtitle-settings="subtitleSettings"
      :initial-aspect-ratios="savedAspectRatios"
      :initial-framing-mode="savedFramingMode"
      :initial-framing-configs="savedFramingConfigs"
      @confirm="onBuildConfirm"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import type { ClipWithVersion, ClipBuild, Prompt } from '@/services/database';
  import {
    PlayIcon,
    BrainIcon,
    CheckCircleIcon,
    XCircleIcon,
    ActivityIcon,
    MicIcon,
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
  } from 'lucide-vue-next';
  import { useAIPermission } from '@/composables/useAIPermission';
  import ClipBuildSettingsDialog, { type BuildSettings } from './ClipBuildSettingsDialog.vue';
  import type { SubtitleSettings, WatermarkSettings, IntroOutroRef } from '@/types';
  import type { AnalyzeSpeakersResponse } from '@/services/speaker-detection-api';
  import type { FramingStrategy as DbFramingStrategy, ParsedStrategyData } from '@/services/database/speaker-detection';

  // Helper to ensure value is boolean (handles string "true"/"false" and numbers)
  function toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value !== 0;
    return Boolean(value);
  }

  // Helper function to convert server API response to Rust-expected format
  function convertServerResponseToRustFormat(response: AnalyzeSpeakersResponse) {
    const strategy = response.strategy;

    return {
      mode: strategy.mode,
      videoType: strategy.video_type,
      speakerCount: Number(response.speaker_count) || 0,
      confidence: Number(response.confidence) || 0,
      targetAspectRatio: strategy.target_aspect_ratio,
      isPortrait: toBoolean(strategy.is_portrait),
      sourceDimensions: {
        width: Number(strategy.source_dimensions?.width) || 1920,
        height: Number(strategy.source_dimensions?.height) || 1080,
      },
      ffmpegFilter: strategy.ffmpeg_filter || '',
      layout: strategy.layout
        ? {
            layoutType: strategy.layout.type,
            topRegion: {
              x: Number(strategy.layout.top_region.x) || 0,
              y: Number(strategy.layout.top_region.y) || 0,
              width: Number(strategy.layout.top_region.width) || 0,
              height: Number(strategy.layout.top_region.height) || 0,
              outputHeightRatio:
                strategy.layout.top_region.output_height_ratio != null
                  ? Number(strategy.layout.top_region.output_height_ratio)
                  : null,
            },
            bottomRegion: {
              x: Number(strategy.layout.bottom_region.x) || 0,
              y: Number(strategy.layout.bottom_region.y) || 0,
              width: Number(strategy.layout.bottom_region.width) || 0,
              height: Number(strategy.layout.bottom_region.height) || 0,
              outputHeightRatio:
                strategy.layout.bottom_region.output_height_ratio != null
                  ? Number(strategy.layout.bottom_region.output_height_ratio)
                  : null,
            },
            splitRatio: Number(strategy.layout.split_ratio) || 0.5,
          }
        : null,
      keyframes: strategy.keyframes
        ? strategy.keyframes.map((kf) => ({
            timestamp: Number(kf.timestamp) || 0,
            cropX: Number(kf.crop_x) || 0,
            cropY: Number(kf.crop_y) || 0,
            faceDetected: toBoolean(kf.face_detected),
          }))
        : null,
      cropRegion: strategy.crop_region
        ? {
            x: Number(strategy.crop_region.x) || 0,
            y: Number(strategy.crop_region.y) || 0,
            width: Number(strategy.crop_region.width) || 0,
            height: Number(strategy.crop_region.height) || 0,
          }
        : null,
      cropCenter: strategy.crop_center
        ? {
            x: Number(strategy.crop_center.x) || 0,
            y: Number(strategy.crop_center.y) || 0,
          }
        : null,
      speakers: null, // Optional, not always needed
      contentRegions: null, // Optional, not always needed
    };
  }

  // Helper function to convert cached DB strategy to Rust-expected format
  function convertToRustFramingStrategy(strategy: DbFramingStrategy, data: ParsedStrategyData) {
    return {
      mode: strategy.mode,
      videoType: strategy.video_type,
      speakerCount: Number(strategy.speaker_count) || 0,
      confidence: Number(strategy.confidence) || 0,
      targetAspectRatio: strategy.target_aspect_ratio,
      isPortrait: true,
      sourceDimensions: {
        width: Number(strategy.source_width) || 1920,
        height: Number(strategy.source_height) || 1080,
      },
      ffmpegFilter: data.ffmpeg_filter || '',
      layout: data.layout
        ? {
            layoutType: data.layout.type,
            topRegion: {
              x: Number(data.layout.top_region.x) || 0,
              y: Number(data.layout.top_region.y) || 0,
              width: Number(data.layout.top_region.width) || 0,
              height: Number(data.layout.top_region.height) || 0,
              outputHeightRatio:
                data.layout.top_region.output_height_ratio != null
                  ? Number(data.layout.top_region.output_height_ratio)
                  : null,
            },
            bottomRegion: {
              x: Number(data.layout.bottom_region.x) || 0,
              y: Number(data.layout.bottom_region.y) || 0,
              width: Number(data.layout.bottom_region.width) || 0,
              height: Number(data.layout.bottom_region.height) || 0,
              outputHeightRatio:
                data.layout.bottom_region.output_height_ratio != null
                  ? Number(data.layout.bottom_region.output_height_ratio)
                  : null,
            },
            splitRatio: Number(data.layout.split_ratio) || 0.5,
          }
        : null,
      keyframes: data.keyframes
        ? data.keyframes.map((kf) => ({
            timestamp: Number(kf.timestamp) || 0,
            cropX: Number(kf.crop_x) || 0,
            cropY: Number(kf.crop_y) || 0,
            faceDetected: toBoolean(kf.face_detected),
          }))
        : null,
      cropRegion: data.crop_region
        ? {
            x: Number(data.crop_region.x) || 0,
            y: Number(data.crop_region.y) || 0,
            width: Number(data.crop_region.width) || 0,
            height: Number(data.crop_region.height) || 0,
          }
        : null,
      cropCenter: data.crop_center
        ? {
            x: Number(data.crop_center.x) || 0,
            y: Number(data.crop_center.y) || 0,
          }
        : null,
      speakers: null,
      contentRegions: null,
    };
  }

  // Props
  interface ClipsTabProps {
    projectId: string | null;
    clips: ClipWithVersion[];
    isGenerating: boolean;
    generationProgress: number;
    generationStage: string;
    generationMessage: string;
    generationError: string;
    playingClipId: string | null;
    isPlayingSegments: boolean;
    hoveredTimelineClipId: string | null;
    videoDuration: number;
    prompts: Prompt[];
    transcriptData: any;
    subtitleSettings?: SubtitleSettings | null;
    maxWordsForAspectRatio?: number;
    watermarkSettings?: WatermarkSettings | null;
    // Creator profile default assets (auto-applied when building clips)
    creatorDefaultIntro?: IntroOutroRef | null;
    creatorDefaultOutro?: IntroOutroRef | null;
    videoThumbnailUrl?: string | null;
    hideHeader?: boolean;
  }

  const props = withDefaults(defineProps<ClipsTabProps>(), {
    projectId: null,
    clips: () => [],
    hideHeader: false,
    isGenerating: false,
    generationProgress: 0,
    generationStage: '',
    generationMessage: '',
    generationError: '',
    playingClipId: null,
    isPlayingSegments: false,
    hoveredTimelineClipId: null,
    videoDuration: 0,
    prompts: () => [],
    subtitleSettings: null,
    maxWordsForAspectRatio: 3,
    watermarkSettings: null,
    creatorDefaultIntro: null,
    creatorDefaultOutro: null,
    videoThumbnailUrl: null,
  });

  // Emits
  const emit = defineEmits<{
    detectClips: [];
    cancelDetection: [];
    deleteClip: [clipId: string];
    playClip: [clip: ClipWithVersion];
    clipHover: [clipId: string];
    seekVideo: [time: number];
    scrollToTimeline: [];
    refreshClips: [];
    editClip: [clipId: string];
    addClip: [];
  }>();

  // AI Permission check
  const { isAIAllowed } = useAIPermission();

  // State
  const hoveredClipId = ref<string | null>(null);
  const clipsScrollContainer = ref<HTMLElement | null>(null);
  const clipElements = ref<Map<string, HTMLElement>>(new Map());
  const showBuildSettingsDialog = ref(false);
  const clipToBuild = ref<ClipWithVersion | null>(null);
  const openDownloadDropdownId = ref<string | null>(null);
  const dropdownButtonRefs = ref<Map<string, HTMLElement>>(new Map());

  // Action menu dropdown state
  const openActionMenuId = ref<string | null>(null);
  const actionMenuButtonRefs = ref<Map<string, HTMLElement>>(new Map());

  // Aspect framing settings loaded from clip editor
  const savedAspectRatios = ref<string[] | null>(null);
  const savedFramingMode = ref<'auto' | 'manual' | null>(null);
  const savedFramingConfigs = ref<import('@/types').ManualFramingConfigs | null>(null);

  // Thumbnail cache for clip cards
  const clipThumbnailCache = ref<Map<string, string>>(new Map());

  // Close dropdowns when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-action-menu]')) {
      if (openDownloadDropdownId.value !== null) {
        openDownloadDropdownId.value = null;
      }
      if (openActionMenuId.value !== null) {
        openActionMenuId.value = null;
      }
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    loadClipThumbnails();
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Load thumbnails when clips change
  watch(
    () => props.clips,
    () => {
      loadClipThumbnails();
    },
    { deep: true }
  );

  // Load clip thumbnails into cache
  async function loadClipThumbnails() {
    const clipsWithThumbnails = props.clips.filter(
      (clip) => clip.built_thumbnail_path && !clipThumbnailCache.value.has(clip.id)
    );

    if (clipsWithThumbnails.length === 0) return;

    const { invoke } = await import('@tauri-apps/api/core');

    // Load thumbnails in parallel (max 5 at a time)
    const batchSize = 5;
    for (let i = 0; i < clipsWithThumbnails.length; i += batchSize) {
      const batch = clipsWithThumbnails.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (clip) => {
          try {
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: clip.built_thumbnail_path,
            });
            clipThumbnailCache.value.set(clip.id, dataUrl);
          } catch (err) {
            console.warn(`[ClipsTab] Failed to load thumbnail for clip ${clip.id}:`, err);
          }
        })
      );
    }
  }

  // Get thumbnail URL for a clip
  function getClipThumbnail(clipId: string): string | null {
    return clipThumbnailCache.value.get(clipId) || null;
  }

  // Sorted clips: by run_number descending (newest first), then by virality descending
  const sortedClips = computed(() => {
    return [...props.clips].sort((a, b) => {
      // First, put manual clips at the bottom
      const aIsManual = a.session_prompt === 'Manual clip creation';
      const bIsManual = b.session_prompt === 'Manual clip creation';
      if (aIsManual !== bIsManual) {
        return aIsManual ? 1 : -1; // Manual clips go to the bottom
      }

      // For non-manual clips: sort by run_number descending (newest run first)
      const runA = a.run_number || 0;
      const runB = b.run_number || 0;
      if (runB !== runA) {
        return runB - runA;
      }

      // Then sort by virality score descending (highest first)
      const viralityA = a.current_version_virality_score || 0;
      const viralityB = b.current_version_virality_score || 0;
      return viralityB - viralityA;
    });
  });

  // Computed properties for progress display
  const stageIcon = computed(() => {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
      case 'checking_cache':
        return PlayIcon;
      case 'extracting_chunks':
        return ActivityIcon;
      case 'transcribing':
      case 'transcribing_chunks':
        return MicIcon;
      case 'analyzing':
      case 'detecting_clips':
        return BrainIcon;
      case 'validating':
        return ActivityIcon;
      case 'completed':
        return CheckCircleIcon;
      case 'error':
        return XCircleIcon;
      default:
        return PlayIcon;
    }
  });

  const stageIconClass = computed(() => {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
      case 'checking_cache':
        return 'text-blue-500';
      case 'extracting_chunks':
        return 'text-cyan-500';
      case 'transcribing':
      case 'transcribing_chunks':
        return 'text-yellow-500';
      case 'analyzing':
      case 'detecting_clips':
        return 'text-purple-500';
      case 'validating':
        return 'text-orange-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  });

  const stageTitle = computed(() => {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
        return 'Initializing';
      case 'checking_cache':
        return 'Checking Cache';
      case 'extracting_chunks':
        return 'Extracting Audio';
      case 'transcribing':
      case 'transcribing_chunks':
        return 'Transcribing Audio';
      case 'analyzing':
      case 'detecting_clips':
        return 'Detecting Clips';
      case 'validating':
        return 'Validating Results';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Processing';
    }
  });

  const stageDescription = computed(() => {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
        return 'Preparing clip detection...';
      case 'checking_cache':
        return 'Checking for cached transcripts...';
      case 'extracting_chunks':
        return 'Extracting audio chunks from video...';
      case 'transcribing':
      case 'transcribing_chunks':
        return 'Converting audio to text using AI...';
      case 'analyzing':
      case 'detecting_clips':
        return 'Analyzing transcript for clip-worthy moments...';
      case 'validating':
        return 'Validating timestamps and refining clips...';
      case 'completed':
        return 'Clips have been successfully generated!';
      case 'error':
        return 'An error occurred during processing.';
      default:
        return 'Processing video...';
    }
  });

  // Watch for timeline hover changes to clear internal hover state
  watch(
    () => props.hoveredTimelineClipId,
    (newTimelineHoverId) => {
      if (newTimelineHoverId) {
        hoveredClipId.value = null;
      }
    }
  );

  // Watch for playing clip changes to clear hover state when playback starts
  watch(
    () => props.playingClipId,
    (newPlayingId) => {
      if (newPlayingId) {
        hoveredClipId.value = null;
      }
    }
  );

  // Functions
  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTime(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getBuildFileName(filePath: string | null): string {
    if (!filePath) return 'Built clip';
    return filePath.split(/[/\\]/).pop() || 'Built clip';
  }

  function formatBuildDate(timestamp: number | null): string {
    if (!timestamp) return '';
    // Timestamps are stored in seconds, convert to milliseconds for Date
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function hasCompletedBuilds(clip: ClipWithVersion): boolean {
    // Check for builds in the new builds array
    if (clip.builds && clip.builds.some((b) => b.status === 'completed')) {
      return true;
    }
    // Fallback to legacy built_file_path
    return clip.build_status === 'completed' && !!clip.built_file_path;
  }

  function getCompletedBuilds(clip: ClipWithVersion): ClipBuild[] {
    if (!clip.builds) return [];
    return clip.builds.filter((b) => b.status === 'completed');
  }

  // Parse output paths from a build (supports both new output_paths array and legacy single file_path)
  function getOutputPathsFromBuild(build: ClipBuild): string[] {
    // Try parsing output_paths JSON array first
    if (build.output_paths) {
      try {
        const paths = JSON.parse(build.output_paths);
        if (Array.isArray(paths) && paths.length > 0) {
          return paths;
        }
      } catch {
        // Fall through to single file_path
      }
    }
    // Fallback to single file_path
    if (build.file_path) {
      return [build.file_path];
    }
    return [];
  }

  // Get all downloadable files from all completed builds for a clip
  interface DownloadableFile {
    build: ClipBuild;
    filePath: string;
    aspectRatio: string | null; // Extracted from filename (e.g., "16-9" from "clip_16-9_1.mp4")
  }

  function getDownloadableFiles(clip: ClipWithVersion): DownloadableFile[] {
    const completedBuilds = getCompletedBuilds(clip);
    const files: DownloadableFile[] = [];

    for (const build of completedBuilds) {
      const paths = getOutputPathsFromBuild(build);
      for (const filePath of paths) {
        // Extract aspect ratio from filename (e.g., "clip_name_16-9_1.mp4" -> "16:9")
        const fileName = filePath.split(/[/\\]/).pop() || '';
        const aspectRatioMatch = fileName.match(/_(\d+-\d+)_\d+\.\w+$/);
        const aspectRatio = aspectRatioMatch ? aspectRatioMatch[1].replace('-', ':') : null;

        files.push({
          build,
          filePath,
          aspectRatio,
        });
      }
    }

    return files;
  }

  // Get total count of downloadable files for a clip
  function getDownloadableFilesCount(clip: ClipWithVersion): number {
    return getDownloadableFiles(clip).length;
  }

  function getLoadingMessage(): string {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
        return 'Initializing detection...';
      case 'checking_cache':
        return 'Checking for cached data...';
      case 'extracting_chunks':
        return 'Extracting audio chunks...';
      case 'transcribing':
      case 'transcribing_chunks':
        return 'Transcribing audio...';
      case 'analyzing':
      case 'detecting_clips':
        return 'Analyzing for clips...';
      case 'validating':
        return 'Validating results...';
      case 'completed':
        return 'Finalizing results...';
      case 'error':
        return 'Something went wrong';
      default:
        return 'Processing...';
    }
  }

  // Compact message for inline progress bar
  function getCompactMessage(): string {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
        return 'Starting...';
      case 'checking_cache':
        return 'Checking...';
      case 'extracting_chunks':
        return 'Extracting...';
      case 'transcribing':
      case 'transcribing_chunks':
        return 'Transcribing...';
      case 'analyzing':
      case 'detecting_clips':
        return 'Analyzing...';
      case 'validating':
        return 'Validating...';
      case 'completed':
        return 'Done!';
      case 'error':
        return 'Error';
      default:
        return 'Detecting...';
    }
  }

  function getViralityColorClass(score: number | null | undefined): string {
    if (!score) return 'bg-muted/50 text-muted-foreground';
    if (score >= 90)
      return 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]';
    if (score >= 80) return 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30';
    if (score >= 60) return 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30';
    return 'bg-muted/50 text-muted-foreground';
  }

  function getConfidenceColorClass(score: number | null | undefined): string {
    if (!score) return 'text-muted-foreground';
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-muted-foreground';
  }

  // Get actual clip timing from segments (respects timeline edits)
  // Falls back to version times if no segments available
  function getClipTiming(clip: ClipWithVersion): { startTime: number; endTime: number; duration: number } {
    const segments = clip.current_version_segments;

    if (segments && segments.length > 0) {
      // Sort segments by start time and get the range
      const sorted = [...segments].sort((a, b) => a.start_time - b.start_time);
      const startTime = sorted[0].start_time;
      const endTime = sorted[sorted.length - 1].end_time;
      return {
        startTime,
        endTime,
        duration: endTime - startTime,
      };
    }

    // Fallback to version times
    const startTime = clip.current_version_start_time || 0;
    const endTime = clip.current_version_end_time || 0;
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
    };
  }

  function getTimeEstimate(): string {
    switch (props.generationStage) {
      case 'starting':
      case 'initializing':
        return 'This usually takes about 30 seconds';
      case 'checking_cache':
        return 'Checking for existing data...';
      case 'extracting_chunks':
        return 'This usually takes 1-2 minutes';
      case 'transcribing':
      case 'transcribing_chunks':
        return getTranscriptionEstimate();
      case 'analyzing':
      case 'detecting_clips':
        return 'This typically takes 1-2 minutes';
      case 'validating':
        return 'Almost done... 30 seconds remaining';
      case 'completed':
        return 'Finishing up...';
      case 'error':
        return 'Please try again';
      default:
        return 'This may take a few minutes depending on video length';
    }
  }

  function getTranscriptionEstimate(): string {
    if (!props.videoDuration || props.videoDuration === 0) {
      return 'This typically takes 2-10 minutes depending on video length';
    }

    const durationInMinutes = Math.round(props.videoDuration / 60);

    if (durationInMinutes <= 5) {
      return 'less than 2 minutes';
    } else if (durationInMinutes <= 15) {
      return '2-5 minutes';
    } else if (durationInMinutes <= 30) {
      return '5-10 minutes';
    } else if (durationInMinutes <= 60) {
      return '10-20 minutes';
    } else {
      return '15-30 minutes';
    }
  }

  function setDropdownButtonRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      dropdownButtonRefs.value.set(clipId, el);
    } else {
      dropdownButtonRefs.value.delete(clipId);
    }
  }

  function getDropdownPosition(clipId: string): Record<string, string> {
    const button = dropdownButtonRefs.value.get(clipId);
    if (!button) {
      return { top: '0px', right: '0px' };
    }

    const rect = button.getBoundingClientRect();
    const dropdownMaxHeight = 300;
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Position dropdown's right edge aligned with button's right edge
    const right = viewportWidth - rect.right;

    // Calculate vertical position - prefer below, but flip above if not enough space
    let top = rect.bottom + 4;

    if (top + dropdownMaxHeight > viewportHeight - padding) {
      top = rect.top - dropdownMaxHeight - 4;
      if (top < padding) {
        top = padding;
      }
    }

    return {
      top: `${top}px`,
      right: `${Math.max(right, padding)}px`,
    };
  }

  function toggleDownloadDropdown(clipId: string) {
    // Close action menu if open
    if (openActionMenuId.value !== null) {
      openActionMenuId.value = null;
    }
    openDownloadDropdownId.value = openDownloadDropdownId.value === clipId ? null : clipId;
  }

  function closeDownloadDropdown() {
    openDownloadDropdownId.value = null;
  }

  // Action menu functions
  function setActionMenuButtonRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      actionMenuButtonRefs.value.set(clipId, el);
    } else {
      actionMenuButtonRefs.value.delete(clipId);
    }
  }

  function toggleActionMenu(clipId: string) {
    // Close download dropdown if open
    if (openDownloadDropdownId.value !== null) {
      openDownloadDropdownId.value = null;
    }
    openActionMenuId.value = openActionMenuId.value === clipId ? null : clipId;
  }

  function closeActionMenu() {
    openActionMenuId.value = null;
  }

  function getActionMenuPosition(clipId: string): Record<string, string> {
    const button = actionMenuButtonRefs.value.get(clipId);
    if (!button) {
      return { top: '0px', left: '0px' };
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 200;
    const menuMaxHeight = 280;
    const padding = 8;

    // Align to right edge of button
    let left = rect.right - menuWidth;

    // Ensure it doesn't go off the left edge
    if (left < padding) {
      left = padding;
    }

    // Ensure it doesn't go off the right edge
    const viewportWidth = window.innerWidth;
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding;
    }

    // Position below button
    let top = rect.bottom + 4;
    const viewportHeight = window.innerHeight;

    // Flip above if not enough space below
    if (top + menuMaxHeight > viewportHeight - padding) {
      top = rect.top - menuMaxHeight - 4;
      if (top < padding) {
        top = padding;
      }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  }

  function handleDetectClips() {
    emit('detectClips');
  }

  function handleCancelDetection() {
    emit('cancelDetection');
  }

  function handleAddClip() {
    emit('addClip');
  }

  async function handleCancelBuild(clipId: string) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<boolean>('cancel_clip_build', { clipId });

      if (result) {
        console.log('[ClipsTab] Successfully cancelled clip build:', clipId);

        // Update the clip status to cancelled
        const { updateClipBuildStatus } = await import('@/services/database');
        await updateClipBuildStatus(clipId, 'pending', { error: 'Cancelled by user' });

        // Refresh clips to show updated status
        emit('refreshClips');

        // Show toast
        const toastComposable = await import('@/composables/useToast');
        const { success: showSuccessToast } = toastComposable.useToast();
        showSuccessToast('Build Cancelled', 'Clip build was cancelled. No credits were charged.');
      } else {
        console.log('[ClipsTab] No active build found to cancel:', clipId);
      }
    } catch (error) {
      console.error('[ClipsTab] Failed to cancel clip build:', error);
      showError('Failed to Cancel', 'Could not cancel the clip build. Please try again.');
    }
  }

  function onDeleteClip(clipId: string) {
    emit('deleteClip', clipId);
  }

  function onPlayClip(clip: ClipWithVersion) {
    emit('playClip', clip);
  }

  function onEditClip(clipId: string) {
    emit('editClip', clipId);
  }

  function onClipClick(clipId: string) {
    const clip = props.clips.find((c) => c.id === clipId);

    if (clip?.current_version_segments && clip.current_version_segments.length > 0) {
      const sortedSegments = [...clip.current_version_segments].sort((a, b) => a.start_time - b.start_time);
      const firstSegment = sortedSegments[0];
      emit('seekVideo', firstSegment.start_time);
    }

    hoveredClipId.value = hoveredClipId.value === clipId ? null : clipId;
    emit('clipHover', clipId);
    emit('scrollToTimeline');
  }

  function setClipRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      clipElements.value.set(clipId, el);
    } else {
      clipElements.value.delete(clipId);
    }
  }

  function scrollClipIntoView(clipId: string) {
    const clipElement = clipElements.value.get(clipId);
    const container = clipsScrollContainer.value;

    if (clipElement && container) {
      clipElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }

  // Clip building functions
  async function onBuildClip(clip: ClipWithVersion) {
    if (!props.projectId) {
      console.error('[ClipsTab] No project ID available for clip build');
      return;
    }

    if (!clip.current_version_segments || clip.current_version_segments.length === 0) {
      console.error('[ClipsTab] No segments found for clip build');
      return;
    }

    // Load saved aspect framing settings from clip editor
    try {
      const { getFullClipEdit } = await import('@/services/database');
      const clipEdit = await getFullClipEdit(clip.id);

      if (clipEdit) {
        const editData = JSON.parse(clipEdit.edit.edit_data);

        if (editData.aspectFraming) {
          savedAspectRatios.value = editData.aspectFraming.selectedRatios || null;
          savedFramingMode.value = editData.aspectFraming.framingMode || null;
          savedFramingConfigs.value = editData.aspectFraming.configs || null;
          console.log('[ClipsTab] Loaded saved aspect framing settings:', {
            ratios: savedAspectRatios.value,
            mode: savedFramingMode.value,
            configCount: savedFramingConfigs.value ? Object.keys(savedFramingConfigs.value).length : 0,
          });
        } else {
          // No saved settings, reset to null
          savedAspectRatios.value = null;
          savedFramingMode.value = null;
          savedFramingConfigs.value = null;
        }
      } else {
        // No clip edit data, reset to null
        savedAspectRatios.value = null;
        savedFramingMode.value = null;
        savedFramingConfigs.value = null;
      }
    } catch (err) {
      console.warn('[ClipsTab] Could not load saved aspect framing settings:', err);
      savedAspectRatios.value = null;
      savedFramingMode.value = null;
      savedFramingConfigs.value = null;
    }

    clipToBuild.value = clip;
    showBuildSettingsDialog.value = true;
  }

  // Track if we're currently processing a build to prevent duplicates
  const isBuildInProgress = ref(false);

  async function onBuildConfirm(settings: BuildSettings) {
    const clip = clipToBuild.value;
    if (!clip || !props.projectId) {
      console.error('[ClipsTab] No clip or project ID available for build');
      return;
    }

    // Prevent duplicate builds
    if (isBuildInProgress.value) {
      console.warn('[ClipsTab] Build already in progress, ignoring duplicate request');
      return;
    }
    isBuildInProgress.value = true;

    try {
      console.log('[ClipsTab] Starting clip build for:', clip.id, 'with settings:', settings);
      console.log('[ClipsTab] Aspect ratios received:', settings.aspectRatios);

      const { updateClipBuildStatus, getRawVideosByProjectId, getWatermarkImage, createClipBuild, getClipBuilds } =
        await import('@/services/database');

      // Update database status to building
      await updateClipBuildStatus(clip.id, 'building', { progress: 0 });

      // Create build record to get the build number
      let buildNumber = 1;
      try {
        // Get existing builds to determine the next build number
        const existingBuilds = await getClipBuilds(clip.id);
        buildNumber = existingBuilds.length + 1;
      } catch {
        // Table might not exist yet
        buildNumber = 1;
      }

      // Create the build record now (before starting the build)
      let buildId: string | null = null;
      try {
        buildId = await createClipBuild(clip.id, {
          aspectRatios: settings.aspectRatios,
          quality: settings.quality,
          frameRate: settings.frameRate,
          outputFormat: settings.format,
          includeSubtitles: props.subtitleSettings?.enabled ?? false,
        });
        console.log('[ClipsTab] Created build record:', buildId, 'with build number:', buildNumber);
      } catch (err) {
        console.warn('[ClipsTab] Could not create build record:', err);
      }

      // Get the project video file path
      const rawVideos = await getRawVideosByProjectId(props.projectId);
      if (rawVideos.length === 0) {
        throw new Error('No project video found');
      }

      const projectVideo = rawVideos[0];

      // IMPORTANT: Reload segments from database to get latest edits from timeline
      // The clip object in props may have stale data if user edited segments on timeline
      const { getClipSegmentsByVersionId } = await import('@/services/database/clip-segments');
      let freshSegments = clip.current_version_segments || [];

      if (clip.current_version_id) {
        try {
          const dbSegments = await getClipSegmentsByVersionId(clip.current_version_id);
          if (dbSegments.length > 0) {
            freshSegments = dbSegments;
            console.log(
              '[ClipsTab] Loaded fresh segments from database:',
              freshSegments.map((s) => ({
                index: s.segment_index,
                start: s.start_time,
                end: s.end_time,
              }))
            );
          }
        } catch (err) {
          console.warn('[ClipsTab] Could not reload segments from database, using cached data:', err);
        }
      }

      // Prepare segments for the Rust backend
      const segments = freshSegments.map((segment) => ({
        id: segment.id,
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration,
        transcript: segment.transcript,
      }));

      // Call the Tauri clip building command
      const { invoke } = await import('@tauri-apps/api/core');

      // Get transcript data
      const transcriptWords = props.transcriptData?.words || [];
      const transcriptSegments = props.transcriptData?.whisperSegments || [];

      // Prepare watermark settings if enabled
      // Now supports per-aspect-ratio watermark files - each ratio can use a completely different watermark
      let watermarkSettings = null;
      if (settings.watermark && settings.watermark.enabled && settings.watermark.watermarkId) {
        const defaultWatermarkImage = await getWatermarkImage(settings.watermark.watermarkId);
        if (defaultWatermarkImage) {
          // Build per-ratio settings with resolved file paths
          // Each ratio can have its own watermark image AND position settings
          const buildPerRatioSettings: Record<
            string,
            {
              watermarkId: string | null;
              filePath: string | null;
              width: number | null;
              height: number | null;
              position: { x: number; y: number; opacity: number; scale: number } | null;
            } | null
          > = {};

          // Process each aspect ratio that might be built
          const allRatios = ['16:9', '9:16', '1:1', '4:5'];
          for (const ratio of allRatios) {
            const perRatioConfig =
              settings.watermark.perRatioSettings?.[ratio as keyof typeof settings.watermark.perRatioSettings];

            if (perRatioConfig === null) {
              // Watermark explicitly disabled for this ratio
              buildPerRatioSettings[ratio] = null;
              console.log(`[ClipsTab] Watermark disabled for ${ratio}`);
            } else if (perRatioConfig) {
              // Ratio has specific settings
              const ratioWatermarkId = perRatioConfig.watermarkId;
              let ratioFilePath = defaultWatermarkImage.file_path;
              let ratioWidth = defaultWatermarkImage.width ?? null;
              let ratioHeight = defaultWatermarkImage.height ?? null;

              // If this ratio has a different watermark, fetch its file info
              if (ratioWatermarkId && ratioWatermarkId !== settings.watermark.watermarkId) {
                const ratioWatermarkImage = await getWatermarkImage(ratioWatermarkId);
                if (ratioWatermarkImage) {
                  ratioFilePath = ratioWatermarkImage.file_path;
                  ratioWidth = ratioWatermarkImage.width ?? null;
                  ratioHeight = ratioWatermarkImage.height ?? null;
                  console.log(`[ClipsTab] Using different watermark for ${ratio}: ${ratioWatermarkImage.name}`);
                }
              }

              // Use per-ratio position if available, otherwise fall back to default
              const position = perRatioConfig.position || {
                x: settings.watermark.positionX,
                y: settings.watermark.positionY,
                opacity: settings.watermark.opacity,
                scale: settings.watermark.scale,
              };

              buildPerRatioSettings[ratio] = {
                watermarkId: ratioWatermarkId || settings.watermark.watermarkId,
                filePath: ratioFilePath,
                width: ratioWidth,
                height: ratioHeight,
                position,
              };
            } else {
              // No per-ratio config, use default watermark with default position
              buildPerRatioSettings[ratio] = {
                watermarkId: settings.watermark.watermarkId,
                filePath: defaultWatermarkImage.file_path,
                width: defaultWatermarkImage.width ?? null,
                height: defaultWatermarkImage.height ?? null,
                position: {
                  x: settings.watermark.positionX,
                  y: settings.watermark.positionY,
                  opacity: settings.watermark.opacity,
                  scale: settings.watermark.scale,
                },
              };
            }
          }

          watermarkSettings = {
            enabled: true,
            watermarkId: settings.watermark.watermarkId,
            filePath: defaultWatermarkImage.file_path,
            width: defaultWatermarkImage.width ?? null,
            height: defaultWatermarkImage.height ?? null,
            positionX: settings.watermark.positionX,
            positionY: settings.watermark.positionY,
            opacity: settings.watermark.opacity,
            scale: settings.watermark.scale,
            // Per-ratio settings with resolved file paths
            perRatioSettings: buildPerRatioSettings,
          };
          const defaultWatermarkId = settings.watermark?.watermarkId;
          console.log('[ClipsTab] Watermark settings for build:', {
            defaultWatermark: defaultWatermarkImage.name,
            selectedRatios: settings.aspectRatios,
            perRatioSettings: Object.entries(buildPerRatioSettings).map(([ratio, config]) => ({
              ratio,
              enabled: config !== null,
              watermarkId: config?.watermarkId,
              hasCustomWatermark: config?.watermarkId !== defaultWatermarkId,
            })),
          });
        }
      }

      // Load audio settings for the project
      const { getProjectAudioSettings, getFullClipEdit } = await import('@/services/database');
      let audioSettings = null;
      let videoFilterSegments = null; // Time-based video filter segments from clip editor
      let textOverlaysForExport: Array<{
        id: string;
        text: string;
        startTime: number;
        endTime: number;
        positionX: number;
        positionY: number;
        style: any;
        animation: string;
        perRatioConfigs?: Record<string, { position: { x: number; y: number }; style: any }>;
        previewHeight?: number; // Height of preview container for proper font scaling
      }> | null = null;

      let stickersForExport: Array<{
        id: string;
        stickerPath: string;
        stickerType: string;
        startTime: number;
        endTime: number;
        positionX: number;
        positionY: number;
        scale: number;
        rotation: number;
        animation: string;
        perRatioConfigs?: Record<string, { position: { x: number; y: number }; scale: number; rotation: number }>;
      }> | null = null;

      let clipWatermarksForExport: Array<{
        id: string;
        watermarkPath: string;
        startTime: number;
        endTime: number;
        positionX: number;
        positionY: number;
        scale: number;
        opacity: number;
        perRatioConfigs?: Record<string, { position: { x: number; y: number }; scale: number; opacity: number }>;
      }> | null = null;

      try {
        // Load project-level audio settings
        const projectAudioSettings = await getProjectAudioSettings(props.projectId);
        console.log('[ClipsTab] Loaded project audio settings:', projectAudioSettings);

        // Load clip-level audio settings from clip edit data
        const clipEdit = await getFullClipEdit(clip.id);
        let originalAudioDb: number | undefined;
        let trackDbValues: Record<string, number> = {};
        let musicTracks: Array<{
          filePath: string;
          gainDb: number;
          fadeIn: number;
          fadeOut: number;
          startTime: number;
          endTime: number;
          isMuted: boolean;
        }> = [];

        if (clipEdit) {
          const editData = JSON.parse(clipEdit.edit.edit_data);
          originalAudioDb = editData.originalDb;
          trackDbValues = editData.trackDbValues || {};

          // Extract filter segments for video color grading (assign to outer scope variable)
          if (editData.filterSegments && Array.isArray(editData.filterSegments)) {
            // New format: array of filter segments with start/end times
            videoFilterSegments = editData.filterSegments.map((seg: any) => ({
              id: seg.id,
              startTime: seg.startTime,
              endTime: seg.endTime,
              settings: {
                preset: seg.settings?.preset || null,
                brightness: seg.settings?.brightness || 0,
                contrast: seg.settings?.contrast || 0,
                saturation: seg.settings?.saturation || 0,
                hue: seg.settings?.hue || 0,
                temperature: seg.settings?.temperature || 0,
                vignette: seg.settings?.vignette || 0,
                sharpen: seg.settings?.sharpen || 0,
                fade: seg.settings?.fade || 0,
              },
            }));
            console.log('[ClipsTab] Loaded video filter segments:', videoFilterSegments);
          } else if (editData.filter) {
            // Legacy format: single filter settings covering entire clip
            const clipDuration = segments.reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
            videoFilterSegments = [
              {
                id: 'filter-legacy',
                startTime: 0,
                endTime: clipDuration,
                settings: {
                  preset: editData.filter.preset || null,
                  brightness: editData.filter.brightness || 0,
                  contrast: editData.filter.contrast || 0,
                  saturation: editData.filter.saturation || 0,
                  hue: editData.filter.hue || 0,
                  temperature: editData.filter.temperature || 0,
                  vignette: editData.filter.vignette || 0,
                  sharpen: editData.filter.sharpen || 0,
                  fade: editData.filter.fade || 0,
                },
              },
            ];
            console.log('[ClipsTab] Converted legacy filter to segment:', videoFilterSegments);
          }

          // Convert audio tracks to the format needed for FFmpeg
          // Filter out muted tracks (unless solo mode is active)
          const hasSoloTrack = clipEdit.audioTracks.some((t) => t.is_solo);
          musicTracks = clipEdit.audioTracks
            .filter((track) => {
              // If any track is solo'd, only include solo'd tracks
              if (hasSoloTrack) {
                return track.is_solo && !track.is_muted;
              }
              // Otherwise, include all non-muted tracks
              return !track.is_muted;
            })
            .map((track) => ({
              filePath: track.file_path,
              gainDb: trackDbValues[track.id] ?? 0,
              fadeIn: track.fade_in,
              fadeOut: track.fade_out,
              startTime: track.start_time,
              endTime: track.end_time,
              isMuted: Boolean(track.is_muted),
            }));
        }

        // Merge project-level and clip-level audio settings
        audioSettings = {
          ...projectAudioSettings,
          originalAudioDb,
          musicTracks: musicTracks.length > 0 ? musicTracks : undefined,
        };
        console.log('[ClipsTab] Final merged audio settings:', audioSettings);

        // Extract text overlays for burning into video
        if (clipEdit && clipEdit.textOverlays && clipEdit.textOverlays.length > 0) {
          textOverlaysForExport = clipEdit.textOverlays.map((overlay) => ({
            id: overlay.id,
            text: overlay.text,
            startTime: overlay.start_time,
            endTime: overlay.end_time,
            positionX: overlay.position_x,
            positionY: overlay.position_y,
            style: JSON.parse(overlay.style_data || '{}'),
            animation: overlay.animation || 'none',
            // Include per-aspect-ratio configurations for correct text placement in each output
            perRatioConfigs: overlay.per_ratio_configs_data ? JSON.parse(overlay.per_ratio_configs_data) : undefined,
          }));
          console.log('[ClipsTab] Loaded text overlays for export:', textOverlaysForExport.length);
        }

        // Extract stickers for burning into video
        if (clipEdit && clipEdit.stickers && clipEdit.stickers.length > 0) {
          stickersForExport = clipEdit.stickers.map((sticker) => ({
            id: sticker.id,
            stickerPath: sticker.sticker_path,
            stickerType: sticker.sticker_type,
            startTime: sticker.start_time,
            endTime: sticker.end_time,
            positionX: sticker.position_x,
            positionY: sticker.position_y,
            scale: sticker.scale,
            rotation: sticker.rotation,
            animation: sticker.animation || 'none',
            // Include per-aspect-ratio configurations for correct sticker placement in each output
            perRatioConfigs: sticker.per_ratio_configs_data ? JSON.parse(sticker.per_ratio_configs_data) : undefined,
          }));
          console.log('[ClipsTab] Loaded stickers for export:', stickersForExport.length);
        }

        // Extract clip watermarks for burning into video
        if (clipEdit && clipEdit.watermarks && clipEdit.watermarks.length > 0) {
          clipWatermarksForExport = clipEdit.watermarks.map((watermark) => ({
            id: watermark.id,
            watermarkPath: watermark.watermark_path,
            startTime: watermark.start_time,
            endTime: watermark.end_time,
            positionX: watermark.position_x,
            positionY: watermark.position_y,
            scale: watermark.scale,
            opacity: watermark.opacity,
            // Include per-aspect-ratio configurations for correct watermark placement in each output
            perRatioConfigs: watermark.per_ratio_configs_data
              ? JSON.parse(watermark.per_ratio_configs_data)
              : undefined,
          }));
          console.log('[ClipsTab] Loaded clip watermarks for export:', clipWatermarksForExport.length);
        }
      } catch (err) {
        console.warn('[ClipsTab] Could not load audio settings:', err);
      }

      // Check if we need speaker detection for portrait (9:16) exports
      let framingStrategy = null;
      const portraitRatios = ['9:16', '4:5'];
      const hasPortraitRatio = settings.aspectRatios.some((ratio) => portraitRatios.includes(ratio));

      if (hasPortraitRatio) {
        // Check if manual framing mode is selected
        const hasManualConfigs =
          settings.framingMode === 'manual' &&
          settings.manualFramingConfigs &&
          Object.keys(settings.manualFramingConfigs).length > 0;

        if (hasManualConfigs) {
          // For manual mode with per-ratio configs, we'll need to build each ratio separately
          // The backend will receive the manualFramingConfigs object and use the appropriate config per ratio
          console.log(
            '[ClipsTab] Using manual framing configuration with per-ratio configs:',
            Object.keys(settings.manualFramingConfigs || {})
          );

          // Get the first configured ratio for the primary framing strategy
          // The backend will handle per-ratio configs during build
          const firstConfiguredRatio = Object.keys(
            settings.manualFramingConfigs!
          )[0] as keyof import('@/types').ManualFramingConfigs;
          const firstConfig = settings.manualFramingConfigs![firstConfiguredRatio];

          if (firstConfig && firstConfig.regions && firstConfig.regions.length > 0) {
            // Convert manual config to framing strategy format
            framingStrategy = {
              mode: 'multi_region',
              videoType: 'unknown',
              speakerCount: 0,
              confidence: 1.0,
              targetAspectRatio: firstConfig.targetAspectRatio,
              isPortrait: true,
              sourceDimensions: {
                width: 1920, // Will be updated by backend
                height: 1080,
              },
              ffmpegFilter: '',
              layout: null,
              keyframes: null,
              cropRegion: null,
              cropCenter: null,
              speakers: null,
              contentRegions: null,
              multiRegion: firstConfig,
            };
          }
        } else if (settings.framingMode === 'manual' && settings.manualFramingConfig) {
          // Legacy single config support
          console.log(
            '[ClipsTab] Using manual framing configuration with',
            settings.manualFramingConfig.regions.length,
            'regions'
          );

          // Convert manual config to framing strategy format
          framingStrategy = {
            mode: 'multi_region',
            videoType: 'unknown',
            speakerCount: 0,
            confidence: 1.0,
            targetAspectRatio: settings.manualFramingConfig.targetAspectRatio,
            isPortrait: true,
            sourceDimensions: {
              width: 1920, // Will be updated by backend
              height: 1080,
            },
            ffmpegFilter: '',
            layout: null,
            keyframes: null,
            cropRegion: null,
            cropCenter: null,
            speakers: null,
            contentRegions: null,
            multiRegion: settings.manualFramingConfig,
          };
        } else {
          // Auto mode - run speaker detection
          try {
            console.log('[ClipsTab] Portrait ratio detected, analyzing speakers...');

            // Calculate clip duration from segments
            const clipDuration = segments.reduce((total, seg) => {
              return total + (seg.end_time - seg.start_time);
            }, 0);

            // Only analyze if clip is long enough (3+ seconds)
            if (clipDuration >= 3) {
              const { analyzeSpeakers, getRecommendedSampleInterval } = await import(
                '@/services/speaker-detection-api'
              );
              const { getFramingStrategyWithData, saveFramingStrategy } = await import(
                '@/services/database/speaker-detection'
              );

              // Check if we already have a cached strategy for this clip
              const cachedStrategy = await getFramingStrategyWithData(clip.id);

              if (cachedStrategy) {
                console.log('[ClipsTab] Using cached framing strategy:', cachedStrategy.strategy.mode);
                framingStrategy = convertToRustFramingStrategy(cachedStrategy.strategy, cachedStrategy.data);
              } else {
                // Get segment timing for analysis
                const firstSegment = segments[0];
                const lastSegment = segments[segments.length - 1];
                const startTime = firstSegment.start_time;
                const endTime = lastSegment.end_time;

                const sampleInterval = getRecommendedSampleInterval(clipDuration);

                console.log('[ClipsTab] Calling speaker detection API...', {
                  clipId: clip.id,
                  startTime,
                  endTime,
                  sampleInterval,
                });

                const response = await analyzeSpeakers(clip.id, {
                  video_path: projectVideo.file_path,
                  start_time: startTime,
                  end_time: endTime,
                  target_aspect_ratio: '9:16',
                  sample_interval: sampleInterval,
                });

                console.log('[ClipsTab] Speaker detection response:', response);

                // Save to local database for caching
                const { convertServerStrategyToStorageFormat } = await import('@/services/speaker-detection-api');
                await saveFramingStrategy(clip.id, {
                  mode: response.mode,
                  video_type: response.video_type,
                  target_aspect_ratio: response.target_aspect_ratio,
                  confidence: response.confidence,
                  speaker_count: response.speaker_count,
                  strategy_data: convertServerStrategyToStorageFormat(response.strategy),
                  source_width: response.strategy.source_dimensions?.width,
                  source_height: response.strategy.source_dimensions?.height,
                });

                // Convert to Rust format
                framingStrategy = convertServerResponseToRustFormat(response);
              }
            } else {
              console.log('[ClipsTab] Clip too short for speaker detection, using default crop');
            }
          } catch (err) {
            console.warn('[ClipsTab] Speaker detection failed, falling back to center crop:', err);
            // Continue with null framingStrategy (will use default center crop)
          }
        }
      }

      // Pass all build settings to the backend (including build number for filename)
      // Subtitle settings come directly from SubtitlesTab via props
      // Merge perRatioConfigs from clip editor with subtitleOverrides from build settings
      // perRatioConfigs from clip editor takes precedence (user configured in editor)
      let finalSubtitleOverrides = settings.subtitleOverrides || null;
      if (props.subtitleSettings?.perRatioConfigs) {
        const editorOverrides: Record<string, { fontSize: number; positionPercentage: number; maxWidth?: number }> = {};
        for (const [ratio, config] of Object.entries(props.subtitleSettings.perRatioConfigs)) {
          editorOverrides[ratio] = {
            fontSize: config.fontSize,
            positionPercentage: config.position?.y ?? config.positionPercentage, // Use Y position as the vertical position percentage
            maxWidth: config.maxWidth,
          };
        }
        // Merge: editor configs override build settings configs
        finalSubtitleOverrides = {
          ...(settings.subtitleOverrides || {}),
          ...editorOverrides,
        };
        console.log('[ClipsTab] Merged subtitle overrides from clip editor:', finalSubtitleOverrides);
      }

      await invoke('build_clip_from_segments', {
        projectId: props.projectId,
        clipId: clip.id,
        clipName: clip.current_version_name || clip.name || 'Untitled',
        videoPath: projectVideo.file_path,
        segments: segments,
        subtitleSettings: props.subtitleSettings,
        subtitleOverrides: finalSubtitleOverrides,
        transcriptWords: transcriptWords,
        transcriptSegments: transcriptSegments,
        maxWords: props.maxWordsForAspectRatio,
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        buildNumber: buildNumber,
        buildId: buildId,
        introPath: settings.intro?.file_path || null,
        introDuration: settings.intro?.duration || null,
        outroPath: settings.outro?.file_path || null,
        outroDuration: settings.outro?.duration || null,
        watermarkSettings: watermarkSettings,
        audioSettings: audioSettings,
        framingStrategy: framingStrategy,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        videoFilterSegments: videoFilterSegments,
        textOverlays: textOverlaysForExport,
        stickers: stickersForExport,
        clipWatermarks: clipWatermarksForExport,
      });

      console.log('[ClipsTab] Clip build started successfully');

      // Refresh clips to show building status
      emit('refreshClips');
    } catch (error) {
      console.error('[ClipsTab] Failed to start clip build:', error);

      const { updateClipBuildStatus } = await import('@/services/database');

      // Update database status to failed
      await updateClipBuildStatus(clip.id, 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Refresh clips to show failed status
      emit('refreshClips');

      // Show error via event
      showError('Build Failed', `Failed to build clip: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Reset the build in progress flag
      isBuildInProgress.value = false;
    }
  }

  async function onSaveFile(filePath: string) {
    if (!filePath) {
      console.error('[ClipsTab] No file path available');
      return;
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      // Extract the filename from the source path
      const sourcePath = filePath;
      const fileName = sourcePath.split(/[/\\]/).pop() || 'clip.mp4';

      // Open save dialog so user can choose where to save
      const destinationPath = await save({
        title: 'Save Clip As',
        defaultPath: fileName,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      // User cancelled the dialog
      if (!destinationPath) {
        console.log('[ClipsTab] Save dialog cancelled');
        return;
      }

      // Copy the clip to the selected destination
      await invoke('copy_clip_to_destination', {
        sourcePath: sourcePath,
        destinationPath: destinationPath,
      });

      console.log('[ClipsTab] File saved to:', destinationPath);

      // Show success message
      const toastComposable = await import('@/composables/useToast');
      const { success: showSuccessToast } = toastComposable.useToast();
      showSuccessToast('File Saved', `Clip saved to ${destinationPath}`);
    } catch (error) {
      console.error('[ClipsTab] Failed to save file:', error);
      showError('Failed to Save', 'Could not save the file. Please try again.');
    }
  }

  async function onSaveBuiltClip(clip: ClipWithVersion) {
    if (!clip.built_file_path) {
      console.error('[ClipsTab] No built file path available');
      return;
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      // Extract the filename from the source path
      const sourcePath = clip.built_file_path;
      const fileName = sourcePath.split(/[/\\]/).pop() || 'clip.mp4';

      // Open save dialog so user can choose where to save
      const destinationPath = await save({
        title: 'Save Clip As',
        defaultPath: fileName,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      // User cancelled the dialog
      if (!destinationPath) {
        console.log('[ClipsTab] Save dialog cancelled');
        return;
      }

      // Copy the clip to the selected destination
      await invoke('copy_clip_to_destination', {
        sourcePath: sourcePath,
        destinationPath: destinationPath,
      });

      console.log('[ClipsTab] Clip saved to:', destinationPath);

      // Show success message
      const toastComposable = await import('@/composables/useToast');
      const { success: showSuccessToast } = toastComposable.useToast();
      showSuccessToast('Clip Saved', `Clip saved to ${destinationPath}`);
    } catch (error) {
      console.error('[ClipsTab] Failed to save clip:', error);
      showError('Failed to Save', 'Could not save the clip file. Please try again.');
    }
  }

  async function showError(title: string, message: string) {
    try {
      const toastComposable = await import('@/composables/useToast');
      const { error: showErrorToast } = toastComposable.useToast();
      showErrorToast(title, message, 8000);
    } catch (error) {
      console.error('[ClipsTab] Failed to show error message:', error);
      alert(`${title}: ${message}`);
    }
  }

  // Expose methods
  defineExpose({
    scrollClipIntoView,
  });
</script>

<style scoped>
  /* Custom scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
    background-clip: padding-box;
  }

  /* Firefox scrollbar */
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }
</style>
