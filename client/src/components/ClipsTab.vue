<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header (can be hidden when integrated into parent tabs) -->
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

      <!-- Compact Progress Bar (when detecting) - Hide during finalizing to show centered progress -->
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

      <!-- Detect Button (when not detecting and has clips) - Only show if AI is allowed -->
      <button
        v-else-if="clips.length > 0 && isAIAllowed"
        @click="handleDetectClips"
        class="clips-tab-header-btn group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all"
        title="Run clip detection again"
      >
        <Sparkles class="h-3 w-3 transition-colors" />
        Detect
      </button>

      <!-- Add Clip Button (when AI is not allowed and has clips) -->
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
      <!-- Progress State (show when generating OR during finalizing stage) -->
      <div
        v-if="isGenerating && (clips.length === 0 || generationStage === 'finalizing')"
        class="h-full flex flex-col items-center justify-center px-6"
      >
        <div class="w-full max-w-xs space-y-5">
          <!-- Icon & Status -->
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

          <!-- Progress Bar -->
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

          <!-- Time Estimate & Cancel Button -->
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

          <!-- Error State -->
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
      <!-- Clips List State (hide during finalizing to show progress) -->
      <div v-else-if="clips.length > 0 && generationStage !== 'finalizing'" class="w-full" ref="clipsScrollContainer">
        <!-- Clips Grid -->
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
              <div
                v-for="clip in section.clips"
                :key="clip.id"
                :ref="(el) => setClipRef(el, clip.id)"
                :class="[
                  'clips-tab-card group relative rounded-lg cursor-pointer transition-all duration-200',
                  // Playing clip gets green styling
                  props.playingClipId === clip.id ? 'clips-tab-card--playing' : '',
                ]"
                :style="{
                  // Prioritize playing state over all other states
                  borderColor:
                    props.playingClipId === clip.id
                      ? undefined
                      : (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                        ? clip.session_run_color || '#8B5CF6'
                        : undefined,
                  borderWidth:
                    !props.playingClipId && (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
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
                    opacity: props.playingClipId === clip.id ? '1' : '0.6',
                  }"
                ></div>

                <div class="flex gap-3 p-3 pl-4">
                  <!-- Thumbnail -->
                  <div class="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden bg-black/30 border border-border/30 relative">
                    <!-- Persisted/generated FFmpeg thumbnails — always prefer these over per-row FramedThumbnail.
                         Framed thumbnails used full-VOD seeks per clip row (slow/failed on long sources). -->
                    <img
                      v-if="getClipThumbnail(clip.id)"
                      :src="getClipThumbnail(clip.id)!"
                      :alt="clip.current_version_name || clip.name || 'Clip thumbnail'"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <LoaderIcon
                        v-if="thumbnailStore.isLoading(clip.id)"
                        class="w-5 h-5 animate-spin text-muted-foreground/50"
                      />
                      <Video v-else class="w-6 h-6 text-muted-foreground/40" />
                    </div>

                    <!-- Building Overlay -->
                    <div
                      v-if="clip.build_status === 'building'"
                      class="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                    >
                      <LoaderIcon class="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0 flex flex-col">
                    <!-- Header: Title & Actions -->
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                      <div class="flex items-start gap-2 min-w-0">
                        <span
                          class="text-xs font-bold mt-0.5 tabular-nums select-none"
                          style="color: var(--sidebar-text-muted); opacity: 0.4"
                        >
                          #{{ clipIndexMap.get(clip.id)! + 1 }}
                        </span>
                        <h5
                          class="text-[14px] font-semibold leading-snug line-clamp-2"
                          style="color: var(--sidebar-text)"
                        >
                          {{ clip.current_version_name || clip.name || 'Untitled Clip' }}
                        </h5>
                      </div>

                      <!-- Actions -->
                      <div class="flex items-center gap-0.5 flex-shrink-0">
                        <!-- Quick Download Button (when downloads available) -->
                        <div v-if="hasCompletedBuilds(clip)" class="relative" data-action-menu>
                          <button
                            :ref="(el) => setDropdownButtonRef(el, clip.id)"
                            class="clips-tab-download-btn p-1.5 rounded-md transition-all flex items-center gap-0.5"
                            :class="{
                              'clips-tab-download-btn--active': openDownloadDropdownId === clip.id,
                            }"
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
                              class="clips-tab-dropdown fixed z-[99999] w-[220px] rounded-lg shadow-2xl py-1.5 overflow-hidden"
                              :style="getDropdownPosition(clip.id)"
                              data-action-menu
                              @click.stop
                            >
                              <div
                                class="clips-tab-dropdown-label px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
                              >
                                Downloads ({{ getDownloadableFilesCount(clip) }})
                              </div>

                              <!-- Download items -->
                              <button
                                v-for="(file, fileIdx) in getDownloadableFiles(clip)"
                                :key="`${file.build.id}-${fileIdx}`"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onSaveFile(file.filePath);
                                  closeDownloadDropdown();
                                "
                              >
                                <DownloadIcon
                                  class="h-4 w-4 flex-shrink-0"
                                  style="color: var(--sidebar-accent); opacity: 0.7"
                                />
                                <div class="flex-1 min-w-0 text-left">
                                  <div class="text-xs font-medium truncate flex items-center gap-1.5">
                                    <span v-if="file.aspectRatio" style="color: var(--sidebar-accent)">
                                      {{ file.aspectRatio }}
                                    </span>
                                    <span style="color: var(--sidebar-text-muted); opacity: 0.5">
                                      #{{ file.build.build_number }}
                                    </span>
                                  </div>
                                  <div
                                    v-if="file.build.completed_at"
                                    class="text-[10px] mt-0.5"
                                    style="color: var(--sidebar-text-muted); opacity: 0.4"
                                  >
                                    {{ formatBuildDate(file.build.completed_at) }}
                                  </div>
                                </div>
                              </button>

                              <!-- Legacy download fallback -->
                              <button
                                v-if="getDownloadableFilesCount(clip) === 0 && clip.built_file_path"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onSaveBuiltClip(clip);
                                  closeDownloadDropdown();
                                "
                              >
                                <DownloadIcon
                                  class="h-4 w-4 flex-shrink-0"
                                  style="color: var(--sidebar-accent); opacity: 0.7"
                                />
                                <div class="flex-1 min-w-0 text-left">
                                  <div class="text-xs font-medium">Download</div>
                                  <div
                                    v-if="clip.built_at"
                                    class="text-[10px] mt-0.5"
                                    style="color: var(--sidebar-text-muted); opacity: 0.4"
                                  >
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
                            class="clips-tab-more-btn p-1.5 rounded-md transition-all"
                            :class="{ 'clips-tab-more-btn--active': openActionMenuId === clip.id }"
                            title="Clip actions"
                            @click.stop="toggleActionMenu(clip.id)"
                          >
                            <MoreVertical class="h-4 w-4" />
                          </button>

                          <!-- Action Menu Dropdown - Teleported to body -->
                          <Teleport to="body">
                            <div
                              v-if="openActionMenuId === clip.id"
                              class="clips-tab-dropdown fixed z-[99999] w-[200px] rounded-lg shadow-2xl py-1.5 overflow-hidden"
                              :style="getActionMenuPosition(clip.id)"
                              data-action-menu
                              @click.stop
                            >
                              <!-- Edit Clip -->
                              <button
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onEditClip(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <Edit3 class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Edit Clip</span>
                              </button>

                              <!-- Adjust Clip (only in project context) -->
                              <button
                                v-if="props.showAdjustClipButton"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onAdjustClip(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <Settings2 class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Adjust Clip</span>
                              </button>

                              <!-- Play Clip -->
                              <button
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onPlayClip(clip);
                                  closeActionMenu();
                                "
                              >
                                <PlayIcon class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Play Clip</span>
                              </button>

                              <!-- Divider -->
                              <div class="clips-tab-dropdown-divider h-px my-1 mx-2"></div>

                              <!-- Build / rebuild clip (new build or different aspect ratio) -->
                              <button
                                v-if="clip.build_status !== 'building'"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onBuildClip(clip);
                                  closeActionMenu();
                                "
                              >
                                <Hammer class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>{{ hasCompletedBuilds(clip) ? 'Rebuild Clip' : 'Build Clip' }}</span>
                              </button>

                              <!-- Publish Now (only for found clips NOT yet built) -->
                              <button
                                v-if="clip.build_status !== 'building' && !hasCompletedBuilds(clip)"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onPublishNow(clip);
                                  closeActionMenu();
                                "
                              >
                                <Rocket class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Publish Now</span>
                              </button>

                              <!-- Cancel Build -->
                              <button
                                v-if="clip.build_status === 'building'"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  handleCancelBuild(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <StopCircle class="h-4 w-4" style="color: #f87171" />
                                <span style="color: #f87171">Cancel Build</span>
                              </button>

                              <!-- Clear from In Editor (only if in editor) -->
                              <button
                                v-if="inEditorStore.isInEditor(clip.id)"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onClearFromInEditor(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <XIcon class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Clear from In Editor</span>
                              </button>

                              <!-- Delete (only if not built) -->
                              <template v-if="!hasCompletedBuilds(clip)">
                                <div class="clips-tab-dropdown-divider h-px my-1 mx-2"></div>
                                <button
                                  class="clips-tab-dropdown-item clips-tab-dropdown-item--danger w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
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
                          clip.current_version_virality_score !== undefined &&
                          clip.current_version_virality_score !== null
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
                        class="clips-tab-duration-badge inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                      >
                        <ClockIcon class="h-2.5 w-2.5 opacity-70" />
                        <span>
                          {{ formatDuration(getClipDuration(clip)) }}
                        </span>
                      </div>

                      <!-- In Editor Badge -->
                      <div
                        v-if="inEditorStore.isInEditor(clip.id)"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-400"
                        title="This clip is currently open in the video editor"
                      >
                        <Edit3 class="h-2.5 w-2.5" />
                        <span>In Editor</span>
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
                      class="text-[11px] line-clamp-1 mb-1.5 leading-relaxed italic"
                      style="color: var(--sidebar-text-muted); opacity: 0.7"
                    >
                      "{{ clip.current_version_detection_reason }}"
                    </p>

                    <!-- Footer Info -->
                    <div
                      class="flex flex-wrap items-center text-[10px] mt-auto gap-x-3 gap-y-1 min-w-0 w-full"
                      style="color: var(--sidebar-text-muted); opacity: 0.6"
                    >
                      <div class="flex items-center gap-2 whitespace-nowrap shrink-0 leading-none">
                        <span class="font-mono leading-none">
                          {{ formatTime(clip.current_version_start_time || 0) }} -
                          {{ formatTime(clip.current_version_end_time || 0) }}
                        </span>

                        <!-- Build Status (only show completed state) -->
                        <span
                          v-if="hasCompletedBuilds(clip)"
                          class="text-green-400 flex items-center gap-1 leading-none"
                        >
                          <CheckIcon class="h-2.5 w-2.5" />
                          {{ getDownloadableFilesCount(clip) || 1 }} File{{
                            (getDownloadableFilesCount(clip) || 1) !== 1 ? 's' : ''
                          }}
                        </span>
                      </div>

                      <!-- Run Info -->
                      <div class="flex items-center gap-2 whitespace-nowrap shrink-0 leading-none ms-auto">
                        <span v-if="clip.run_number" class="flex items-center gap-1 leading-none">
                          <div
                            class="h-1.5 w-1.5 rounded-full"
                            :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                          ></div>
                          <span class="text-[10px]" style="color: var(--sidebar-text); opacity: 0.6">
                            Run {{ clip.run_number }}
                          </span>
                        </span>

                        <span
                          v-if="getPromptDisplayName(clip.session_prompt)"
                          class="text-[10px] truncate max-w-[90px]"
                          style="color: var(--sidebar-text-muted); opacity: 0.7"
                          :title="getPromptDisplayName(clip.session_prompt)"
                        >
                          {{ getPromptDisplayName(clip.session_prompt) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      <!-- Default State -->
      <div v-else class="h-full flex items-center justify-center px-4">
        <div class="text-center max-w-xs">
          <div class="mb-6 flex flex-col items-center">
            <!-- Icon container -->
            <div class="relative mb-6">
              <div class="clips-tab-empty-icon w-16 h-16 rounded-xl flex items-center justify-center mx-auto">
                <Video class="h-7 w-7" style="color: var(--sidebar-accent)" />
              </div>
            </div>

            <h4 class="text-sm font-semibold mb-2" style="color: var(--sidebar-text)">No Clips Yet</h4>

            <!-- AI Allowed: Show Detect Clips -->
            <template v-if="isAIAllowed">
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

            <!-- AI Not Allowed: Show Add Clip -->
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

    <!-- Build Settings Dialog -->
    <ClipBuildSettingsDialog
      v-model="showBuildSettingsDialog"
      :clip="clipToBuild"
      :watermark-settings="watermarkSettings"
      :default-intro="creatorDefaultIntro"
      :default-outro="creatorDefaultOutro"
      :thumbnail-url="videoThumbnailUrl"
      :subtitle-settings="buildDialogSubtitleSettings"
      :initial-aspect-ratios="savedAspectRatios"
      :initial-framing-mode="savedFramingMode"
      :initial-framing-configs="savedFramingConfigs"
      :vod-preset-config="vodPresetConfig"
      :creator-profile-server-id="creatorProfileServerId"
      @confirm="onBuildConfirm"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import { parseTranscriptToWords, type WordInfo } from '@/utils/timelineUtils';
  import { maxWordsChunkForAspectRatioString } from '@/utils/subtitleVisibleWords';
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
    Settings2,
    LayoutDashboard,
    Rocket,
  } from 'lucide-vue-next';
  import { useAIPermission } from '@/composables/useAIPermission';
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import { useClipThumbnailStore } from '@/stores/clipThumbnails';
  import ClipBuildSettingsDialog, { type BuildSettings, type BuildTarget, type IntroOutroItem } from './ClipBuildSettingsDialog.vue';
  import type { SubtitleSettings, WatermarkSettings, IntroOutroRef } from '@/types';
  import { CAPTION_PRESETS } from '@/editor/constants/caption-constants';
  import { ensureAssetDownloaded, type ServerOrganizationAsset } from '@/services/orgAssetSync';
  import type { AnalyzeSpeakersResponse } from '@/services/speaker-detection-api';
  import type { FramingStrategy as DbFramingStrategy, ParsedStrategyData } from '@/services/database/speaker-detection';
  import { normalizeLocalFilePathForFs } from '@/utils/normalizeLocalFilePath';

  // Helper to ensure value is boolean (handles string "true"/"false" and numbers)
  function toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value !== 0;
    return Boolean(value);
  }

  function cloneSubtitleSettings(settings: SubtitleSettings): SubtitleSettings {
    return JSON.parse(JSON.stringify(settings)) as SubtitleSettings;
  }

  function mergeVodSubtitleDefaultsWithSavedSettings(
    savedSettings: SubtitleSettings,
    vodDefaults?: SubtitleSettings | null
  ): SubtitleSettings {
    if (!vodDefaults || typeof vodDefaults !== 'object') {
      return cloneSubtitleSettings(savedSettings);
    }

    const defaults = cloneSubtitleSettings(vodDefaults);
    const saved = cloneSubtitleSettings(savedSettings);
    return {
      ...defaults,
      ...saved,
      perRatioConfigs: {
        ...(defaults.perRatioConfigs ?? {}),
        ...(saved.perRatioConfigs ?? {}),
      },
    };
  }

  function mergeDraggedSubtitlePositionForBuild(
    subtitleSettings: SubtitleSettings,
    clip: {
      subtitle_position_x?: number | null;
      subtitle_position_y?: number | null;
      subtitle_position_width?: number | null;
    },
    aspectRatios: string[]
  ): SubtitleSettings {
    // Apply DB columns whenever both coordinates exist. Do not use clipSubtitlePositionLooksUserPlaced:
    // classic bottom (50,85) is still a valid saved workspace position; skipping merge left stale
    // positionPercentage in JSON (e.g. middle-of-frame defaults) so FFmpeg disagreed with preview.
    if (clip.subtitle_position_x == null || clip.subtitle_position_y == null) {
      return subtitleSettings;
    }

    const ratios =
      aspectRatios.length > 0
        ? aspectRatios
        : Object.keys(subtitleSettings.perRatioConfigs ?? {});
    const targetRatios = ratios.length > 0 ? ratios : ['16:9'];
    const perRatioConfigs = { ...(subtitleSettings.perRatioConfigs ?? {}) };
    const { perRatioConfigs: _perRatioConfigs, ...rootSettingsForPreview } = subtitleSettings;

    for (const ratio of targetRatios) {
      const existing = perRatioConfigs[ratio] ?? {};
      // Per-ratio positions configured in the POI editor MUST win over the
      // workspace `subtitle_position_x/y` columns. Those columns reflect the
      // single workspace drag (typically 16:9 default) — applying them to
      // every ratio's per-ratio config would clobber positions the user
      // intentionally set for each aspect ratio in the POI editor.
      const hasPerRatioPosition =
        existing.position?.x != null && existing.position?.y != null;
      const ratioPositionX = hasPerRatioPosition
        ? existing.position!.x
        : clip.subtitle_position_x;
      const ratioPositionY = hasPerRatioPosition
        ? existing.position!.y
        : clip.subtitle_position_y;

      perRatioConfigs[ratio] = {
        // Root settings act as DEFAULTS — they fill in fields that aren't
        // explicitly set per-ratio so old per-ratio rows with missing/stale
        // font sizes don't fall through to backend defaults and produce
        // mismatched preview/export output.
        ...rootSettingsForPreview,
        // Existing per-ratio values WIN over root for fields the user has
        // explicitly customized in the build dialog / POI editor (e.g.
        // animationStyle, multiColorEnabled, fontSize, colorPalette). The
        // previous order (root after existing) silently clobbered every
        // per-ratio override the user had just configured.
        ...existing,
        // Resolve final position/width: per-ratio overrides the user set in
        // the POI editor take precedence; otherwise fall back to the
        // workspace position columns so single-ratio workspace drags still
        // propagate to ratios that haven't been customized.
        position: { x: ratioPositionX, y: ratioPositionY },
        positionPercentage: ratioPositionY,
        maxWidth:
          existing.maxWidth ??
          clip.subtitle_position_width ??
          subtitleSettings.maxWidth,
      };
    }

    return {
      ...subtitleSettings,
      positionPercentage: clip.subtitle_position_y,
      maxWidth: clip.subtitle_position_width ?? subtitleSettings.maxWidth,
      perRatioConfigs,
    };
  }

  /**
   * Resolve max words per subtitle chunk for a target aspect ratio.
   * Mirrors VideoPlayer.vue `maxWordsForAspectRatio` so the export's chunking matches the preview
   * (otherwise wide builds can ship 3-word frames while the preview shows 6 words per page).
   */
  function getSubtitleMaxWordsForAspectRatio(ratio: string, fallback?: number): number {
    const computed = maxWordsChunkForAspectRatioString(ratio);
    if (Number.isFinite(computed) && computed > 0) return computed;
    return fallback || 4;
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

  function tokenizeTranscriptText(text: string): string[] {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  function getTranscriptText(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.text === 'string') return parsed.text.trim();
        if (Array.isArray(parsed?.segments)) {
          return parsed.segments.map((seg: any) => seg?.text).filter(Boolean).join(' ').trim();
        }
      } catch {
        // Plain transcript text can legitimately look JSON-ish.
      }
    }
    return trimmed;
  }

  function overlayTranscriptTextOnTimedWords(text: string, timedWords: WordInfo[]): WordInfo[] {
    const tokens = tokenizeTranscriptText(text);
    if (tokens.length === 0 || timedWords.length === 0) return timedWords;
    const overlaid = timedWords.slice(0, tokens.length).map((word, index) => ({
      ...word,
      word: tokens[index],
    }));

    if (tokens.length > timedWords.length) {
      const lastWord = timedWords[timedWords.length - 1];
      const step = Math.max(0.05, lastWord.end - lastWord.start);
      tokens.slice(timedWords.length).forEach((word, index) => {
        const start = lastWord.end + step * index;
        overlaid.push({ word, start, end: start + step });
      });
    }

    return overlaid;
  }

  function normalizeWordsForSourceSegment(words: WordInfo[], startTime: number, endTime: number): WordInfo[] {
    if (words.length === 0) return [];
    const duration = Math.max(0.001, endTime - startTime);
    const firstStart = words[0]?.start ?? 0;
    const lastEnd = words[words.length - 1]?.end ?? 0;
    const looksRelative = firstStart < duration + 1 && lastEnd <= duration + 1;
    const sourceWords = looksRelative
      ? words.map((word) => ({ ...word, start: word.start + startTime, end: word.end + startTime }))
      : words;
    return sourceWords.filter((word) => word.end > startTime && word.start < endTime);
  }

  function getSourceSegmentsForSelfContainedClip(clip: ClipWithVersion): any[] {
    if (clip.current_version_segments && clip.current_version_segments.length > 0) {
      return clip.current_version_segments;
    }

    const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;
    const endTime = clip.current_version_end_time ?? clip.end_time ?? 0;
    if (endTime <= startTime) return [];

    return [
      {
        id: `source-${clip.id}`,
        clip_version_id: clip.current_version_id || '',
        segment_index: 0,
        start_time: startTime,
        end_time: endTime,
        duration: endTime - startTime,
        transcript: null,
        transcript_raw_json: null,
        audio_peaks: null,
        created_at: Date.now(),
      },
    ];
  }

  function rebaseWordsToClipStart(words: WordInfo[], clipStart: number, clipDuration: number): WordInfo[] {
    return words
      .map((word) => ({
        ...word,
        start: Math.max(0, word.start - clipStart),
        end: Math.min(clipDuration, word.end - clipStart),
      }))
      .filter((word) => word.end > word.start);
  }

  function wordsOverlapSegments(words: WordInfo[] | undefined, segments: any[]): boolean {
    if (!words || words.length === 0 || segments.length === 0) return false;
    return segments.some((segment) => {
      const startTime = Number(segment.start_time) || 0;
      const endTime = Number(segment.end_time) || startTime;
      return words.some((word) => word.end > startTime && word.start < endTime);
    });
  }

  function normalizeTranscriptToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function getClipAnchorTranscriptText(clip: ClipWithVersion): string {
    const segments = clip.current_version_segments || [];
    for (const segment of segments) {
      const text = getTranscriptText(segment.transcript);
      if (text) return text;
    }
    return getTranscriptText((clip as any).combined_transcript) || getTranscriptText(clip.current_version_description);
  }

  function findTranscriptAnchorOffset(clip: ClipWithVersion, words: WordInfo[]): number {
    const anchorTokens = tokenizeTranscriptText(getClipAnchorTranscriptText(clip))
      .map(normalizeTranscriptToken)
      .filter(Boolean);
    if (anchorTokens.length < 2 || words.length === 0) return 0;

    const probe = anchorTokens.slice(0, Math.min(anchorTokens.length, 8));
    const wordTokens = words.map((word) => normalizeTranscriptToken(word.word));
    const minimumMatches = Math.min(probe.length, 4);

    for (let start = 0; start < wordTokens.length; start++) {
      let matched = 0;
      for (let offset = 0; offset < probe.length && start + offset < wordTokens.length; offset++) {
        if (wordTokens[start + offset] !== probe[offset]) break;
        matched++;
      }
      if (matched >= minimumMatches) return words[start].start;
    }

    return 0;
  }

  function trimSelfContainedTranscriptToAnchor<T extends { words: WordInfo[]; whisperSegments: any[]; text: string }>(
    clip: ClipWithVersion,
    transcript: T
  ): T {
    const offset = findTranscriptAnchorOffset(clip, transcript.words);
    if (offset <= 0.25) return transcript;

    const words = transcript.words
      .filter((word) => word.end > offset)
      .map((word) => ({
        ...word,
        start: Math.max(0, word.start - offset),
        end: Math.max(0, word.end - offset),
      }))
      .filter((word) => word.end > word.start);

    const whisperSegments = transcript.whisperSegments
      .filter((segment: any) => segment.end > offset)
      .map((segment: any) => ({
        ...segment,
        start: Math.max(0, segment.start - offset),
        end: Math.max(0, segment.end - offset),
        words: Array.isArray(segment.words)
          ? segment.words
              .filter((word: WordInfo) => word.end > offset)
              .map((word: WordInfo) => ({
                ...word,
                start: Math.max(0, word.start - offset),
                end: Math.max(0, word.end - offset),
              }))
              .filter((word: WordInfo) => word.end > word.start)
          : undefined,
      }))
      .filter((segment: any) => segment.end > segment.start);

    console.log('[ClipsTab] Trimmed self-contained transcript to clip anchor:', {
      clipId: clip.id,
      offset,
      firstWordBefore: transcript.words[0]?.word,
      firstWordAfter: words[0]?.word,
      wordsBefore: transcript.words.length,
      wordsAfter: words.length,
    });

    return { ...transcript, words, whisperSegments };
  }

  function buildEditedSubtitleWordsForExport(segments: any[], transcriptWords: WordInfo[]): WordInfo[] {
    const out: WordInfo[] = [];
    for (const segment of segments) {
      const startTime = Number(segment.start_time) || 0;
      const endTime = Number(segment.end_time) || startTime;
      const transcriptText = getTranscriptText(segment.transcript);

      let timedWords: WordInfo[] = [];
      if (typeof segment.transcript_raw_json === 'string' && segment.transcript_raw_json.trim()) {
        timedWords = normalizeWordsForSourceSegment(
          parseTranscriptToWords(segment.transcript_raw_json),
          startTime,
          endTime
        );
      }
      if (timedWords.length === 0) {
        timedWords = normalizeWordsForSourceSegment(transcriptWords, startTime, endTime);
      }

      out.push(...overlayTranscriptTextOnTimedWords(transcriptText, timedWords));
    }

    return out.sort((a, b) => a.start - b.start);
  }

  function isSelfContainedLiveClip(clip: ClipWithVersion): boolean {
    const prompt = String((clip as any).session_prompt || '').toLowerCase();
    const hasOwnFile = typeof clip.file_path === 'string' && clip.file_path.trim().length > 0;
    return hasOwnFile && (prompt === 'manual clip creation' || prompt.includes('auto'));
  }

  function isClipBuildOutputPath(filePath: string | null | undefined): boolean {
    if (!filePath) return false;
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    const fileName = normalizedPath.split('/').pop() || '';

    return (
      normalizedPath.includes('/clips/project_') ||
      normalizedPath.includes('/run-') ||
      normalizedPath.includes('/manual-builds/') ||
      /_\d+-\d+_\d+\.(mp4|mov)$/.test(fileName)
    );
  }

  function getSelfContainedClipDuration(clip: ClipWithVersion): number {
    if (clip.current_version_segments && clip.current_version_segments.length > 0) {
      return clip.current_version_segments.reduce((total, segment) => {
        const duration = Number(segment.duration) || Number(segment.end_time) - Number(segment.start_time);
        return total + Math.max(0, duration);
      }, 0);
    }

    const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;
    const endTime = clip.current_version_end_time ?? clip.end_time ?? 0;
    if (endTime > startTime) return endTime - startTime;
    return clip.duration || 0;
  }

  function normalizePathForCompare(path: string): string {
    return path.replace(/\\/g, '/').replace(/^file:\/\//, '').toLowerCase();
  }

  async function loadSelfContainedClipTranscript(
    projectId: string,
    clip: ClipWithVersion
  ): Promise<{ words: WordInfo[]; whisperSegments: any[]; text: string } | null> {
    if (!clip.file_path) return null;

    const { getRawVideosByProjectId, getTranscriptByRawVideoId, getTranscriptSegments } = await import('@/services/database');
    const rawVideos = await getRawVideosByProjectId(projectId);
    const normalizedClipPath = normalizePathForCompare(clip.file_path);
    const rawVideo = rawVideos.find((video) => normalizePathForCompare(video.file_path) === normalizedClipPath);
    if (!rawVideo) return null;

    const transcript = await getTranscriptByRawVideoId(rawVideo.id);
    if (!transcript?.raw_json) return null;

    const words = parseTranscriptToWords(transcript.raw_json);
    const dbSegments = await getTranscriptSegments(transcript.id);
    let text = transcript.text || '';
    let whisperSegments: any[] = [];

    try {
      const parsed = JSON.parse(transcript.raw_json);
      if (Array.isArray(parsed?.segments)) {
        whisperSegments = parsed.segments.map((segment: any, index: number) => ({
          id: segment.id ?? index,
          start: Number(segment.start) || 0,
          end: Number(segment.end) || 0,
          text: segment.text || '',
          words: Array.isArray(segment.words)
            ? segment.words.map((word: any) => ({
                word: String(word.word || '').trim(),
                start: Number(word.start) || 0,
                end: Number(word.end) || 0,
                confidence: word.confidence,
              }))
            : undefined,
        }));
      }
      if (!text && typeof parsed?.text === 'string') text = parsed.text;
    } catch {
      // Keep DB transcript text / parsed words fallback.
    }

    if (!text && dbSegments.length > 0) {
      text = dbSegments.map((segment) => segment.text).filter(Boolean).join(' ');
    }

    return { words, whisperSegments, text };
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
    subtitleSettingsClipId?: string | null;
    maxWordsForAspectRatio?: number;
    watermarkSettings?: WatermarkSettings | null;
    // Creator profile default assets (auto-applied when building clips)
    creatorDefaultIntro?: IntroOutroRef | null;
    creatorDefaultOutro?: IntroOutroRef | null;
    creatorProfile?: any; // Full creator profile for per-ratio intro/outro
    creatorProfileServerId?: number | null;
    videoThumbnailUrl?: string | null;
    hideHeader?: boolean;
    playOnCardClick?: boolean;
    showAdjustClipButton?: boolean;
    vodPresetConfig?: import('@/types').ActiveVodPresetConfig | null;
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
    subtitleSettingsClipId: null,
    maxWordsForAspectRatio: 3,
    watermarkSettings: null,
    creatorDefaultIntro: null,
    creatorDefaultOutro: null,
    creatorProfile: null,
    creatorProfileServerId: null,
    videoThumbnailUrl: null,
    playOnCardClick: false,
    vodPresetConfig: null,
    showAdjustClipButton: false,
  });

  // Emits
  const emit = defineEmits<{
    detectClips: [];
    cancelDetection: [];
    deleteClip: [clipId: string];
    playClip: [clip: ClipWithVersion];
    clipHover: [clipId: string | null];
    seekVideo: [time: number];
    scrollToTimeline: [];
    refreshClips: [];
    editClip: [clipId: string];
    addClip: [];
    adjustClip: [clipId: string];
    publishNow: [clip: ClipWithVersion];
    buildDialogOpen: [open: boolean];
  }>();

  // AI Permission check
  const { isAIAllowed } = useAIPermission();

  // In-editor clips store
  const inEditorStore = useInEditorClips();
  inEditorStore.hydrate();

  // Persistent thumbnail cache store
  const thumbnailStore = useClipThumbnailStore();

  // State
  const hoveredClipId = ref<string | null>(null);
  const isDownloadingAll = ref(false);
  const clipsScrollContainer = ref<HTMLElement | null>(null);
  const clipElements = ref<Map<string, HTMLElement>>(new Map());
  const showBuildSettingsDialog = ref(false);
  const clipToBuild = ref<ClipWithVersion | null>(null);

  watch(showBuildSettingsDialog, (open) => {
    if (!open) emit('buildDialogOpen', false);
  });

  // Derive SubtitleSettings from the clip being built (reads preset from DB data on the clip)
  const derivedSubtitleSettings = computed((): SubtitleSettings | null => {
    const clip = clipToBuild.value as any;
    console.log('[ClipsTab] derivedSubtitleSettings computed, clip:', {
      clipId: clip?.id,
      clipName: clip?.name,
      subtitle_enabled: clip?.subtitle_enabled,
      subtitle_preset_id: clip?.subtitle_preset_id,
      has_subtitle_settings: !!clip?.subtitle_settings,
      subtitle_settings_type: typeof clip?.subtitle_settings,
      subtitle_settings_length: clip?.subtitle_settings?.length
    });
    
    if (!clip?.subtitle_enabled || !clip?.subtitle_preset_id) {
      console.log('[ClipsTab] No subtitles enabled or no preset ID, returning null');
      return null;
    }
    
    // First, try to load full settings from database if they exist
    if (clip.subtitle_settings) {
      try {
        console.log('[ClipsTab] Raw subtitle_settings from clip:', {
          type: typeof clip.subtitle_settings,
          value: clip.subtitle_settings,
          clipId: clip.id,
          clipName: clip.name
        });
        const savedSettings = typeof clip.subtitle_settings === 'string' 
          ? JSON.parse(clip.subtitle_settings) 
          : clip.subtitle_settings;
        console.log('[ClipsTab] Using saved subtitle settings from database for clip build:', {
          animationStyle: savedSettings.animationStyle,
          border1Width: savedSettings.border1Width,
          border1Color: savedSettings.border1Color,
          border2Width: savedSettings.border2Width,
          border2Color: savedSettings.border2Color,
          fontSize: savedSettings.fontSize,
          fontFamily: savedSettings.fontFamily,
          textColor: savedSettings.textColor,
          highlightColor: savedSettings.highlightColor
        });
        return savedSettings;
      } catch (error) {
        console.error('[ClipsTab] Failed to parse subtitle_settings JSON:', error);
        // Fall back to preset below
      }
    } else {
      console.log('[ClipsTab] No subtitle_settings in clip, falling back to preset:', clip.subtitle_preset_id);
    }
    
    // Fall back to preset if no full settings saved
    const preset = CAPTION_PRESETS.find((p) => p.id === clip.subtitle_preset_id);
    if (!preset) return null;
    const fontWeightMap: Record<string, number> = {
      normal: 400, bold: 700,
      '100': 100, '200': 200, '300': 300, '400': 400,
      '500': 500, '600': 600, '700': 700, '800': 800, '900': 900,
    };
    const animMap: Record<string, SubtitleSettings['animationStyle']> = {
      none: 'none', karaoke: 'karaoke', 'karaoke-scale': 'karaoke',
      zoom: 'zoom', pop: 'pop', glow: 'glow',
      'box-highlight': 'box-highlight', typewriter: 'typewriter', wave: 'wave',
    };
    return {
      enabled: true,
      selectedPresetId: preset.id,
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: fontWeightMap[String(preset.fontWeight)] ?? 700,
      textColor: preset.color,
      backgroundColor: preset.backgroundColor,
      backgroundEnabled: preset.backgroundColor !== 'transparent',
      position: 'bottom' as const,
      positionPercentage: clip.subtitle_position_y ?? 85,
      maxWidth: clip.subtitle_position_width ?? 90,
      animationStyle: animMap[preset.highlightStyle] ?? 'none',
      highlightColor: preset.highlightColor,
      border1Width: preset.stroke?.width ?? 0,
      border1Color: preset.stroke?.color ?? '#000000',
      border2Width: 0,
      border2Color: '#000000',
      shadowBlur: preset.shadow?.blur ?? 0,
      shadowOffsetX: preset.shadow?.offsetX ?? 0,
      shadowOffsetY: preset.shadow?.offsetY ?? 0,
      shadowColor: preset.shadow?.color ?? '#000000',
      lineHeight: preset.lineHeight,
      letterSpacing: preset.letterSpacing,
      textAlign: 'center' as const,
      textOffsetX: 0,
      textOffsetY: 0,
      padding: 0,
      borderRadius: 0,
      wordSpacing: 0.35,
      multiColorEnabled: false,
      multiColorMode: 'default' as const,
      colorPalette: [],
    };
  });

  const buildDialogSubtitleSettings = computed((): SubtitleSettings | null => {
    const vodDefaults = props.vodPresetConfig?.subtitleDefaults;
    const shouldUseLivePreviewSettings =
      !!props.subtitleSettings &&
      !!clipToBuild.value &&
      clipToBuild.value.id === props.subtitleSettingsClipId;
    const clipSettings = shouldUseLivePreviewSettings
      ? props.subtitleSettings
      : (derivedSubtitleSettings.value ?? props.subtitleSettings ?? null);
    if (clipSettings) {
      return mergeVodSubtitleDefaultsWithSavedSettings(clipSettings, vodDefaults);
    }
    if (vodDefaults && typeof vodDefaults === 'object') {
      return cloneSubtitleSettings(vodDefaults);
    }
    return null;
  });
  const openDownloadDropdownId = ref<string | null>(null);
  const dropdownButtonRefs = ref<Map<string, HTMLElement>>(new Map());

  // Action menu dropdown state
  const openActionMenuId = ref<string | null>(null);
  const actionMenuButtonRefs = ref<Map<string, HTMLElement>>(new Map());

  // Aspect framing settings loaded from clip editor
  const savedAspectRatios = ref<string[] | null>(null);
  const savedFramingMode = ref<'auto' | 'manual' | null>(null);
  const savedFramingConfigs = ref<import('@/types').ManualFramingConfigs | null>(null);

  // Use persistent thumbnail cache from store (no longer component-scoped)
  // const clipThumbnailCache = ref<Map<string, string>>(new Map()); // REMOVED - now using store

  // Track if thumbnails are being loaded
  const isLoadingThumbnails = ref(false);

  // Track which clips are already part of a video editor project
  const clipProjectMembership = ref<Map<string, boolean>>(new Map());

  // Computed: check if all clips have thumbnails loaded (or don't need them)
  const allThumbnailsReady = computed(() => {
    if (props.clips.length === 0) return true;
    // All clips should either have a thumbnail in cache, or not need one (no built_thumbnail_path)
    return props.clips.every((clip) => thumbnailStore.hasThumbnail(clip.id) || !clip.built_thumbnail_path);
  });

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
  // Flag to prevent concurrent thumbnail generation runs
  let thumbnailGenerationInProgress = false;

  watch(
    () => props.clips,
    (newClips, oldClips) => {
      // Only reload thumbnails if clips actually changed (new clips added or clips modified)
      const hasNewClips = !oldClips || newClips.length !== oldClips.length;
      const hasClipsWithNewThumbnails = newClips.some(
        (clip) => clip.built_thumbnail_path && !thumbnailStore.hasThumbnail(clip.id)
      );
      const hasClipsNeedingThumbnails = newClips.some(
        (clip) => !clip.built_thumbnail_path && !thumbnailStore.hasThumbnail(clip.id)
      );

      if (hasNewClips || hasClipsWithNewThumbnails || hasClipsNeedingThumbnails) {
        loadClipThumbnails();
      }
    },
    { deep: true, immediate: true }
  );

  // Load video editor project membership when clips change
  watch(
    () => props.clips,
    (newClips) => {
      if (newClips.length === 0) {
        clipProjectMembership.value = new Map();
        return;
      }
      loadClipProjectMembership(newClips);
    },
    { deep: true, immediate: true }
  );

  // Load clip thumbnails into persistent cache
  async function loadClipThumbnails() {
    // Use store's batch loading method - it handles deduplication and caching
    await thumbnailStore.loadThumbnails(props.clips);

    // Generate missing thumbnails sequentially (one at a time) for clips without built_thumbnail_path.
    // This covers cases where ProjectWorkspaceDialog is opened directly without going through Projects.vue.
    await generateMissingThumbnails();
  }

  // Load which clips are already part of a video editor project
  async function loadClipProjectMembership(clips: ClipWithVersion[]) {
    try {
      const { getVideoEditorProjectsForClip } = await import('@/services/database/video-editor-projects');
      const currentMap = new Map(clipProjectMembership.value);
      const clipIds = new Set(clips.map((clip) => clip.id));

      // Remove entries for clips no longer in the list
      for (const existingId of currentMap.keys()) {
        if (!clipIds.has(existingId)) {
          currentMap.delete(existingId);
        }
      }

      // Check only clips we haven't resolved yet
      const pendingClips = clips.filter((clip) => !currentMap.has(clip.id));
      if (pendingClips.length === 0) {
        clipProjectMembership.value = new Map(currentMap);
        return;
      }

      const batchSize = 6;
      for (let i = 0; i < pendingClips.length; i += batchSize) {
        const batch = pendingClips.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (clip) => {
            try {
              const projects = await getVideoEditorProjectsForClip(clip.id);
              return { id: clip.id, inProject: projects.length > 0 };
            } catch (error) {
              console.warn('[ClipsTab] Failed to check video editor projects for clip:', clip.id, error);
              return { id: clip.id, inProject: false };
            }
          })
        );

        for (const result of results) {
          currentMap.set(result.id, result.inProject);
        }
      }

      clipProjectMembership.value = new Map(currentMap);
    } catch (error) {
      console.warn('[ClipsTab] Failed to load video editor project membership:', error);
    }
  }

  // Generate thumbnails for clips that don't have built_thumbnail_path set
  // This handles manual clips and clips where thumbnail generation failed during detection
  // Processes ONE clip at a time to prevent spawning too many FFmpeg processes
  async function generateMissingThumbnails() {
    // Prevent concurrent runs
    if (thumbnailGenerationInProgress) return;

    const clipsWithoutThumbnails = props.clips.filter(
      (clip) => !clip.built_thumbnail_path && !thumbnailStore.hasThumbnail(clip.id)
    );

    if (clipsWithoutThumbnails.length === 0) return;

    thumbnailGenerationInProgress = true;

    const { invoke } = await import('@tauri-apps/api/core');
    const { getRawVideosByProjectId, updateClipBuildStatus } = await import('@/services/database');

    // Group clips by their project_id (clips may come from different child segments)
    const clipsByProject = new Map<string, typeof clipsWithoutThumbnails>();
    for (const clip of clipsWithoutThumbnails) {
      // Use clip's project_id, fallback to props.projectId
      const projectId = clip.project_id || props.projectId;
      if (!projectId) continue;

      if (!clipsByProject.has(projectId)) {
        clipsByProject.set(projectId, []);
      }
      clipsByProject.get(projectId)!.push(clip);
    }

    if (clipsByProject.size === 0) {
      thumbnailGenerationInProgress = false;
      return;
    }

    let hasNewThumbnails = false;

    try {
      // Process each project's clips with the correct video
      for (const [projectId, projectClips] of clipsByProject) {
        // Get the raw video for this project
        let rawVideos;
        try {
          rawVideos = await getRawVideosByProjectId(projectId);
        } catch (err) {
          console.warn(`[ClipsTab] Failed to get raw videos for project ${projectId}:`, err);
          continue;
        }

        if (!rawVideos || rawVideos.length === 0) {
          console.warn(`[ClipsTab] No raw videos found for project ${projectId}, skipping thumbnails`);
          continue;
        }

        const videoPath = normalizeLocalFilePathForFs(rawVideos[0].file_path);

        // Generate thumbnails ONE AT A TIME to prevent spawning too many FFmpeg processes
        for (const clip of projectClips) {
          try {
            const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;

            // Generate thumbnail at clip start time
            const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
              videoPath: videoPath,
              timestampSeconds: startTime + 0.5, // Slightly after start for better frame
              outputFilename: `clip_${clip.id}`,
            });

            // Load the generated thumbnail into cache
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: thumbnailPath,
            });
            thumbnailStore.setThumbnail(clip.id, dataUrl);
            hasNewThumbnails = true;

            // Persist to database (non-blocking)
            try {
              await updateClipBuildStatus(clip.id, clip.build_status || 'pending', {
                builtThumbnailPath: thumbnailPath,
              });
            } catch (err) {
              console.warn(`[ClipsTab] Failed to persist thumbnail path for clip ${clip.id}:`, err);
            }
          } catch (err) {
            console.warn(`[ClipsTab] Failed to generate thumbnail for clip ${clip.id}:`, err);
          }
        }
      }
    } finally {
      thumbnailGenerationInProgress = false;
    }

    // No need for final reactivity trigger - store handles it
  }

  // Get thumbnail URL for a clip
  function getClipThumbnail(clipId: string): string | null {
    return thumbnailStore.getThumbnail(clipId);
  }

  // Sorted clips: by virality descending across all runs
  const sortedClips = computed(() => {
    return [...props.clips].sort((a, b) => {
      // First, put manual clips at the bottom
      const aIsManual = a.session_prompt === 'Manual clip creation';
      const bIsManual = b.session_prompt === 'Manual clip creation';
      if (aIsManual !== bIsManual) {
        return aIsManual ? 1 : -1; // Manual clips go to the bottom
      }

      // For non-manual clips: sort by virality score descending (highest first)
      // This sorts ALL clips by virality regardless of which run they came from
      const viralityA = a.current_version_virality_score || 0;
      const viralityB = b.current_version_virality_score || 0;
      return viralityB - viralityA;
    });
  });

  const promptNameByContent = computed(() => {
    const map = new Map<string, string>();
    for (const prompt of props.prompts) {
      if (prompt.content && prompt.name) {
        map.set(prompt.content, prompt.name);
      }
    }
    return map;
  });

  function getPromptDisplayName(promptContent?: string | null): string | undefined {
    if (!promptContent) return undefined;
    if (promptContent === 'Manual clip creation') return 'Manual';
    return promptNameByContent.value.get(promptContent) || promptContent;
  }

  // Determine if a clip is completed/built
  const isCompletedClip = (clip: ClipWithVersion) =>
    hasCompletedBuilds(clip) ||
    clip.build_status === 'completed' ||
    (clip.status === 'generated' && Boolean(clip.built_file_path));

  // Group clips into Completed (if any) and Found Clips
  const clipSections = computed(() => {
    const completed = sortedClips.value
      .filter((clip) => isCompletedClip(clip))
      .sort((a, b) => {
        const aBuilt = a.built_at || a.current_version_created_at || a.created_at || 0;
        const bBuilt = b.built_at || b.current_version_created_at || b.created_at || 0;
        return bBuilt - aBuilt;
      });

    const inProjects = sortedClips.value.filter(
      (clip) => !isCompletedClip(clip) && clipProjectMembership.value.get(clip.id)
    );

    const found = sortedClips.value.filter(
      (clip) => !isCompletedClip(clip) && !clipProjectMembership.value.get(clip.id)
    );

    return [
      {
        title: 'Completed',
        accentClass: 'bg-emerald-400',
        clips: completed,
      },
      {
        title: 'In Projects',
        accentClass: 'bg-violet-400',
        clips: inProjects,
      },
      {
        title: 'Found Clips',
        accentClass: 'bg-blue-400',
        clips: found,
      },
    ].filter((section) => section.clips.length > 0 || section.title === 'Found Clips');
  });

  // Map clip IDs to their display index (for numbering across sections)
  const clipIndexMap = computed(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const section of clipSections.value) {
      for (const clip of section.clips) {
        map.set(clip.id, idx++);
      }
    }
    return map;
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
      case 'finalizing':
        return LoaderIcon;
      case 'completed':
        return CheckCircleIcon;
      case 'error':
        return XCircleIcon;
      default:
        return PlayIcon;
    }
  });

  const stageIconClass = computed(() => {
    return 'text-blue-500';
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
      case 'finalizing':
        return 'Finalizing';
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
      case 'finalizing':
        return 'Generating thumbnails and preparing clips...';
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
  function getClipDuration(clip: ClipWithVersion): number {
    // If clip has segments, sum their durations (for stitched clips)
    if (clip.current_version_segments && clip.current_version_segments.length > 0) {
      return clip.current_version_segments.reduce((total, segment) => {
        return total + (segment.duration || (segment.end_time - segment.start_time));
      }, 0);
    }
    // Otherwise use the time range (for continuous clips)
    return (clip.current_version_end_time || 0) - (clip.current_version_start_time || 0);
  }

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
    return formatDateTime(new Date(timestamp * 1000));
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

  /** Source paths for all built outputs in the Completed section (same order as the list). */
  const completedDownloadSourcePaths = computed(() => {
    const sec = clipSections.value.find((s) => s.title === 'Completed');
    if (!sec?.clips.length) return [];
    const paths: string[] = [];
    for (const clip of sec.clips) {
      const downloadable = getDownloadableFiles(clip);
      if (downloadable.length > 0) {
        for (const f of downloadable) paths.push(f.filePath);
      } else if (clip.built_file_path) {
        paths.push(clip.built_file_path);
      }
    }
    return paths;
  });

  const completedDownloadAllFileCount = computed(() => completedDownloadSourcePaths.value.length);

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
      case 'finalizing':
        return 'Generating thumbnails...';
      case 'completed':
        return 'Clips ready!';
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
      case 'finalizing':
        return 'Finalizing...';
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
      case 'finalizing':
        return 'Generating thumbnails...';
      case 'completed':
        return 'Ready!';
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

        // Force reset if the UI thinks it's building but backend says no
        const clip = props.clips.find((c) => c.id === clipId);
        if (clip && clip.build_status === 'building') {
          console.warn('[ClipsTab] Clip stuck in building state, forcing reset:', clipId);
          const { updateClipBuildStatus } = await import('@/services/database');
          await updateClipBuildStatus(clipId, 'pending', { error: 'Build process not found' });
          emit('refreshClips');

          const toastComposable = await import('@/composables/useToast');
          const { success: showSuccessToast } = toastComposable.useToast();
          showSuccessToast('Build Reset', 'Build was stuck and has been reset.');
        }
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

  function onPublishNow(clip: ClipWithVersion) {
    emit('publishNow', clip);
  }

  function onAdjustClip(clipId: string) {
    emit('adjustClip', clipId);
  }

  function onClearFromInEditor(clipId: string) {
    inEditorStore.clearClip(clipId);
    console.log('[ClipsTab] Cleared clip from in-editor tracking:', clipId);
  }

  function onClipClick(clipId: string) {
    const clip = props.clips.find((c) => c.id === clipId);

    if (clip && props.playOnCardClick) {
      onPlayClip(clip);
    }

    if (clip?.current_version_segments && clip.current_version_segments.length > 0) {
      const sortedSegments = [...clip.current_version_segments].sort((a, b) => a.start_time - b.start_time);
      const firstSegment = sortedSegments[0];
      emit('seekVideo', firstSegment.start_time);
    }

    hoveredClipId.value = clipId;
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
    console.log('[ClipsTab] onBuildClip called for clip:', clip.id, {
      projectId: props.projectId,
      hasSegments: !!(clip.current_version_segments && clip.current_version_segments.length > 0),
      segmentCount: clip.current_version_segments?.length || 0,
    });

    if (!props.projectId) {
      console.error('[ClipsTab] No project ID available for clip build');
      await showError('Cannot Build Clip', 'No project ID available. Please try reopening the project.');
      return;
    }

    // Check if we have segments or can derive them from clip times
    const hasSegments = clip.current_version_segments && clip.current_version_segments.length > 0;
    const hasClipTimes =
      (clip.current_version_start_time !== undefined && clip.current_version_end_time !== undefined) ||
      (clip.start_time !== undefined && clip.end_time !== undefined);

    if (!hasSegments && !hasClipTimes) {
      console.error('[ClipsTab] No segments or clip times found for clip build - clip data:', {
        id: clip.id,
        name: clip.name,
        current_version_segments: clip.current_version_segments,
        current_version_start_time: clip.current_version_start_time,
        current_version_end_time: clip.current_version_end_time,
        start_time: clip.start_time,
        end_time: clip.end_time,
      });
      await showError(
        'Cannot Build Clip',
        'No clip timing data found. Please edit the clip to set start and end times.'
      );
      return;
    }

    if (!hasSegments) {
      console.log('[ClipsTab] No segments found, will use clip times for build');
    }

    // Reset saved settings first (will be loaded async)
    savedAspectRatios.value = null;
    savedFramingMode.value = null;
    savedFramingConfigs.value = null;

    // CRITICAL: Fetch latest subtitle columns from DB so the build dialog matches what was saved
    try {
      const { getClip } = await import('@/services/database/clips');
      const dbClip = await getClip(clip.id);
      if (dbClip) {
        const c = clip as any;
        c.subtitle_settings = dbClip.subtitle_settings;
        c.subtitle_preset_id = dbClip.subtitle_preset_id;
        c.subtitle_enabled = dbClip.subtitle_enabled;
        c.subtitle_position_x = dbClip.subtitle_position_x;
        c.subtitle_position_y = dbClip.subtitle_position_y;
        c.subtitle_position_width = dbClip.subtitle_position_width;
        console.log('[ClipsTab] Merged subtitle fields from database:', {
          clipId: clip.id,
          hasSubtitleSettings: !!clip.subtitle_settings,
          subtitleSettingsType: typeof clip.subtitle_settings,
          presetId: c.subtitle_preset_id,
        });
      }
    } catch (error) {
      console.warn('[ClipsTab] Failed to load subtitle fields from database:', error);
    }

    // Open dialog immediately (don't wait for async operations)
    clipToBuild.value = clip;
    showBuildSettingsDialog.value = true;
    emit('buildDialogOpen', true);

    // Load saved aspect framing settings in background (dialog will use defaults until loaded)
    loadSavedAspectSettings(clip.id);
  }

  // Load saved aspect framing settings asynchronously
  async function loadSavedAspectSettings(clipId: string) {
    try {
      const { getFullClipEdit } = await import('@/services/database');
      const clipEdit = await getFullClipEdit(clipId);

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
        }
      }
    } catch (err) {
      console.warn('[ClipsTab] Could not load saved aspect framing settings:', err);
    }
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

    // Optimistically flip the clip into the "building" state so the loading
    // overlay appears the instant the user clicks Build. Without this, the UI
    // doesn't show the loader until `updateClipBuildStatus` (DB write) and the
    // final `emit('refreshClips')` further below complete — which can take
    // several seconds because of the dynamic imports, DB reads, and per-target
    // setup that run between here and the actual build invoke. The DB write
    // and refresh further down reconcile this mutation, so there's no drift.
    const clipMut = clip as any;
    clipMut.build_status = 'building';
    clipMut.build_progress = 0;
    clipMut.build_error = null;

    try {
      // Refresh clip subtitle payload from DB so build uses latest saved editor state (not stale in-memory clip)
      try {
        const { getClip } = await import('@/services/database/clips');
        const fresh = await getClip(clip.id);
        if (fresh) {
          const c = clip as any;
          c.subtitle_settings = fresh.subtitle_settings;
          c.subtitle_preset_id = fresh.subtitle_preset_id;
          c.subtitle_enabled = fresh.subtitle_enabled;
          c.subtitle_position_x = fresh.subtitle_position_x;
          c.subtitle_position_y = fresh.subtitle_position_y;
          c.subtitle_position_width = fresh.subtitle_position_width;
        }
      } catch (e) {
        console.warn('[ClipsTab] Could not refresh clip before build invoke:', e);
      }

      console.log('[ClipsTab] Starting clip build for:', clip.id, 'with settings:', settings);
      console.log('[ClipsTab] Aspect ratios received:', settings.aspectRatios);

      // ── Group build targets by unique type+id ─────────────────────────────
      // Each group gets its own branding resolution and Rust invoke.
      // e.g. [{type:'org',id:2,ratio:'16:9'},{type:'org',id:2,ratio:'9:16'},{type:'campaign',id:1,ratio:'16:9'}]
      // → groups: [{target, ratios:['16:9','9:16']}, {target, ratios:['16:9']}]
      interface TargetGroup {
        key: string;
        type: 'org' | 'campaign' | 'personal' | 'legacy';
        target: BuildTarget | null;
        ratios: string[];
        campaignId: number | null;
        brandingProfileId: number | null;
        organizationId: number | undefined;
        selectedCampaign: any;
      }

      const targetGroups: TargetGroup[] = [];

      if (settings.buildTargets && settings.buildTargets.length > 0) {
        const groupMap = new Map<string, TargetGroup>();
        for (const bt of settings.buildTargets) {
          const key = `${bt.type}-${bt.id}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              key,
              type: bt.type,
              target: bt,
              ratios: [],
              campaignId: bt.type === 'campaign' ? bt.id : null,
              brandingProfileId: bt.brandingProfileId ?? null,
              organizationId: bt.organizationId,
              selectedCampaign: bt.type === 'campaign' ? settings.selectedCampaign : null,
            });
          }
          const group = groupMap.get(key)!;
          for (const r of bt.aspectRatios) {
            if (!group.ratios.includes(r)) group.ratios.push(r);
          }
        }
        targetGroups.push(...groupMap.values());
      } else {
        // Legacy: no buildTargets, run a single build with settings defaults
        targetGroups.push({
          key: 'legacy',
          type: 'legacy',
          target: null,
          ratios: [...settings.aspectRatios],
          campaignId: settings.campaignId ?? null,
          brandingProfileId: settings.campaignBrandingProfileId ?? null,
          organizationId: undefined,
          selectedCampaign: settings.selectedCampaign ?? null,
        });
      }

      console.log('[ClipsTab] Build target groups:', targetGroups.map(g => ({
        key: g.key,
        type: g.type,
        ratios: g.ratios,
        campaignId: g.campaignId,
        brandingProfileId: g.brandingProfileId,
      })));

      const { updateClipBuildStatus, getRawVideosByProjectId, createClipBuild, getClipBuilds } = await import(
        '@/services/database'
      );
      const { getIntroOutroById, resolveIntroOutroById } = await import('@/services/database/intro-outros');
      const { resolveWatermarkById, resolveLayoutOverlaysForBuild } = await import('@/services/database/watermarks');

      // Update database status to building
      await updateClipBuildStatus(clip.id, 'building', { progress: 0 });

      // buildId and buildNumber are created per target group inside the loop below

      // Get the project video file path
      // IMPORTANT: Always use the original raw video, not build outputs
      // clip.file_path may point to a previous build output (e.g., clip_at_112527_9-16_2.mp4)
      // which would cause FFmpeg to fail when building different aspect ratios
      let projectVideo: { file_path: string; duration?: number | null };
      const isBuildOutput = isClipBuildOutputPath(clip.file_path);
      const selfContainedClip = isSelfContainedLiveClip(clip) && !isBuildOutput;

      if ((selfContainedClip || clip.file_path) && clip.file_path && !isBuildOutput) {
        // Manual/auto live clips are self-contained files. Build the whole file from 0s.
        console.log('[ClipsTab] Using clip file_path as build source:', {
          filePath: clip.file_path,
          selfContainedClip,
        });
        projectVideo = {
          file_path: clip.file_path,
          duration: clip.duration || undefined,
        };
      } else {
        // Get raw video from project (for regular clips or if file_path is a build output)
        if (isBuildOutput) {
          console.log('[ClipsTab] Detected build output in file_path, using raw video instead:', clip.file_path);
        }
        const clipProjectId = clip.project_id || props.projectId;
        if (!clipProjectId) {
          throw new Error('No project ID available for clip');
        }
        const rawVideos = await getRawVideosByProjectId(clipProjectId);
        if (rawVideos.length === 0) {
          throw new Error('No project video found');
        }
        projectVideo = rawVideos[0];
        console.log('[ClipsTab] Using raw video from project:', projectVideo.file_path);
      }

      // IMPORTANT: Reload segments from database to get latest edits from timeline
      // The clip object in props may have stale data if user edited segments on timeline
      const { getClipSegmentsByVersionId } = await import('@/services/database/clip-segments');
      let freshSegments = clip.current_version_segments || [];
      const selfContainedTranscript = selfContainedClip
        ? await loadSelfContainedClipTranscript(clip.project_id || props.projectId, clip)
        : null;
      const anchoredSelfContainedTranscript =
        selfContainedClip && selfContainedTranscript
          ? trimSelfContainedTranscriptToAnchor(clip, selfContainedTranscript)
          : null;

      if (selfContainedClip) {
        const duration = getSelfContainedClipDuration(clip);
        if (duration <= 0) {
          throw new Error('Invalid clip duration for auto-detected clip build');
        }

        freshSegments = [
          {
            id: `self-contained-${clip.id}`,
            clip_version_id: clip.current_version_id || '',
            segment_index: 0,
            start_time: 0,
            end_time: duration,
            duration,
            transcript: selfContainedTranscript?.text || null,
            transcript_raw_json: null,
            audio_peaks: null,
            created_at: Date.now(),
          },
        ];
        console.log('[ClipsTab] Building self-contained auto/live clip as 0-based full file:', {
          clipId: clip.id,
          duration,
          hasOwnTranscript: !!selfContainedTranscript,
        });
      } else if (clip.current_version_id) {
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

      // If no segments exist, create a synthetic segment from clip times
      if (freshSegments.length === 0) {
        const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;
        const endTime = clip.current_version_end_time ?? clip.end_time ?? 0;

        if (endTime > startTime) {
          console.log('[ClipsTab] Creating synthetic segment from clip times:', { startTime, endTime });
          freshSegments = [
            {
              id: `synthetic-${clip.id}`,
              clip_version_id: clip.current_version_id || '',
              segment_index: 0,
              start_time: startTime,
              end_time: endTime,
              duration: endTime - startTime,
              transcript: null,
              transcript_raw_json: null,
              audio_peaks: null,
              created_at: Date.now(),
            },
          ];
        } else {
          throw new Error('Invalid clip times: end time must be greater than start time');
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

      // Get transcript data from props (already computed in parent)
      const sourceSegmentsForSelfContained = selfContainedClip ? getSourceSegmentsForSelfContainedClip(clip) : [];
      const useSourceTranscriptForSelfContained =
        selfContainedClip && !anchoredSelfContainedTranscript && wordsOverlapSegments(props.transcriptData?.words, sourceSegmentsForSelfContained);
      const sourceTranscriptWords = useSourceTranscriptForSelfContained
        ? props.transcriptData?.words || []
        : anchoredSelfContainedTranscript?.words || props.transcriptData?.words || [];
      const shouldUseSourceWindowForSubtitles =
        selfContainedClip && (useSourceTranscriptForSelfContained || !anchoredSelfContainedTranscript);
      const sourceSegmentsForSubtitles =
        shouldUseSourceWindowForSubtitles
          ? sourceSegmentsForSelfContained
          : freshSegments;
      const sourceBasedTranscriptWords = buildEditedSubtitleWordsForExport(
        sourceSegmentsForSubtitles,
        sourceTranscriptWords
      );
      const transcriptWords =
        shouldUseSourceWindowForSubtitles && sourceSegmentsForSubtitles.length > 0
          ? rebaseWordsToClipStart(
              sourceBasedTranscriptWords,
              Number(sourceSegmentsForSubtitles[0].start_time) || 0,
              getSelfContainedClipDuration(clip)
            )
          : sourceBasedTranscriptWords;
      const transcriptSegments = useSourceTranscriptForSelfContained
        ? props.transcriptData?.whisperSegments || []
        : anchoredSelfContainedTranscript?.whisperSegments || props.transcriptData?.whisperSegments || [];

      // Prepare watermark settings if enabled (reused for personal workspace fallback per target)
      // Now supports per-aspect-ratio watermark files - each ratio can use a completely different watermark
      // Uses resolveWatermarkById to handle both local IDs and org-asset-{serverId} format
      type ResolvedWatermarkPayload = {
        enabled: true;
        watermarkId: string;
        filePath: string;
        width: number;
        height: number;
        positionX: number;
        positionY: number;
        opacity: number;
        scale: number;
        perRatioSettings: Record<
          string,
          {
            watermarkId: string | null;
            filePath: string | null;
            width: number | null;
            height: number | null;
            position: { x: number; y: number; opacity: number; scale: number } | null;
          } | null
        >;
      };
      async function buildWatermarkInvokePayload(
        wm: WatermarkSettings | null | undefined
      ): Promise<ResolvedWatermarkPayload | null> {
        if (!wm?.enabled || !wm.watermarkId) return null;
        const defaultWatermark = await resolveWatermarkById(wm.watermarkId);
        if (!defaultWatermark) return null;
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

        const allRatios = ['16:9', '9:16', '1:1', '4:5'];
        for (const ratio of allRatios) {
          const perRatioConfig = wm.perRatioSettings?.[ratio as keyof typeof wm.perRatioSettings];

          if (perRatioConfig === null) {
            buildPerRatioSettings[ratio] = null;
            console.log(`[ClipsTab] Watermark disabled for ${ratio}`);
          } else if (perRatioConfig) {
            const ratioWatermarkId = perRatioConfig.watermarkId;
            let ratioFilePath = defaultWatermark.filePath;
            let ratioWidth = defaultWatermark.width;
            let ratioHeight = defaultWatermark.height;

            if (ratioWatermarkId && ratioWatermarkId !== wm.watermarkId) {
              const ratioWatermark = await resolveWatermarkById(ratioWatermarkId);
              if (ratioWatermark) {
                ratioFilePath = ratioWatermark.filePath;
                ratioWidth = ratioWatermark.width;
                ratioHeight = ratioWatermark.height;
                console.log(`[ClipsTab] Using different watermark for ${ratio}:`, ratioWatermarkId);
              }
            }

            const position = perRatioConfig.position || {
              x: wm.positionX,
              y: wm.positionY,
              opacity: wm.opacity,
              scale: wm.scale,
            };

            buildPerRatioSettings[ratio] = {
              watermarkId: ratioWatermarkId || wm.watermarkId,
              filePath: ratioFilePath,
              width: ratioWidth,
              height: ratioHeight,
              position,
            };
          } else {
            buildPerRatioSettings[ratio] = {
              watermarkId: wm.watermarkId,
              filePath: defaultWatermark.filePath,
              width: defaultWatermark.width,
              height: defaultWatermark.height,
              position: {
                x: wm.positionX,
                y: wm.positionY,
                opacity: wm.opacity,
                scale: wm.scale,
              },
            };
          }
        }

        const payload: ResolvedWatermarkPayload = {
          enabled: true,
          watermarkId: wm.watermarkId,
          filePath: defaultWatermark.filePath,
          width: defaultWatermark.width ?? 0,
          height: defaultWatermark.height ?? 0,
          positionX: wm.positionX,
          positionY: wm.positionY,
          opacity: wm.opacity,
          scale: wm.scale,
          perRatioSettings: buildPerRatioSettings,
        };
        const defaultWatermarkId = wm.watermarkId;
        console.log('[ClipsTab] Watermark settings for build:', {
          defaultWatermarkId: defaultWatermarkId,
          defaultFilePath: defaultWatermark.filePath,
          selectedRatios: settings.aspectRatios,
          perRatioSettings: Object.entries(buildPerRatioSettings).map(([ratio, config]) => ({
            ratio,
            enabled: config !== null,
            watermarkId: config?.watermarkId,
            hasCustomWatermark: config?.watermarkId !== defaultWatermarkId,
          })),
        });
        return payload;
      }

      let watermarkSettings = await buildWatermarkInvokePayload(settings.watermark);

      let cachedPersonalWatermarkFallback: ResolvedWatermarkPayload | null | undefined;
      async function getPersonalWatermarkFallback(): Promise<ResolvedWatermarkPayload | null> {
        if (cachedPersonalWatermarkFallback !== undefined) return cachedPersonalWatermarkFallback;
        if (!props.watermarkSettings?.enabled || !props.watermarkSettings.watermarkId) {
          cachedPersonalWatermarkFallback = null;
          return null;
        }
        cachedPersonalWatermarkFallback = await buildWatermarkInvokePayload(props.watermarkSettings);
        return cachedPersonalWatermarkFallback;
      }

      // Load audio settings for the project
      const { getProjectAudioSettings, getFullClipEdit } = await import('@/services/database');
      const { getClip } = await import('@/services/database/clips');
      const { parseClipTextOverlayJson, clipTextBoxToExportPayload } = await import('@/utils/clipTextBox');
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

        const clipRowForText = await getClip(clip.id);
        const clipTextBoxState = parseClipTextOverlayJson(clipRowForText?.clip_text_overlay);
        console.log('[ClipsTab] Clip text box state from DB:', {
          clipId: clip.id,
          hasClipTextOverlay: !!clipRowForText?.clip_text_overlay,
          rawLength: clipRowForText?.clip_text_overlay?.length ?? 0,
          parsed: clipTextBoxState,
          enabled: clipTextBoxState?.enabled,
        });
        if (clipTextBoxState?.enabled) {
          const clipBoxPayload = clipTextBoxToExportPayload(clip.id, clipTextBoxState);
          textOverlaysForExport = textOverlaysForExport
            ? [...textOverlaysForExport, clipBoxPayload]
            : [clipBoxPayload];
          console.log('[ClipsTab] Merged workspace/POI clip text box for export:', {
            text: clipBoxPayload.text,
            startTime: clipBoxPayload.startTime,
            endTime: clipBoxPayload.endTime,
            positionX: clipBoxPayload.positionX,
            positionY: clipBoxPayload.positionY,
            hasPerRatioConfigs: !!clipBoxPayload.perRatioConfigs,
            perRatioKeys: clipBoxPayload.perRatioConfigs ? Object.keys(clipBoxPayload.perRatioConfigs) : [],
          });
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
          // For manual mode with per-ratio configs, DON'T create a single framingStrategy
          // The backend will use manualFramingConfigs to apply the correct config per ratio
          console.log(
            '[ClipsTab] Using manual framing configuration with per-ratio configs:',
            Object.keys(settings.manualFramingConfigs || {})
          );
          
          // Leave framingStrategy as null - the backend will use manualFramingConfigs instead
          // This ensures each aspect ratio gets its own unique crop regions
          framingStrategy = null;
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

      // Refresh clip data from database to get latest subtitle settings
      // (user may have changed settings in POI editor during this session)
      // getClip already imported above in this function (clip edit / text overlay load)
      const freshClipData = await getClip(clip.id);
      let effectiveSubtitleSettings: SubtitleSettings | null = null;

      const vodSubtitleDefaults = props.vodPresetConfig?.subtitleDefaults;
      const shouldUseLivePreviewSettingsForBuild =
        !!props.subtitleSettings && clip.id === props.subtitleSettingsClipId;

      if (shouldUseLivePreviewSettingsForBuild) {
        effectiveSubtitleSettings = mergeVodSubtitleDefaultsWithSavedSettings(
          props.subtitleSettings,
          vodSubtitleDefaults
        );
        console.log('[ClipsTab] Using LIVE preview subtitle settings for current clip build');
      } else if (freshClipData?.subtitle_settings) {
        try {
          const savedSettings = typeof freshClipData.subtitle_settings === 'string'
            ? JSON.parse(freshClipData.subtitle_settings)
            : freshClipData.subtitle_settings;
          effectiveSubtitleSettings = mergeVodSubtitleDefaultsWithSavedSettings(savedSettings, vodSubtitleDefaults);
          console.log('[ClipsTab] Loaded FRESH subtitle settings from database:', {
            animationStyle: savedSettings.animationStyle,
            hasPerRatioConfigs: !!savedSettings.perRatioConfigs,
            perRatioKeys: savedSettings.perRatioConfigs ? Object.keys(savedSettings.perRatioConfigs) : [],
          });
        } catch (error) {
          console.error('[ClipsTab] Failed to parse fresh subtitle_settings:', error);
        }
      } else if (vodSubtitleDefaults && typeof vodSubtitleDefaults === 'object') {
        effectiveSubtitleSettings = cloneSubtitleSettings(vodSubtitleDefaults);
        console.log('[ClipsTab] Using VOD pre-edit subtitle defaults for build');
      }

      // Fall back to derived settings or prop if fresh load failed
      if (!effectiveSubtitleSettings) {
        effectiveSubtitleSettings = buildDialogSubtitleSettings.value;
        console.log('[ClipsTab] Using fallback subtitle settings for build');
      }

      if (effectiveSubtitleSettings && freshClipData) {
        effectiveSubtitleSettings = mergeDraggedSubtitlePositionForBuild(
          effectiveSubtitleSettings,
          freshClipData,
          settings.aspectRatios
        );
      }

      // Helper: build SubtitleSettings from a CAPTION_PRESETS id
      function buildSettingsFromPresetId(presetId: string): Partial<SubtitleSettings> | null {
        const preset = CAPTION_PRESETS.find((p) => p.id === presetId);
        if (!preset) return null;
        const fontWeightMap: Record<string, number> = {
          normal: 400, bold: 700,
          '100': 100, '200': 200, '300': 300, '400': 400,
          '500': 500, '600': 600, '700': 700, '800': 800, '900': 900,
        };
        const animMap: Record<string, SubtitleSettings['animationStyle']> = {
          none: 'none', karaoke: 'karaoke', 'karaoke-scale': 'karaoke',
          zoom: 'zoom', pop: 'pop', glow: 'glow',
          'box-highlight': 'box-highlight', typewriter: 'typewriter', wave: 'wave',
        };
        return {
          selectedPresetId: preset.id,
          fontFamily: preset.fontFamily,
          fontSize: preset.fontSize,
          fontWeight: fontWeightMap[String(preset.fontWeight)] ?? 700,
          textColor: preset.color,
          backgroundColor: preset.backgroundColor,
          backgroundEnabled: preset.backgroundColor !== 'transparent',
          animationStyle: animMap[preset.highlightStyle] ?? 'none',
          highlightColor: preset.highlightColor,
          border1Width: preset.stroke?.width ?? 0,
          border1Color: preset.stroke?.color ?? '#000000',
          shadowBlur: preset.shadow?.blur ?? 0,
          shadowOffsetX: preset.shadow?.offsetX ?? 0,
          shadowOffsetY: preset.shadow?.offsetY ?? 0,
          shadowColor: preset.shadow?.color ?? '#000000',
          lineHeight: preset.lineHeight,
          letterSpacing: preset.letterSpacing,
          wordSpacing: 0.35,
        };
      }

      // Pass all build settings to the backend (including build number for filename)
      // Merge perRatioConfigs from clip editor with subtitleOverrides from build settings
      // perRatioConfigs from clip editor takes precedence (user configured in editor)
      let finalSubtitleOverrides = settings.subtitleOverrides || null;
      if (effectiveSubtitleSettings?.perRatioConfigs) {
        const editorOverrides: Record<string, any> = {};
        for (const [ratio, config] of Object.entries(effectiveSubtitleSettings.perRatioConfigs)) {
          // Include ALL properties from perRatioConfigs, not just position/size
          // The Rust code can read any property from the per_ratio_override JSON
          editorOverrides[ratio] = { ...config };
        }
        finalSubtitleOverrides = {
          ...(settings.subtitleOverrides || {}),
          ...editorOverrides,
        };
      }

      // Apply per-ratio presetId overrides: if a ratio has a presetId, use preset as BASE
      // and let user's custom settings override the preset defaults.
      // IMPORTANT: User's settings (...ov) must come AFTER preset (...presetOverride)
      // so that user's custom animationStyle, colors, etc. take precedence.
      if (finalSubtitleOverrides) {
        for (const [ratio, override] of Object.entries(finalSubtitleOverrides)) {
          const ov = override as any;
          if (ov?.presetId) {
            const presetOverride = buildSettingsFromPresetId(ov.presetId);
            if (presetOverride) {
              // Preset is BASE, user's settings override
              (finalSubtitleOverrides as any)[ratio] = { ...presetOverride, ...ov };
            }
          }
        }
      }

      console.log('[ClipsTab] Subtitle payload before build invoke:', {
        clipId: clip.id,
        baseAnimationStyle: effectiveSubtitleSettings?.animationStyle,
        baseFontFamily: effectiveSubtitleSettings?.fontFamily,
        baseTextColor: effectiveSubtitleSettings?.textColor,
        baseHighlightColor: effectiveSubtitleSettings?.highlightColor,
        baseBorder1Width: effectiveSubtitleSettings?.border1Width,
        baseFontSize: effectiveSubtitleSettings?.fontSize,
        hasPerRatioConfigs: !!effectiveSubtitleSettings?.perRatioConfigs,
        perRatioConfigKeys: effectiveSubtitleSettings?.perRatioConfigs
          ? Object.keys(effectiveSubtitleSettings.perRatioConfigs)
          : [],
        overrideKeys: finalSubtitleOverrides ? Object.keys(finalSubtitleOverrides) : [],
        overridePreview: finalSubtitleOverrides
          ? Object.fromEntries(
              Object.entries(finalSubtitleOverrides).map(([ratio, ov]) => {
                const v = ov as any;
                return [ratio, {
                  animationStyle: v?.animationStyle,
                  fontFamily: v?.fontFamily,
                  textColor: v?.textColor,
                  highlightColor: v?.highlightColor,
                  fontSize: v?.fontSize,
                  border1Width: v?.border1Width,
                  positionPercentage: v?.positionPercentage,
                  maxWidth: v?.maxWidth,
                  hasPalette: Array.isArray(v?.colorPalette) && v.colorPalette.length > 0,
                }];
              })
            )
          : null,
      });

      // ── Per-Target Build Loop ──────────────────────────────────────────────
      // Each target group gets its own branding resolution and Rust invoke.
      for (const tg of targetGroups) {
      const activeCampaignId = tg.campaignId;
      const activeCampaignBrandingProfileId = tg.brandingProfileId;
      const activeBrandingType = tg.type;
      const activeTarget = tg.target;
      const targetRatios = tg.ratios;

      console.log('[ClipsTab] Processing target group:', {
        key: tg.key,
        type: tg.type,
        ratios: targetRatios,
        campaignId: activeCampaignId,
        brandingProfileId: activeCampaignBrandingProfileId,
      });

      // Calculate build number for this target group
      let buildNumber = 1;
      try {
        // Get existing builds to determine the next build number
        const existingBuilds = await getClipBuilds(clip.id);
        buildNumber = existingBuilds.length + 1;
        console.log('[ClipsTab] Calculated build number for target group', tg.key, ':', buildNumber, '(existing builds:', existingBuilds.length, ')');
      } catch {
        // Table might not exist yet
        buildNumber = 1;
        console.log('[ClipsTab] Using default build number 1 for target group', tg.key);
      }

      // Create a unique build record for this target group
      let buildId: string | null = null;
      try {
        const brandingType = tg.campaignId ? 'campaign' : tg.organizationId ? 'org' : 'personal';
        console.log('[ClipsTab] Build branding data:', {
          targetGroupKey: tg.key,
          targetGroupType: tg.type,
          campaignId: tg.campaignId,
          organizationId: tg.organizationId,
          calculatedBrandingType: brandingType,
          campaignName: tg.selectedCampaign?.title,
          orgName: tg.target?.type === 'org' ? (tg.target as any).name : (tg.selectedCampaign?.organization?.name || null),
        });
        
        buildId = await createClipBuild(clip.id, {
          aspectRatios: targetRatios,
          quality: settings.quality,
          frameRate: settings.frameRate,
          outputFormat: settings.format,
          includeSubtitles: effectiveSubtitleSettings?.enabled ?? false,
          organizationId: tg.organizationId || null,
          organizationName: tg.target?.type === 'org' 
            ? (tg.target as any).name
            : (tg.selectedCampaign?.organization?.name || null),
          campaignId: tg.campaignId || null,
          campaignName: tg.selectedCampaign?.title || null,
          brandingProfileId: tg.brandingProfileId ? String(tg.brandingProfileId) : null,
          brandingType: brandingType,
        });
        console.log('[ClipsTab] Created build record for target group', tg.key, ':', buildId, 'build number:', buildNumber);
      } catch (err) {
        console.warn('[ClipsTab] Could not create build record for target group', tg.key, ':', err);
      }

      // Clone watermarkSettings for this target (so campaign overrides don't leak between groups)
      let targetWatermarkSettings = watermarkSettings ? { ...watermarkSettings } : null;

      // Personal / legacy builds: use workspace watermark when the dialog emitted none (e.g. edge timing).
      // Never use this for org/campaign targets — those resolve their own branding.
      if (
        (activeBrandingType === 'personal' || activeBrandingType === 'legacy') &&
        !activeCampaignId &&
        !targetWatermarkSettings
      ) {
        const fb = await getPersonalWatermarkFallback();
        if (fb) {
          targetWatermarkSettings = { ...fb };
          console.log('[ClipsTab] Personal workspace watermark applied for personal/legacy target');
        }
      }

      // ── Campaign Branding Override ────────────────────────────────────────────
      let campaignOverrideIntro: IntroOutroRef | null = null;
      let campaignOverrideOutro: IntroOutroRef | null = null;
      let campaignOverrideWatermark: WatermarkSettings | null = null;

      if (activeCampaignId && tg.selectedCampaign && tg.selectedCampaign.id === activeCampaignId) {
        const campaign = tg.selectedCampaign;
        console.log('[ClipsTab] Applying campaign branding for:', campaign.title, '(id:', campaign.id, ')');

        if (campaign.global_intro) {
          const introResult = await ensureAssetDownloaded({
            id: campaign.global_intro.id,
            name: campaign.global_intro.name,
            asset_type: 'intro',
            url: campaign.global_intro.url,
            organization_id: campaign.organization_id,
            organization_name: campaign.organization?.name || '',
            duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : undefined,
            inserted_at: campaign.inserted_at,
            updated_at: campaign.updated_at,
          } as unknown as ServerOrganizationAsset);
          if (introResult.success && introResult.filePath) {
            campaignOverrideIntro = {
              id: `org-asset-${campaign.global_intro.id}`,
              type: 'intro',
              name: campaign.global_intro.name,
              file_path: introResult.filePath,
              duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : null,
              thumbnail_path: campaign.global_intro.thumbnail_url || null,
            };
            console.log('[ClipsTab] Campaign global intro applied:', campaign.global_intro.name);
          }
        }

        if (campaign.global_outro) {
          const outroResult = await ensureAssetDownloaded({
            id: campaign.global_outro.id,
            name: campaign.global_outro.name,
            asset_type: 'outro',
            url: campaign.global_outro.url,
            organization_id: campaign.organization_id,
            organization_name: campaign.organization?.name || '',
            duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : undefined,
            inserted_at: campaign.inserted_at,
            updated_at: campaign.updated_at,
          } as unknown as ServerOrganizationAsset);
          if (outroResult.success && outroResult.filePath) {
            campaignOverrideOutro = {
              id: `org-asset-${campaign.global_outro.id}`,
              type: 'outro',
              name: campaign.global_outro.name,
              file_path: outroResult.filePath,
              duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : null,
              thumbnail_path: campaign.global_outro.thumbnail_url || null,
            };
            console.log('[ClipsTab] Campaign global outro applied:', campaign.global_outro.name);
          }
        }

        const campaignCreatorProfile = campaign.branding_profile || campaign.creator_profiles?.[0] || campaign.creator_profile;
        // Also check branding_profile for intro/outro if global_intro/global_outro were not set
        if (!campaignOverrideIntro && campaignCreatorProfile?.intro?.url) {
          try {
            const introResult = await ensureAssetDownloaded({
              id: campaignCreatorProfile.intro.id,
              name: campaignCreatorProfile.intro.name,
              asset_type: 'intro',
              url: campaignCreatorProfile.intro.url,
              organization_id: campaign.organization_id,
              organization_name: campaign.organization?.name || '',
              duration: campaignCreatorProfile.intro.duration ? parseFloat(campaignCreatorProfile.intro.duration) : undefined,
              inserted_at: campaign.inserted_at,
              updated_at: campaign.updated_at,
            } as unknown as ServerOrganizationAsset);
            if (introResult.success && introResult.filePath) {
              campaignOverrideIntro = {
                id: `org-asset-${campaignCreatorProfile.intro.id}`,
                type: 'intro',
                name: campaignCreatorProfile.intro.name,
                file_path: introResult.filePath,
                duration: campaignCreatorProfile.intro.duration ? parseFloat(campaignCreatorProfile.intro.duration) : null,
                thumbnail_path: campaignCreatorProfile.intro.thumbnail_url || null,
              };
              console.log('[ClipsTab] Campaign branding_profile intro applied:', campaignCreatorProfile.intro.name);
            }
          } catch (e) {
            console.warn('[ClipsTab] Failed to download campaign branding_profile intro:', e);
          }
        }

        if (!campaignOverrideOutro && campaignCreatorProfile?.outro?.url) {
          try {
            const outroResult = await ensureAssetDownloaded({
              id: campaignCreatorProfile.outro.id,
              name: campaignCreatorProfile.outro.name,
              asset_type: 'outro',
              url: campaignCreatorProfile.outro.url,
              organization_id: campaign.organization_id,
              organization_name: campaign.organization?.name || '',
              duration: campaignCreatorProfile.outro.duration ? parseFloat(campaignCreatorProfile.outro.duration) : undefined,
              inserted_at: campaign.inserted_at,
              updated_at: campaign.updated_at,
            } as unknown as ServerOrganizationAsset);
            if (outroResult.success && outroResult.filePath) {
              campaignOverrideOutro = {
                id: `org-asset-${campaignCreatorProfile.outro.id}`,
                type: 'outro',
                name: campaignCreatorProfile.outro.name,
                file_path: outroResult.filePath,
                duration: campaignCreatorProfile.outro.duration ? parseFloat(campaignCreatorProfile.outro.duration) : null,
                thumbnail_path: campaignCreatorProfile.outro.thumbnail_url || null,
              };
              console.log('[ClipsTab] Campaign branding_profile outro applied:', campaignCreatorProfile.outro.name);
            }
          } catch (e) {
            console.warn('[ClipsTab] Failed to download campaign branding_profile outro:', e);
          }
        }

        if (campaignCreatorProfile?.watermark?.url) {
          try {
            const filename = `campaign-watermark-${campaignCreatorProfile.watermark.id}.png`;
            const filePath = await invoke<string>('download_org_asset_from_url', {
              url: campaignCreatorProfile.watermark.url,
              filename,
              assetType: 'watermarks',
              organizationId: String(campaign.organization_id),
            });
            let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
            if (campaignCreatorProfile.watermark_settings) {
              try {
                const wmSettings = typeof campaignCreatorProfile.watermark_settings === 'string'
                  ? JSON.parse(campaignCreatorProfile.watermark_settings as unknown as string)
                  : campaignCreatorProfile.watermark_settings;
                const ratioConfig = wmSettings['16:9'];
                if (ratioConfig?.position) defaultPos = ratioConfig.position;
              } catch (e) {
                console.warn('[ClipsTab] Failed to parse campaign watermark settings:', e);
              }
            }
            campaignOverrideWatermark = {
              enabled: true,
              watermarkId: `org-asset-${campaignCreatorProfile.watermark.id}`,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
              perRatioSettings: (campaignCreatorProfile.watermark_settings as any) ?? null,
            };
            console.log('[ClipsTab] Campaign watermark applied:', campaignCreatorProfile.watermark.name);
          } catch (e) {
            console.warn('[ClipsTab] Failed to download campaign watermark:', e);
          }
        }

        // Save campaign_id to the clip for payment tracking
        try {
          const { updateClip } = await import('@/services/database/clips');
          await updateClip(clip.id, { campaign_id: activeCampaignId });
          console.log('[ClipsTab] Saved campaign_id', activeCampaignId, 'to clip', clip.id);
        } catch (e) {
          console.warn('[ClipsTab] Failed to save campaign_id to clip:', e);
        }
      }
      // ── End Campaign Branding Override ───────────────────────────────────────

      // ── Org Branding Resolution ─────────────────────────────────────────────
      let orgOverrideIntro: IntroOutroRef | null = null;
      let orgOverrideOutro: IntroOutroRef | null = null;
      let targetResolvedProfile: any = null; // Stores resolved profile for layout_overlays

      if (!activeCampaignId && activeBrandingType === 'org') {
        try {
          // Use the streamer-matched creator profile from props (already resolved by
          // ProjectWorkspaceDialog to the correct streamer profile, e.g. "Jerzy" not "Clippster").
          // Fall back to API lookup by brandingProfileId only if props.creatorProfile is unavailable.
          let profile: any = null;

          // Use resolveApplicableProfiles — the proven streamer matching function that
          // matches via platform links (channel URL e.g. "jerzynft" on Kick).
          // This is the same function that produces "Found org streamer match: Jerzy" in logs.
          const { resolveApplicableProfiles } = await import('@/composables/useBrandingProfileSelection');
          const clipProjectId = clip.project_id || props.projectId;
          
          if (clipProjectId) {
            const candidates = await resolveApplicableProfiles(clipProjectId);
            const orgId = activeTarget?.organizationId;
            
            // Find the org-streamer match within the target org
            const streamerMatch = candidates.find((c) =>
              c.source === 'org-streamer' &&
              (!orgId || (c.profile as any).organization_id === orgId)
            );
            
            // Fall back to org-global within the same org
            const globalMatch = !streamerMatch
              ? candidates.find((c) =>
                  c.source === 'org-global' &&
                  (!orgId || (c.profile as any).organization_id === orgId)
                )
              : null;
            
            const matched = streamerMatch || globalMatch;
            if (matched) {
              profile = matched.profile;
              targetResolvedProfile = profile;
              console.log('[ClipsTab] Org branding: resolved via platform links:', profile.name, '(source:', matched.source, ')');
            } else {
              console.log('[ClipsTab] Org branding: no matching profile found via resolveApplicableProfiles');
            }
          }

          console.log('[ClipsTab] Org branding profile lookup:', {
            brandingProfileId: activeCampaignBrandingProfileId,
            foundProfile: !!profile,
            profileName: profile?.name || null,
            introId: profile?.intro_id || null,
            outroId: profile?.outro_id || null,
          });

          // Profile from resolveApplicableProfiles is in local format:
          // outro_id/intro_id are already "org-asset-{id}" strings. Pass directly.
          if (profile?.intro_id) {
            const introResolved = await resolveIntroOutroById(profile.intro_id);
            if (introResolved) {
              orgOverrideIntro = {
                id: profile.intro_id,
                type: 'intro',
                name: (profile.name || 'Org') + ' Intro',
                file_path: introResolved.filePath,
                duration: introResolved.duration,
                thumbnail_path: null,
              } as IntroOutroRef;
              console.log('[ClipsTab] Org profile intro resolved:', profile.intro_id);
            }
          }

          if (profile?.outro_id) {
            const outroResolved = await resolveIntroOutroById(profile.outro_id);
            if (outroResolved) {
              orgOverrideOutro = {
                id: profile.outro_id,
                type: 'outro',
                name: (profile.name || 'Org') + ' Outro',
                file_path: outroResolved.filePath,
                duration: outroResolved.duration,
                thumbnail_path: null,
              } as IntroOutroRef;
              console.log('[ClipsTab] Org profile outro resolved:', profile.outro_id);
            }
          }
        } catch (e) {
          console.warn('[ClipsTab] Failed to resolve org branding profile intro/outro:', e);
        }
      }
      // ── End Org Branding Resolution ─────────────────────────────────────────

      // Effective intro/outro: campaign > org > (personal/legacy: creator defaults + dialog) | (org/campaign targets: dialog only).
      const isOrgOrCampaignTarget = activeBrandingType === 'org' || activeBrandingType === 'campaign';
      const effectiveIntro =
        campaignOverrideIntro ??
        orgOverrideIntro ??
        (activeCampaignId
          ? null
          : isOrgOrCampaignTarget
            ? settings.intro
            : props.creatorDefaultIntro || settings.intro);
      const effectiveOutro =
        campaignOverrideOutro ??
        orgOverrideOutro ??
        (activeCampaignId
          ? null
          : isOrgOrCampaignTarget
            ? settings.outro
            : props.creatorDefaultOutro || settings.outro);
      // If campaign selected, use campaign watermark; otherwise clear org watermark (don't leak org branding into campaign builds)
      if (activeCampaignId && campaignOverrideWatermark) {
        // Re-resolve watermark for Rust from campaign override
        if (campaignOverrideWatermark.watermarkId) {
          const campaignWm = await resolveWatermarkById(campaignOverrideWatermark.watermarkId);
          if (campaignWm) {
            const wmPerRatio: Record<string, any> = {};
            const allRatios = ['16:9', '9:16', '1:1', '4:5'];
            for (const ratio of allRatios) {
              const pos = (campaignOverrideWatermark.perRatioSettings as any)?.[ratio]?.position
                ?? { x: campaignOverrideWatermark.positionX, y: campaignOverrideWatermark.positionY, opacity: campaignOverrideWatermark.opacity, scale: campaignOverrideWatermark.scale };
              wmPerRatio[ratio] = {
                watermarkId: campaignOverrideWatermark.watermarkId,
                filePath: campaignWm.filePath,
                width: campaignWm.width,
                height: campaignWm.height,
                position: pos,
              };
            }
            targetWatermarkSettings = {
              enabled: true,
              watermarkId: campaignOverrideWatermark.watermarkId,
              filePath: campaignWm.filePath,
              width: campaignWm.width ?? 0,
              height: campaignWm.height ?? 0,
              positionX: campaignOverrideWatermark.positionX,
              positionY: campaignOverrideWatermark.positionY,
              opacity: campaignOverrideWatermark.opacity,
              scale: campaignOverrideWatermark.scale,
              perRatioSettings: wmPerRatio,
            };
            console.log('[ClipsTab] Watermark re-resolved for campaign:', campaignOverrideWatermark.watermarkId);
          }
        }
      } else if (activeCampaignId) {
        targetWatermarkSettings = null;
        console.log('[ClipsTab] Cleared org watermark for campaign build (no campaign watermark set)');
      }

      console.log('[ClipsTab] Campaign branding resolution result:', {
        hasCampaign: !!activeCampaignId,
        overrideIntro: campaignOverrideIntro?.name || null,
        overrideOutro: campaignOverrideOutro?.name || null,
        overrideWatermark: campaignOverrideWatermark ? 'yes' : 'no',
        effectiveIntro: effectiveIntro?.name || null,
        effectiveOutro: effectiveOutro?.name || null,
        watermarkAfterOverride: (settings as any).watermark?.enabled ? (settings as any).watermark?.watermarkId : null,
      });

      let introPath: string | null = null;
      let outroPath: string | null = null;
      let introDuration: number | null = null;
      let outroDuration: number | null = null;

      // Handle intro
      if (effectiveIntro) {
        introPath = effectiveIntro.file_path || null;
        introDuration = effectiveIntro.duration || null;
        const introSource = campaignOverrideIntro
          ? '(campaign)'
          : orgOverrideIntro
            ? '(org branding)'
            : !activeCampaignId &&
                !isOrgOrCampaignTarget &&
                props.creatorDefaultIntro &&
                effectiveIntro &&
                (effectiveIntro.id === props.creatorDefaultIntro.id ||
                  effectiveIntro.file_path === props.creatorDefaultIntro.file_path)
              ? '(creator profile default)'
              : '(dialog selection)';
        console.log('[ClipsTab] Using intro:', effectiveIntro.name, introSource);

        // Download org intro if needed (cast to any for org asset properties)
        const introAny = effectiveIntro as any;
        if (introAny.isOrgAsset && introAny.serverId) {
          console.log('[ClipsTab] Downloading org intro asset on-demand:', effectiveIntro.name);
          const introResult = await ensureAssetDownloaded({
            id: introAny.serverId,
            name: effectiveIntro.name,
            asset_type: 'intro',
            url: introAny.serverUrl || effectiveIntro.file_path,
            organization_id: Number(introAny.organization_id),
            organization_name: introAny.organization_name || undefined,
            duration: effectiveIntro.duration || undefined,
            thumbnail_url: introAny.thumbnail_path || undefined,
            inserted_at: introAny.created_at,
            updated_at: introAny.updated_at,
          } as unknown as ServerOrganizationAsset);

          if (introResult.success && introResult.filePath) {
            introPath = introResult.filePath;
            console.log('[ClipsTab] Org intro downloaded to:', introPath);
          } else {
            throw new Error(`Failed to download intro asset: ${introResult.error || 'Unknown error'}`);
          }
        }
      }

      // Handle outro
      if (effectiveOutro) {
        outroPath = effectiveOutro.file_path || null;
        outroDuration = effectiveOutro.duration || null;
        const outroSource = campaignOverrideOutro
          ? '(campaign)'
          : orgOverrideOutro
            ? '(org branding)'
            : !activeCampaignId &&
                !isOrgOrCampaignTarget &&
                props.creatorDefaultOutro &&
                effectiveOutro &&
                (effectiveOutro.id === props.creatorDefaultOutro.id ||
                  effectiveOutro.file_path === props.creatorDefaultOutro.file_path)
              ? '(creator profile default)'
              : '(dialog selection)';
        console.log('[ClipsTab] Using outro:', effectiveOutro.name, outroSource);

        // Download org outro if needed (cast to any for org asset properties)
        const outroAny = effectiveOutro as any;
        if (outroAny.isOrgAsset && outroAny.serverId) {
          console.log('[ClipsTab] Downloading org outro asset on-demand:', effectiveOutro.name);
          const outroResult = await ensureAssetDownloaded({
            id: outroAny.serverId,
            name: effectiveOutro.name,
            asset_type: 'outro',
            url: outroAny.serverUrl || effectiveOutro.file_path,
            organization_id: Number(outroAny.organization_id),
            organization_name: outroAny.organization_name || undefined,
            duration: effectiveOutro.duration || undefined,
            thumbnail_url: outroAny.thumbnail_path || undefined,
            inserted_at: outroAny.created_at,
            updated_at: outroAny.updated_at,
          } as unknown as ServerOrganizationAsset);

          if (outroResult.success && outroResult.filePath) {
            outroPath = outroResult.filePath;
            console.log('[ClipsTab] Org outro downloaded to:', outroPath);
          } else {
            throw new Error(`Failed to download outro asset: ${outroResult.error || 'Unknown error'}`);
          }
        }
      }

      // Per-ratio intro/outro from profile JSON — org/campaign targets only (not personal builds).
      const introOutroPerRatio: Record<string, { introPath?: string; introDuration?: number; outroPath?: string; outroDuration?: number }> = {};

      const perRatioIntroOutroRaw =
        activeBrandingType === 'org' && targetResolvedProfile?.intro_outro_settings
          ? targetResolvedProfile.intro_outro_settings
          : null;

      if (perRatioIntroOutroRaw) {
        try {
          const introOutroSettings =
            typeof perRatioIntroOutroRaw === 'string'
              ? JSON.parse(perRatioIntroOutroRaw)
              : perRatioIntroOutroRaw;
          
          for (const ratio of settings.aspectRatios) {
            const ratioConfig = introOutroSettings[ratio];
            if (ratioConfig) {
              const ratioData: { introPath?: string; introDuration?: number; outroPath?: string; outroDuration?: number } = {};
              
              // Resolve intro for this ratio
              if (ratioConfig.introId) {
                const introResolved = await resolveIntroOutroById(ratioConfig.introId);
                if (introResolved) {
                  ratioData.introPath = introResolved.filePath || undefined;
                  ratioData.introDuration = introResolved.duration || undefined;
                  console.log(`[ClipsTab] Resolved intro for ${ratio}:`, ratioConfig.introId);
                }
              }
              
              // Resolve outro for this ratio
              if (ratioConfig.outroId) {
                const outroResolved = await resolveIntroOutroById(ratioConfig.outroId);
                if (outroResolved) {
                  ratioData.outroPath = outroResolved.filePath || undefined;
                  ratioData.outroDuration = outroResolved.duration || undefined;
                  console.log(`[ClipsTab] Resolved outro for ${ratio}:`, ratioConfig.outroId);
                }
              }
              
              introOutroPerRatio[ratio] = ratioData;
            }
          }
        } catch (e) {
          console.warn('[ClipsTab] Failed to parse intro_outro_settings:', e);
        }
      }

      // Free tier branding override: apply admin intro/outro
      // Note: Watermark settings are already loaded into UI state by ProjectWorkspaceDialog
      const { useFreeTierBranding } = await import('@/composables/useFreeTierBranding');
      const { getBrandingIfFreeTier } = useFreeTierBranding();
      const adminBranding = await getBrandingIfFreeTier();
      if (adminBranding) {
        console.log('[ClipsTab] Free tier user detected, applying admin branding');

        // Clear user-selected global intro/outro (per-ratio settings handled below)
        introPath = null;
        introDuration = null;
        outroPath = null;
        outroDuration = null;
        
        // Override per-ratio intro/outro with admin settings if configured
        if (adminBranding.intro_settings || adminBranding.outro_settings) {
          const adminIntroRatios = adminBranding.intro_settings ?? {};
          const adminOutroRatios = adminBranding.outro_settings ?? {};
          
          // Clear user-configured per-ratio settings
          Object.keys(introOutroPerRatio).forEach(key => delete introOutroPerRatio[key]);
          
          // Apply admin per-ratio settings for selected aspect ratios
          for (const ratio of settings.aspectRatios) {
            const ratioData: { introPath?: string; introDuration?: number; outroPath?: string; outroDuration?: number } = {};
            
            if (adminIntroRatios[ratio]?.assetId) {
              const introConfig = adminIntroRatios[ratio] as any;
              if (introConfig.url) {
                // Use presigned URL directly — bypasses org asset system for free tier users
                try {
                  const filename = `free-tier-intro-${introConfig.assetId.replace(/[^a-zA-Z0-9-]/g, '_')}.mp4`;
                  const dlPath = await invoke<string>('download_org_asset_from_url', {
                    url: introConfig.url,
                    filename,
                    assetType: 'intros',
                    organizationId: 'free-tier',
                  });
                  ratioData.introPath = dlPath || undefined;
                  console.log(`[ClipsTab] Applied admin intro for ${ratio} via presigned URL`);
                } catch (dlErr) {
                  console.error(`[ClipsTab] Failed to download admin intro for ${ratio}:`, dlErr);
                  const introResolved = await resolveIntroOutroById(introConfig.assetId);
                  if (introResolved) {
                    ratioData.introPath = introResolved.filePath || undefined;
                    ratioData.introDuration = introResolved.duration || undefined;
                  }
                }
              } else {
                const introResolved = await resolveIntroOutroById(introConfig.assetId);
                if (introResolved) {
                  ratioData.introPath = introResolved.filePath || undefined;
                  ratioData.introDuration = introResolved.duration || undefined;
                  console.log(`[ClipsTab] Applied admin intro for ${ratio}`);
                }
              }
            }
            
            if (adminOutroRatios[ratio]?.assetId) {
              const outroConfig = adminOutroRatios[ratio] as any;
              if (outroConfig.url) {
                // Use presigned URL directly — bypasses org asset system for free tier users
                try {
                  const filename = `free-tier-outro-${outroConfig.assetId.replace(/[^a-zA-Z0-9-]/g, '_')}.mp4`;
                  const dlPath = await invoke<string>('download_org_asset_from_url', {
                    url: outroConfig.url,
                    filename,
                    assetType: 'outros',
                    organizationId: 'free-tier',
                  });
                  ratioData.outroPath = dlPath || undefined;
                  console.log(`[ClipsTab] Applied admin outro for ${ratio} via presigned URL`);
                } catch (dlErr) {
                  console.error(`[ClipsTab] Failed to download admin outro for ${ratio}:`, dlErr);
                  const outroResolved = await resolveIntroOutroById(outroConfig.assetId);
                  if (outroResolved) {
                    ratioData.outroPath = outroResolved.filePath || undefined;
                    ratioData.outroDuration = outroResolved.duration || undefined;
                  }
                }
              } else {
                const outroResolved = await resolveIntroOutroById(outroConfig.assetId);
                if (outroResolved) {
                  ratioData.outroPath = outroResolved.filePath || undefined;
                  ratioData.outroDuration = outroResolved.duration || undefined;
                  console.log(`[ClipsTab] Applied admin outro for ${ratio}`);
                }
              }
            }
            
            if (ratioData.introPath || ratioData.outroPath) {
              introOutroPerRatio[ratio] = ratioData;
            }
          }
        }
        
        // Apply admin watermark settings for free tier users
        if (adminBranding.watermark_id) {
          console.log('[ClipsTab] Applying admin watermark for free tier user:', adminBranding.watermark_id);
          
          // Resolve watermark file path — prefer presigned URL to bypass org asset system
          let wmFilePath: string | null = null;
          let wmWidth: number | null = null;
          let wmHeight: number | null = null;

          if (adminBranding.watermark_url) {
            try {
              const filename = `free-tier-watermark-${adminBranding.watermark_id.replace(/[^a-zA-Z0-9-]/g, '_')}.png`;
              wmFilePath = await invoke<string>('download_org_asset_from_url', {
                url: adminBranding.watermark_url,
                filename,
                assetType: 'watermarks',
                organizationId: 'free-tier',
              });
              console.log('[ClipsTab] Free tier watermark downloaded to:', wmFilePath);
            } catch (dlErr) {
              console.error('[ClipsTab] Failed to download free tier watermark via presigned URL:', dlErr);
            }
          }

          if (!wmFilePath) {
            // Fallback: local cache (works for org members)
            const adminWatermark = await resolveWatermarkById(adminBranding.watermark_id);
            if (adminWatermark) {
              wmFilePath = adminWatermark.filePath;
              wmWidth = adminWatermark.width;
              wmHeight = adminWatermark.height;
            }
          }

          if (wmFilePath) {
            const adminWatermarkSettings = adminBranding.watermark_settings
              ? (typeof adminBranding.watermark_settings === 'string'
                  ? JSON.parse(adminBranding.watermark_settings)
                  : adminBranding.watermark_settings)
              : null;
            
            // Build per-ratio settings from admin watermark config
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
            
            const allRatios = ['16:9', '9:16', '1:1', '4:5'];
            for (const ratio of allRatios) {
              const ratioConfig = adminWatermarkSettings?.[ratio];
              buildPerRatioSettings[ratio] = {
                watermarkId: adminBranding.watermark_id,
                filePath: wmFilePath,
                width: wmWidth,
                height: wmHeight,
                position: ratioConfig?.position ?? { x: 12, y: 92, opacity: 80, scale: 20 },
              };
            }
            
            // Get default position from 16:9 config
            const defaultPos = adminWatermarkSettings?.['16:9']?.position ?? { x: 12, y: 92, opacity: 80, scale: 20 };

            targetWatermarkSettings = {
              enabled: true,
              watermarkId: adminBranding.watermark_id,
              filePath: wmFilePath,
              width: wmWidth ?? 0,
              height: wmHeight ?? 0,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
              perRatioSettings: buildPerRatioSettings,
            };
            
            console.log('[ClipsTab] Admin watermark applied:', {
              watermarkId: adminBranding.watermark_id,
              filePath: wmFilePath,
            });
          }
        }
        
        console.log('[ClipsTab] Free tier branding applied successfully');
      }

      console.log('[ClipsTab] Final branding payload before invoke:', {
        targetGroup: tg.key,
        activeCampaignId,
        activeCampaignBrandingProfileId,
        activeBrandingType,
        aspectRatios: targetRatios,
        introPath: introPath,
        outroPath: outroPath,
        introDuration: introDuration,
        outroDuration: outroDuration,
        hasIntroOutroPerRatio: Object.keys(introOutroPerRatio).length > 0,
      });

      // Pre-render subtitles to PNG for pixel-perfect export (if subtitles enabled)
      let subtitleOverlays: Record<string, Array<{ imagePath: string; startTime: number; endTime: number; positionX: number; positionY: number }>> | null = null;
      
      if (effectiveSubtitleSettings?.enabled && transcriptWords.length > 0) {
        console.log('[ClipsTab] Pre-rendering subtitles for pixel-perfect export...');
        console.log('[ClipsTab] transcriptWords count:', transcriptWords.length);
        console.log('[ClipsTab] whisperSegments count:', transcriptSegments.length);
        console.log('[ClipsTab] segments for subtitle render:', segments.map(s => ({ start: s.start_time, end: s.end_time })));
        try {
          const { preRenderSubtitleOverlays } = await import('@/services/subtitle-renderer');
          subtitleOverlays = {};

          // CRITICAL: The renderer must chunk on the SAME boundaries as VideoPlayer.vue's preview.
          // VideoPlayer chunks within each whisper segment (one sentence) — so a 4-word sentence
          // is its own 4-word frame, regardless of `maxWords`. If we feed the renderer a single
          // synthetic clip segment instead, it groups every 6 words from word 0, producing
          // entirely different chunks ("They're looking. They're looking. No. the" instead of
          // "They're looking. They're looking.") and a wider box that wraps and drifts off-center.
          const subtitleSegments = transcriptSegments.length > 0
            ? transcriptSegments.map((seg: any) => ({
                start: Number(seg.start) || 0,
                end: Number(seg.end) || 0,
                transcript: typeof (seg as any).text === 'string' ? (seg as any).text : '',
              }))
            : segments.map((s) => ({
                start: s.start_time,
                end: s.end_time,
                transcript: s.transcript || '',
              }));
          
          for (const ratio of targetRatios) {
            // Calculate output dimensions based on aspect ratio
            // IMPORTANT: Must match Rust backend calculation in video_processor.rs
            // Rust uses width=1080 as base: output_w = 1080, output_h = 1080 * (h/w)
            const [w, h] = ratio.split(':').map(Number);
            const canvasWidth = 1080;
            const canvasHeight = Math.round((canvasWidth * h) / w);
            // Ensure even dimensions (required by H.264)
            const evenCanvasHeight = canvasHeight % 2 === 0 ? canvasHeight : canvasHeight + 1;
            
            // Get the intro offset for this ratio (subtitles need to start after intro)
            const ratioIntroConfig = introOutroPerRatio[ratio];
            const introOffset = ratioIntroConfig?.introDuration ?? introDuration ?? 0;
            
            // Get per-ratio settings if available
            const ratioOverride = finalSubtitleOverrides?.[ratio];
            const mergedSettings = ratioOverride 
              ? { ...effectiveSubtitleSettings, ...ratioOverride }
              : effectiveSubtitleSettings;
            
            console.log('[ClipsTab] Calling preRenderSubtitleOverlays for', ratio, 'with', {
              canvasWidth,
              canvasHeight: evenCanvasHeight,
              wordsCount: transcriptWords.length,
              segmentsCount: subtitleSegments.length,
              animationStyle: mergedSettings.animationStyle,
              maxWords: getSubtitleMaxWordsForAspectRatio(ratio, props.maxWordsForAspectRatio),
              hasRatioOverride: !!ratioOverride,
              ratioOverrideAnimationStyle: ratioOverride?.animationStyle,
              ratioOverrideMultiColorEnabled: ratioOverride?.multiColorEnabled,
              position: mergedSettings.position,
              positionPercentage: mergedSettings.positionPercentage,
              fontSize: mergedSettings.fontSize,
              highlightColor: mergedSettings.highlightColor,
              border1Width: mergedSettings.border1Width,
              multiColorEnabled: mergedSettings.multiColorEnabled,
            });
            
            // Debug: log the sources of the merge with FULL values
            const dialogOv = (settings.subtitleOverrides as any)?.[ratio];
            const dbOv = (effectiveSubtitleSettings?.perRatioConfigs as any)?.[ratio];
            console.log('[ClipsTab] DEBUG merge sources for', ratio, ':', {
              fromDialogOverrides: dialogOv ? {
                animationStyle: dialogOv.animationStyle,
                multiColorEnabled: dialogOv.multiColorEnabled,
                position: dialogOv.position,
                fontSize: dialogOv.fontSize,
                highlightColor: dialogOv.highlightColor,
              } : 'NO DIALOG OVERRIDE',
              fromDbPerRatioConfigs: dbOv ? {
                animationStyle: dbOv.animationStyle,
                multiColorEnabled: dbOv.multiColorEnabled,
                position: dbOv.position,
                fontSize: dbOv.fontSize,
                highlightColor: dbOv.highlightColor,
              } : 'NO DB OVERRIDE',
              finalOverrideValues: ratioOverride ? {
                animationStyle: (ratioOverride as any).animationStyle,
                multiColorEnabled: (ratioOverride as any).multiColorEnabled,
                position: (ratioOverride as any).position,
                fontSize: (ratioOverride as any).fontSize,
                highlightColor: (ratioOverride as any).highlightColor,
              } : 'NO FINAL OVERRIDE',
            });
            
            // Also log what's in finalSubtitleOverrides for this ratio
            console.log('[ClipsTab] finalSubtitleOverrides[' + ratio + '] =', finalSubtitleOverrides?.[ratio]);
            
            // Log the position specifically
            console.log('[ClipsTab] Position for', ratio, ':', {
              mergedPosition: mergedSettings.position,
              mergedPositionPercentage: mergedSettings.positionPercentage,
              isPositionObject: typeof mergedSettings.position === 'object' && mergedSettings.position !== null,
            });
            
            // CRITICAL — timing offset:
            // Subtitle frame times are emitted in OUTPUT-VIDEO time (FFmpeg `t`, starting at 0).
            // Words/segments arrive in source-time of the build's input file. For self-contained
            // clips we always build the whole input from t=0, so source-time == clip-time and the
            // offset is 0. For regular project clips the build extracts from segments[0].start_time
            // (FFmpeg `-ss`), so that is the source-time corresponding to output-time 0.
            // Using `min(segment.start)` here was the prior bug: when the clip had silence before
            // the first whisper sentence, it shifted ALL subtitles earlier by the silence length.
            const clipStartTimeForRenderer = selfContainedClip
              ? 0
              : Number(freshSegments[0]?.start_time) || 0;

            const overlays = await preRenderSubtitleOverlays({
              settings: mergedSettings,
              words: transcriptWords,
              segments: subtitleSegments,
              maxWords: getSubtitleMaxWordsForAspectRatio(ratio, props.maxWordsForAspectRatio),
              canvasWidth,
              canvasHeight: evenCanvasHeight,
              aspectRatio: ratio,
              introOffset,
              clipStartTime: clipStartTimeForRenderer,
            });
            
            subtitleOverlays[ratio] = overlays;
            console.log(`[ClipsTab] Pre-rendered ${overlays.length} subtitle frames for ${ratio}`);
            if (overlays.length === 0) {
              throw new Error(`No subtitle PNG overlays were generated for ${ratio}`);
            }
          }
        } catch (err) {
          console.error('[ClipsTab] Failed to pre-render subtitles for pixel-perfect export:', err);
          throw new Error(
            `Failed to render preview-matching subtitle overlays: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      console.log('[ClipsTab] Text overlays being sent to Rust:', {
        count: textOverlaysForExport?.length ?? 0,
        overlays: textOverlaysForExport?.map(o => ({
          id: o.id,
          text: o.text?.substring(0, 50),
          startTime: o.startTime,
          endTime: o.endTime,
          positionX: o.positionX,
          positionY: o.positionY,
          hasPerRatioConfigs: !!o.perRatioConfigs,
          perRatioKeys: o.perRatioConfigs ? Object.keys(o.perRatioConfigs) : [],
        })),
      });
      
      await invoke('build_clip_from_segments', {
        projectId: props.projectId,
        clipId: clip.id,
        clipName: clip.current_version_name || clip.name || 'Untitled',
        videoPath: projectVideo.file_path,
        segments: segments,
        subtitleSettings: effectiveSubtitleSettings,
        subtitleOverrides: finalSubtitleOverrides,
        subtitleOverlays: subtitleOverlays,
        transcriptWords: transcriptWords,
        transcriptSegments: transcriptSegments,
        maxWords: targetRatios.length === 1
          ? getSubtitleMaxWordsForAspectRatio(targetRatios[0], props.maxWordsForAspectRatio)
          : props.maxWordsForAspectRatio,
        aspectRatios: targetRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        buildNumber: buildNumber,
        buildId: buildId,
        introPath: introPath,
        introDuration: introDuration,
        outroPath: outroPath,
        outroDuration: outroDuration,
        introOutroPerRatio: introOutroPerRatio,
        watermarkSettings: targetWatermarkSettings,
        audioSettings: audioSettings,
        framingStrategy: framingStrategy,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        videoFilterSegments: videoFilterSegments,
        textOverlays: textOverlaysForExport,
        stickers: stickersForExport,
        clipWatermarks: clipWatermarksForExport,
        layoutOverlays: await resolveLayoutOverlaysForBuild(
          settings.layoutOverlays ||
            (activeBrandingType === 'org' && targetResolvedProfile?.layout_overlays
              ? typeof targetResolvedProfile.layout_overlays === 'string'
                ? JSON.parse(targetResolvedProfile.layout_overlays)
                : targetResolvedProfile.layout_overlays
              : null)
        ),
        campaignId: activeCampaignId,
        campaignBrandingProfileId: activeCampaignBrandingProfileId,
        brandingType: activeBrandingType,
      });

      console.log('[ClipsTab] Target group build started:', tg.key);
      buildNumber++;
      } // ── End Per-Target Build Loop ──────────────────────────────────────────

      console.log('[ClipsTab] All', targetGroups.length, 'target group builds started successfully');

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

  function joinDirAndFile(dir: string, fileName: string): string {
    const normalized = dir.replace(/[/\\]+$/, '');
    const sep = normalized.includes('\\') ? '\\' : '/';
    return `${normalized}${sep}${fileName}`;
  }

  function allocateUniqueDestBasename(originalBase: string, usedLower: Set<string>): string {
    const dot = originalBase.lastIndexOf('.');
    const stem = dot > 0 ? originalBase.slice(0, dot) : originalBase;
    const ext = dot > 0 ? originalBase.slice(dot) : '';
    let name = originalBase;
    let n = 1;
    while (usedLower.has(name.toLowerCase())) {
      n++;
      name = `${stem}_${n}${ext}`;
    }
    usedLower.add(name.toLowerCase());
    return name;
  }

  async function onDownloadAllBuiltClips() {
    const sources = completedDownloadSourcePaths.value;
    if (sources.length === 0) {
      try {
        const toastComposable = await import('@/composables/useToast');
        const { info } = toastComposable.useToast();
        info('Nothing to download', 'No built clip files are available to export.');
      } catch {
        console.warn('[ClipsTab] Nothing to download');
      }
      return;
    }

    isDownloadingAll.value = true;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose folder for clips',
      });
      if (selected === null || selected === undefined) return;
      const dir = Array.isArray(selected) ? selected[0] : selected;
      if (!dir || typeof dir !== 'string') return;

      const { invoke } = await import('@tauri-apps/api/core');
      const usedNames = new Set<string>();
      let copied = 0;
      const errors: string[] = [];

      for (const sourcePath of sources) {
        const originalBase = sourcePath.split(/[/\\]/).pop() || 'clip.mp4';
        const destBase = allocateUniqueDestBasename(originalBase, usedNames);
        const destinationPath = joinDirAndFile(dir, destBase);
        try {
          await invoke('copy_clip_to_destination', { sourcePath, destinationPath });
          copied++;
        } catch (e) {
          errors.push(`${destBase}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const toastComposable = await import('@/composables/useToast');
      const { success: showSuccessToast, error: showErrorToast } = toastComposable.useToast();
      if (errors.length > 0) {
        showErrorToast(
          copied > 0 ? 'Partial export' : 'Export failed',
          copied > 0
            ? `Saved ${copied} of ${sources.length} files. First error: ${errors[0]}`
            : errors[0] ?? 'Unknown error',
          10000
        );
      } else {
        showSuccessToast(
          'Clips exported',
          `Saved ${copied} file${copied !== 1 ? 's' : ''} to ${dir}`
        );
      }
    } catch (error) {
      console.error('[ClipsTab] Download all failed:', error);
      showError('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      isDownloadingAll.value = false;
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

  // Expose functions to parent
  defineExpose({
    scrollClipIntoView,
    hasClipElement: (clipId: string) => clipElements.value.has(clipId),
    refreshThumbnails: loadClipThumbnails,
  });
</script>

<style scoped>
  /* ===== Header Section ===== */
  .clips-tab-header-icon {
    background-color: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.25);
  }

  .clips-tab-header-btn {
    color: var(--sidebar-text-muted);
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
  }

  .clips-tab-header-btn:hover {
    color: var(--sidebar-text);
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* ===== Progress Indicators ===== */
  .clips-tab-progress-bar {
    background-color: var(--sidebar-accent);
  }

  .clips-tab-progress-ping {
    background-color: rgba(6, 182, 212, 0.05);
  }

  .clips-tab-progress-icon-container {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
  }

  .clips-tab-time-estimate {
    color: var(--sidebar-text-muted);
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .clips-tab-cancel-btn {
    color: var(--sidebar-text-muted);
  }

  .clips-tab-cancel-btn:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .clips-tab-cancel-progress-btn {
    color: var(--sidebar-text-muted);
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
  }

  .clips-tab-cancel-progress-btn:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .clips-tab-status-msg {
    color: var(--sidebar-text-muted);
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--sidebar-border);
  }

  .clips-tab-error-box {
    background-color: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  /* ===== Clip Cards ===== */
  .clips-tab-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
  }

  .clips-tab-card:hover {
    background-color: var(--sidebar-hover);
  }

  .clips-tab-card--playing {
    background-color: rgba(34, 197, 94, 0.06);
    border: 1px solid rgba(34, 197, 94, 0.5);
  }

  .clips-tab-duration-badge {
    color: var(--sidebar-text);
    background-color: rgba(255, 255, 255, 0.08);
    opacity: 0.8;
  }

  .clips-tab-cancel-build-mini {
    color: var(--sidebar-text-muted);
  }

  .clips-tab-cancel-build-mini:hover {
    background-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  /* ===== Action Buttons ===== */
  .clips-tab-download-btn {
    color: var(--sidebar-accent);
    opacity: 0.8;
  }

  .clips-tab-download-btn:hover {
    background-color: rgba(6, 182, 212, 0.12);
    opacity: 1;
  }

  .clips-tab-download-btn--active {
    background-color: rgba(6, 182, 212, 0.15);
    opacity: 1;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .clips-tab-more-btn {
    color: var(--sidebar-text-muted);
  }

  .clips-tab-more-btn:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .clips-tab-more-btn--active {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  /* ===== Empty State ===== */
  .clips-tab-empty-glow {
    display: none;
  }

  .clips-tab-empty-icon {
    background-color: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.25);
  }

  .clips-tab-empty-dot-1 {
    display: none;
  }

  .clips-tab-empty-dot-2 {
    display: none;
  }

  .clips-tab-primary-btn {
    background-color: var(--sidebar-accent);
  }

  .clips-tab-primary-btn:hover {
    opacity: 0.85;
  }

  /* ===== Custom Scrollbar ===== */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
  }

  .clips-tab-scroll-container {
    padding-right: 10px;
  }
</style>

<!-- Global styles for dropdown menus (rendered via Teleport outside component scope) -->
<style>
  /* ===== Dropdown Menu Styling ===== */
  .clips-tab-dropdown {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    animation: clipsTabDropdownFade 150ms ease-out;
  }

  @keyframes clipsTabDropdownFade {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .clips-tab-dropdown-label {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .clips-tab-dropdown-item {
    color: var(--sidebar-text);
  }

  .clips-tab-dropdown-item:hover {
    background-color: var(--sidebar-hover);
  }

  .clips-tab-dropdown-item--danger {
    color: #f87171;
  }

  .clips-tab-dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .clips-tab-dropdown-divider {
    background-color: var(--sidebar-border);
  }
</style>
