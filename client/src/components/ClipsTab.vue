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
                  props.isPlayingSegments && props.playingClipId === clip.id ? 'clips-tab-card--playing' : '',
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
                  <div class="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden bg-black/30 border border-border/30 relative">
                    <img
                      v-if="getClipThumbnail(clip.id)"
                      :src="getClipThumbnail(clip.id)!"
                      :alt="clip.current_version_name || clip.name || 'Clip thumbnail'"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <Video class="w-6 h-6 text-muted-foreground/40" />
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
                                v-if="!props.playOnCardClick"
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

                              <!-- Build Clip -->
                              <button
                                v-if="clip.build_status !== 'building'"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onBuildClip(clip);
                                  closeActionMenu();
                                "
                              >
                                <Hammer class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Build Clip</span>
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
      :subtitle-settings="subtitleSettings"
      :initial-aspect-ratios="savedAspectRatios"
      :initial-framing-mode="savedFramingMode"
      :initial-framing-configs="savedFramingConfigs"
      :vod-preset-config="vodPresetConfig"
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
    Settings2,
    LayoutDashboard,
  } from 'lucide-vue-next';
  import { useAIPermission } from '@/composables/useAIPermission';
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import ClipBuildSettingsDialog, { type BuildSettings, type IntroOutroItem } from './ClipBuildSettingsDialog.vue';
  import type { SubtitleSettings, WatermarkSettings, IntroOutroRef } from '@/types';
  import { ensureAssetDownloaded, type ServerOrganizationAsset } from '@/services/orgAssetSync';
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
    creatorProfile?: any; // Full creator profile for per-ratio intro/outro
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
    maxWordsForAspectRatio: 3,
    watermarkSettings: null,
    creatorDefaultIntro: null,
    creatorDefaultOutro: null,
    creatorProfile: null,
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
    clipHover: [clipId: string];
    seekVideo: [time: number];
    scrollToTimeline: [];
    refreshClips: [];
    editClip: [clipId: string];
    addClip: [];
    adjustClip: [clipId: string];
  }>();

  // AI Permission check
  const { isAIAllowed } = useAIPermission();

  // In-editor clips store
  const inEditorStore = useInEditorClips();
  inEditorStore.hydrate();

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

  // Track if thumbnails are being loaded
  const isLoadingThumbnails = ref(false);

  // Track which clips are already part of a video editor project
  const clipProjectMembership = ref<Map<string, boolean>>(new Map());

  // Computed: check if all clips have thumbnails loaded (or don't need them)
  const allThumbnailsReady = computed(() => {
    if (props.clips.length === 0) return true;
    // All clips should either have a thumbnail in cache, or not need one (no built_thumbnail_path)
    return props.clips.every((clip) => clipThumbnailCache.value.has(clip.id) || !clip.built_thumbnail_path);
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
        (clip) => clip.built_thumbnail_path && !clipThumbnailCache.value.has(clip.id)
      );
      const hasClipsNeedingThumbnails = newClips.some(
        (clip) => !clip.built_thumbnail_path && !clipThumbnailCache.value.has(clip.id)
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

  // Load clip thumbnails into cache
  async function loadClipThumbnails() {
    const clipsWithThumbnails = props.clips.filter(
      (clip) => clip.built_thumbnail_path && !clipThumbnailCache.value.has(clip.id)
    );

    // Load existing thumbnails if there are any
    if (clipsWithThumbnails.length > 0) {
      const { invoke } = await import('@tauri-apps/api/core');

      let hasNewThumbnails = false;

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
              hasNewThumbnails = true;
            } catch (err) {
              console.warn(`[ClipsTab] Failed to load thumbnail for clip ${clip.id}:`, err);
            }
          })
        );
      }

      // Trigger Vue reactivity by replacing the Map reference
      // This is necessary because Map.set() mutations don't trigger re-renders
      if (hasNewThumbnails) {
        clipThumbnailCache.value = new Map(clipThumbnailCache.value);
      }
    }

    // Generate missing thumbnails sequentially (one at a time) for clips without built_thumbnail_path.
    // This covers cases where ProjectWorkspaceDialog is opened directly without going through Projects.vue.
    generateMissingThumbnails();
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
      (clip) => !clip.built_thumbnail_path && !clipThumbnailCache.value.has(clip.id)
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

        const videoPath = rawVideos[0].file_path;

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
            clipThumbnailCache.value.set(clip.id, dataUrl);
            hasNewThumbnails = true;

            // Trigger Vue reactivity after each thumbnail so they appear incrementally
            clipThumbnailCache.value = new Map(clipThumbnailCache.value);

            // Persist to database (non-blocking)
            updateClipBuildStatus(clip.id, clip.build_status || 'pending', {
              builtThumbnailPath: thumbnailPath,
            }).catch((err) => {
              console.warn(`[ClipsTab] Failed to persist thumbnail path for clip ${clip.id}:`, err);
            });
          } catch (err) {
            console.warn(`[ClipsTab] Failed to generate thumbnail for clip ${clip.id}:`, err);
          }
        }
      }
    } finally {
      thumbnailGenerationInProgress = false;
    }

    // Final reactivity trigger in case the incremental ones were batched
    if (hasNewThumbnails) {
      clipThumbnailCache.value = new Map(clipThumbnailCache.value);
    }
  }

  // Get thumbnail URL for a clip
  function getClipThumbnail(clipId: string): string | null {
    return clipThumbnailCache.value.get(clipId) || null;
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

    // Open dialog immediately (don't wait for async operations)
    clipToBuild.value = clip;
    showBuildSettingsDialog.value = true;

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

    try {
      console.log('[ClipsTab] Starting clip build for:', clip.id, 'with settings:', settings);
      console.log('[ClipsTab] Aspect ratios received:', settings.aspectRatios);

      const { updateClipBuildStatus, getRawVideosByProjectId, createClipBuild, getClipBuilds } = await import(
        '@/services/database'
      );
      const { getIntroOutroById, resolveIntroOutroById } = await import('@/services/database/intro-outros');
      const { resolveWatermarkById, resolveLayoutOverlaysForBuild } = await import('@/services/database/watermarks');

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
      // Manual clips from livestreams have file_path directly (already extracted)
      // Regular clips need to extract from raw_videos
      let projectVideo: { file_path: string; duration?: number | null };

      if (clip.file_path) {
        // Manual clip - use the file_path directly (already an extracted video file)
        console.log('[ClipsTab] Using manual clip file_path:', clip.file_path);
        projectVideo = {
          file_path: clip.file_path,
          duration: clip.duration || undefined,
        };
      } else {
        // Regular clip - get raw video from project
        const clipProjectId = clip.project_id || props.projectId;
        if (!clipProjectId) {
          throw new Error('No project ID available for clip');
        }
        const rawVideos = await getRawVideosByProjectId(clipProjectId);
        if (rawVideos.length === 0) {
          throw new Error('No project video found');
        }
        projectVideo = rawVideos[0];
      }

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
      const transcriptWords = props.transcriptData?.words || [];
      const transcriptSegments = props.transcriptData?.whisperSegments || [];

      // Prepare watermark settings if enabled
      // Now supports per-aspect-ratio watermark files - each ratio can use a completely different watermark
      // Uses resolveWatermarkById to handle both local IDs and org-asset-{serverId} format
      let watermarkSettings = null;
      if (settings.watermark && settings.watermark.enabled && settings.watermark.watermarkId) {
        const defaultWatermark = await resolveWatermarkById(settings.watermark.watermarkId);
        if (defaultWatermark) {
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
              let ratioFilePath = defaultWatermark.filePath;
              let ratioWidth = defaultWatermark.width;
              let ratioHeight = defaultWatermark.height;

              // If this ratio has a different watermark, fetch its file info
              // resolveWatermarkById handles both local IDs and org-asset-{serverId} format
              if (ratioWatermarkId && ratioWatermarkId !== settings.watermark.watermarkId) {
                const ratioWatermark = await resolveWatermarkById(ratioWatermarkId);
                if (ratioWatermark) {
                  ratioFilePath = ratioWatermark.filePath;
                  ratioWidth = ratioWatermark.width;
                  ratioHeight = ratioWatermark.height;
                  console.log(`[ClipsTab] Using different watermark for ${ratio}:`, ratioWatermarkId);
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
                filePath: defaultWatermark.filePath,
                width: defaultWatermark.width,
                height: defaultWatermark.height,
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
            filePath: defaultWatermark.filePath,
            width: defaultWatermark.width,
            height: defaultWatermark.height,
            positionX: settings.watermark.positionX,
            positionY: settings.watermark.positionY,
            opacity: settings.watermark.opacity,
            scale: settings.watermark.scale,
            // Per-ratio settings with resolved file paths
            perRatioSettings: buildPerRatioSettings,
          };
          const defaultWatermarkId = settings.watermark?.watermarkId;
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

      // Determine effective intro/outro: creator profile defaults take precedence, then dialog selection
      // Creator profile intro/outro MUST be applied when set - they are mandatory defaults
      const effectiveIntro = props.creatorDefaultIntro || settings.intro;
      const effectiveOutro = props.creatorDefaultOutro || settings.outro;

      let introPath: string | null = null;
      let outroPath: string | null = null;
      let introDuration: number | null = null;
      let outroDuration: number | null = null;

      // Handle intro
      if (effectiveIntro) {
        introPath = effectiveIntro.file_path || null;
        introDuration = effectiveIntro.duration || null;
        const introSource = props.creatorDefaultIntro ? '(creator profile)' : '(dialog selection)';
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
        const outroSource = props.creatorDefaultOutro ? '(creator profile)' : '(dialog selection)';
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

      // Resolve per-ratio intro/outro from creator profile
      const introOutroPerRatio: Record<string, { introPath?: string; introDuration?: number; outroPath?: string; outroDuration?: number }> = {};
      
      if (props.creatorProfile?.intro_outro_settings) {
        try {
          const introOutroSettings = JSON.parse(props.creatorProfile.intro_outro_settings);
          
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
        introPath: introPath,
        introDuration: introDuration,
        outroPath: outroPath,
        outroDuration: outroDuration,
        introOutroPerRatio: introOutroPerRatio,
        watermarkSettings: watermarkSettings,
        audioSettings: audioSettings,
        framingStrategy: framingStrategy,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        videoFilterSegments: videoFilterSegments,
        textOverlays: textOverlaysForExport,
        stickers: stickersForExport,
        clipWatermarks: clipWatermarksForExport,
        layoutOverlays: await resolveLayoutOverlaysForBuild(
          settings.layoutOverlays
            || (props.creatorProfile?.layout_overlays
              ? JSON.parse(props.creatorProfile.layout_overlays)
              : null)
        ),
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
