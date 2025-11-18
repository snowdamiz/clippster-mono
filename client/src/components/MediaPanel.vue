<template>
  <div class="px-4 flex flex-col flex-1 h-full" data-media-panel>
    <!-- Tabs Header -->
    <div class="flex items-center border-b border-border/60 -mx-4 gap-1">
      <button
        @click="activeTab = 'clips'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'clips'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Clips
        <div v-if="activeTab === 'clips'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
      </button>
      <button
        @click="activeTab = 'audio'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'audio'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Audio
        <div v-if="activeTab === 'audio'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
      </button>
      <button
        @click="activeTab = 'transcript'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'transcript'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Transcript
        <div
          v-if="activeTab === 'transcript'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
        ></div>
      </button>
      <button
        @click="activeTab = 'subtitles'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'subtitles'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Subtitles
        <div
          v-if="activeTab === 'subtitles'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
        ></div>
      </button>
    </div>

    <!-- Clips Tab Content -->
    <div v-if="activeTab === 'clips'" class="flex-1 flex flex-col overflow-hidden">
      <!-- Header with Detect More button and count -->
      <div v-if="clips.length > 0 && !isGenerating" class="flex items-center justify-between py-3 px-1 mt-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-foreground/90">
            {{ clips.length }} Clip{{ clips.length !== 1 ? 's' : '' }}
          </span>
          <span class="text-xs text-muted-foreground">•</span>
          <span class="text-xs text-muted-foreground">Click to preview on timeline</span>
        </div>
        <button
          @click="handleDetectClips"
          class="group flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 border border-border hover:border-foreground/40 rounded-md transition-all duration-200"
          title="Run clip detection again to find more clips"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Detect More</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <!-- Progress State -->
        <div v-if="isGenerating" class="h-full flex items-center justify-center px-4">
          <div class="text-center text-foreground w-full max-w-md">
            <!-- Stage Icon -->
            <div class="mb-6 flex justify-center">
              <div
                class="w-20 h-20 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg"
                :class="
                  stageIconClass.replace('text-', 'from-') +
                  '/10 via-' +
                  stageIconClass.replace('text-', '') +
                  '/5 to-transparent border-2 border-' +
                  stageIconClass.replace('text-', '') +
                  '/30'
                "
              >
                <component :is="stageIcon" :class="stageIconClass" class="h-9 w-9" />
              </div>
            </div>
            <!-- Stage Title -->
            <h4 class="font-semibold text-foreground mb-2 text-lg">{{ stageTitle }}</h4>

            <p class="text-sm text-foreground/70 mb-10 leading-relaxed">{{ stageDescription }}</p>
            <!-- Loading Spinner with Time Estimate -->
            <div class="mb-6">
              <div class="flex justify-center mb-5">
                <!-- Large spinner -->
                <div class="relative w-14 h-14">
                  <div class="absolute inset-0 border-4 border-muted/30 rounded-full"></div>
                  <div
                    class="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
                    :class="stageIconClass.replace('text-', 'border-t-')"
                    style="animation-duration: 0.8s"
                  ></div>
                </div>
              </div>

              <!-- Time estimate -->
              <div class="text-center mb-4">
                <p class="text-sm font-medium text-foreground mb-1.5">
                  {{ getLoadingMessage() }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ getTimeEstimate() }}
                </p>
              </div>
            </div>
            <!-- Status Message -->
            <div
              v-if="generationMessage"
              class="text-sm text-foreground/80 bg-muted/50 rounded-lg p-4 mb-4 border border-border/60"
            >
              {{ generationMessage }}
            </div>
            <!-- Error State -->
            <div v-if="generationError" class="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-4 mb-4">
              <div class="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div class="text-left flex-1">
                  <h4 class="font-semibold text-red-400 text-sm mb-1">Error</h4>
                  <p class="text-xs text-red-400/90 leading-relaxed">{{ generationError }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Clips List State -->
        <div
          v-else-if="clips.length > 0 && !isGenerating"
          class="w-full flex-1 overflow-y-auto pr-2 custom-scrollbar"
          ref="clipsScrollContainer"
        >
          <!-- Clips Grid -->
          <div class="space-y-3 pb-4">
            <div
              v-for="(clip, index) in clips"
              :key="clip.id"
              :ref="(el) => setClipRef(el, clip.id)"
              :class="[
                'group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg cursor-pointer transition-all duration-200 overflow-hidden',
                // Playing clip gets green styling
                props.isPlayingSegments && props.playingClipId === clip.id
                  ? 'ring-2 ring-green-500/50 bg-green-500/[0.04] border-green-500/50 shadow-lg shadow-green-500/10'
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
                    ? '2px'
                    : undefined,
              }"
              @click="onClipClick(clip.id)"
            >
              <!-- Left accent bar -->
              <div
                v-if="clip.run_number"
                class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200"
                :style="{
                  backgroundColor: clip.session_run_color || '#8B5CF6',
                  opacity: props.isPlayingSegments && props.playingClipId === clip.id ? '1' : '0.6',
                }"
              ></div>

              <div class="flex flex-col p-3.5 pl-4">
                <!-- Main Content Row -->
                <div class="flex items-start justify-between gap-3">
                  <!-- Left: Number + Content -->
                  <div class="flex items-start gap-2.5 flex-1 min-w-0">
                    <!-- Number Badge -->
                    <span class="text-xs font-bold text-foreground/30 mt-0.5 flex-shrink-0 tabular-nums select-none">
                      #{{ index + 1 }}
                    </span>

                    <!-- Content Column -->
                    <div class="flex-1 min-w-0 space-y-2">
                      <!-- Title -->
                      <h5 class="text-[15px] font-semibold text-foreground leading-tight line-clamp-2">
                        {{ clip.current_version_name || clip.name || 'Untitled Clip' }}
                      </h5>

                      <!-- Primary Info Row: Duration + Time Range -->
                      <div class="flex items-center gap-2.5 flex-wrap text-xs">
                        <!-- Duration Badge -->
                        <span
                          class="inline-flex items-center gap-1.5 text-foreground font-semibold bg-muted/60 px-2 py-0.5 rounded-md tabular-nums"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3 w-3 text-foreground/70"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {{
                            formatDuration(
                              (clip.current_version_end_time || 0) - (clip.current_version_start_time || 0)
                            )
                          }}
                        </span>

                        <!-- Time Range -->
                        <span class="font-mono text-muted-foreground/80 text-[11px] tabular-nums">
                          {{ formatTime(clip.current_version_start_time || 0) }} →
                          {{ formatTime(clip.current_version_end_time || 0) }}
                        </span>

                        <!-- Build Status (when completed) -->
                        <span
                          v-if="clip.build_status === 'completed'"
                          class="inline-flex items-center gap-1 text-green-400 text-[11px] font-medium"
                          :title="`Built: ${clip.built_file_size ? formatFileSize(clip.built_file_size) : 'Complete'}`"
                        >
                          <CheckIcon class="h-3 w-3" />
                          Built
                          <span v-if="clip.built_file_size" class="text-green-400/70">
                            ({{ formatFileSize(clip.built_file_size) }})
                          </span>
                        </span>

                        <!-- Build Progress -->
                        <span
                          v-else-if="clip.build_status === 'building'"
                          class="inline-flex items-center gap-1.5 text-blue-400 text-[11px] font-medium"
                        >
                          <LoaderIcon class="h-3 w-3 animate-spin" />
                          Building {{ Math.round(clip.build_progress || 0) }}%
                        </span>

                        <!-- Playing Indicator -->
                        <span
                          v-if="props.isPlayingSegments && props.playingClipId === clip.id"
                          class="inline-flex items-center gap-1.5 text-green-400 text-[11px] font-semibold"
                        >
                          <div class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                          Playing
                        </span>
                      </div>

                      <!-- Secondary Info Row: Run + Prompt + Timestamp -->
                      <div class="flex items-center gap-2 flex-wrap text-[11px]">
                        <!-- Run Number Badge -->
                        <span
                          v-if="clip.run_number"
                          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium bg-muted/40"
                          :style="{
                            color: clip.session_run_color || '#A78BFA',
                            backgroundColor: clip.session_run_color ? `${clip.session_run_color}15` : undefined,
                          }"
                          :title="`Detection run ${clip.run_number}`"
                        >
                          <div
                            class="w-1.5 h-1.5 rounded-full"
                            :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                          ></div>
                          Run {{ clip.run_number }}
                        </span>

                        <!-- Prompt Badge -->
                        <span
                          v-if="clip.session_prompt"
                          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium bg-purple-500/10 text-purple-400"
                          :title="`Used prompt: ${getPromptName(clip.session_prompt)}`"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-2.5 w-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                          </svg>
                          <span class="truncate max-w-32">{{ getPromptName(clip.session_prompt) }}</span>
                        </span>

                        <!-- Timestamp -->
                        <span v-if="clip.session_created_at" class="text-muted-foreground/60 flex items-center gap-1">
                          <ClockIcon class="h-3 w-3" />
                          {{ formatTimestamp(clip.session_created_at) }}
                        </span>

                        <!-- Confidence Score (hover to see) -->
                        <span
                          v-if="clip.current_version_confidence_score"
                          class="inline-flex items-center gap-1 text-blue-400/70 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Confidence score"
                        >
                          <TrendingUpIcon class="h-3 w-3" />
                          {{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Right: Action Buttons -->
                  <div
                    class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                  >
                    <button
                      class="p-2 hover:bg-blue-500/15 rounded-md transition-all duration-150 text-foreground/60 hover:text-blue-400 hover:scale-105 active:scale-95"
                      title="Play clip"
                      @click.stop="onPlayClip(clip)"
                    >
                      <PlayIcon class="h-4 w-4" />
                    </button>

                    <!-- Build/Download Button -->
                    <button
                      v-if="!clip.build_status || clip.build_status === 'pending' || clip.build_status === 'failed'"
                      class="p-2 hover:bg-green-500/15 rounded-md transition-all duration-150 text-foreground/60 hover:text-green-400 hover:scale-105 active:scale-95"
                      title="Build clip"
                      @click.stop="onBuildClip(clip)"
                    >
                      <WrenchIcon class="h-4 w-4" />
                    </button>
                    <button
                      v-else-if="clip.build_status === 'completed' && clip.built_file_path"
                      class="p-2 hover:bg-green-500/15 rounded-md transition-all duration-150 text-green-500/80 hover:text-green-400 hover:scale-105 active:scale-95"
                      title="Open built clip"
                      @click.stop="onOpenBuiltClip(clip)"
                    >
                      <DownloadIcon class="h-4 w-4" />
                    </button>

                    <button
                      class="p-2 hover:bg-red-500/15 rounded-md transition-all duration-150 text-foreground/60 hover:text-red-400 hover:scale-105 active:scale-95"
                      title="Delete clip"
                      @click.stop="onDeleteClip(clip.id)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Default State -->
        <div v-else class="h-full flex items-center justify-center px-4">
          <div class="text-center text-muted-foreground max-w-sm">
            <div class="mb-8 flex flex-col items-center">
              <div
                class="w-24 h-24 bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-blue-500/10 rounded-lg flex items-center justify-center mb-6 border border-purple-500/20 shadow-lg shadow-purple-500/5"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-12 w-12 text-purple-400/80"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h4 class="text-lg font-semibold text-foreground mb-2">No Clips Yet</h4>
              <p class="text-sm text-muted-foreground/80 mb-8 leading-relaxed">
                Start detecting clips from your video using AI-powered analysis
              </p>
            </div>
            <button
              @click="handleDetectClips"
              class="group inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium text-foreground bg-muted/40 hover:bg-muted/60 border border-border hover:border-foreground/50 rounded-md transition-all hover:shadow-lg hover:scale-105 active:scale-100"
              title="Detect Clips"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 group-hover:rotate-180 transition-transform duration-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Detect Clips</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Audio Tab Content -->
    <div v-if="activeTab === 'audio'" class="flex-1 flex flex-col overflow-hidden">
      <div class="h-full flex items-center justify-center px-4">
        <div class="text-center text-muted-foreground max-w-xs">
          <div class="mb-6 flex flex-col items-center">
            <div
              class="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg flex items-center justify-center mb-5 border border-blue-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-9 w-9 text-blue-400/70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h4 class="text-base font-semibold text-foreground mb-2">Audio Tab</h4>
            <p class="text-sm text-muted-foreground leading-relaxed">Audio functionality will be implemented here</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Transcript Tab Content -->
    <div v-if="activeTab === 'transcript'" class="flex-1 flex flex-col overflow-hidden">
      <TranscriptPanel
        :project-id="projectId"
        :current-time="currentTime"
        :duration="videoDuration"
        @seekVideo="onSeekVideo"
      />
    </div>

    <!-- Subtitles Tab Content -->
    <div v-if="activeTab === 'subtitles'" class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2 custom-scrollbar">
        <!-- Enable/Disable Toggle -->
        <div
          class="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border/60 hover:border-primary/30 transition-colors"
        >
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-1">Enable Subtitles</h3>
            <p class="text-xs text-muted-foreground">Show subtitles in video preview</p>
          </div>
          <button
            @click="toggleSubtitles"
            type="button"
            :class="[
              'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
              subtitleSettings.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
            ]"
            :title="subtitleSettings.enabled ? 'Disable subtitles' : 'Enable subtitles'"
            :aria-pressed="subtitleSettings.enabled"
          >
            <span
              :class="[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                subtitleSettings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
              ]"
            ></span>
          </button>
        </div>

        <!-- Saved Section -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-3 hover:border-border/70 transition-colors"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90">Saved</h3>
          </div>

          <!-- Save Buttons - Always show both when preset is selected -->
          <div v-if="selectedPreset" class="flex gap-2">
            <button
              @click="openSaveDialog('new')"
              class="flex-1 py-3 px-4 rounded-md transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-primary/15 to-primary/10 hover:from-primary/25 hover:to-primary/15 border-2 border-primary/30 hover:border-primary/50 group"
              title="Save as a new preset"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-primary group-hover:scale-110 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span class="text-sm font-bold text-primary">Save New</span>
            </button>
            <button
              @click="openSaveDialog('update')"
              class="flex-1 py-3 px-4 rounded-md transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500/15 to-green-500/10 hover:from-green-500/25 hover:to-green-500/15 border-2 border-green-500/30 hover:border-green-500/50 group"
              :title="`Update ${selectedPreset.name}`"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm font-bold text-green-500">Update Selected</span>
            </button>
          </div>
          <!-- Single button when no preset is selected -->
          <button
            v-else
            @click="openSaveDialog('new')"
            class="w-full py-3 px-4 rounded-md transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-primary/15 to-primary/10 hover:from-primary/25 hover:to-primary/15 border-2 border-primary/30 hover:border-primary/50 group"
            title="Save current settings as a new preset"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary group-hover:scale-110 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="text-sm font-bold text-primary">Save Current Settings</span>
          </button>

          <!-- Empty State -->
          <div v-if="allPresets.length === 0" class="py-8 text-center">
            <div class="flex justify-center mb-3">
              <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8 text-primary/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
            </div>
            <p class="text-sm font-semibold text-muted-foreground mb-1">No saved presets yet</p>
            <p class="text-xs text-muted-foreground/70">
              Customize your subtitle settings and save them for quick access later
            </p>
          </div>

          <!-- Preset Grid -->
          <div v-else class="space-y-2">
            <div v-for="preset in allPresets" :key="preset.id" class="relative group">
              <button
                @click="applyPreset(preset)"
                :class="[
                  'w-full relative rounded-md transition-all duration-200 text-left overflow-hidden',
                  isCurrentPreset(preset)
                    ? 'bg-primary/15 border border-primary shadow-md shadow-primary/10'
                    : 'bg-muted/30 border border-border/40 hover:border-primary/50 hover:bg-muted/50',
                ]"
              >
                <!-- Main content area -->
                <div class="p-3 flex items-center gap-3">
                  <!-- Icon/Indicator -->
                  <div
                    :class="[
                      'flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center transition-all',
                      isCurrentPreset(preset)
                        ? 'bg-primary/30 text-primary'
                        : 'bg-muted/60 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary',
                    ]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                      />
                    </svg>
                  </div>

                  <!-- Text content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <h4 class="text-sm font-bold text-foreground truncate">{{ preset.name }}</h4>
                      <div
                        v-if="isCurrentPreset(preset)"
                        class="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-primary"
                      >
                        <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                        Active
                      </div>
                    </div>
                    <p class="text-xs text-muted-foreground line-clamp-1">
                      {{ preset.description }}
                    </p>
                  </div>

                  <!-- Delete button -->
                  <button
                    @click.stop="presetToDelete = preset.id"
                    :class="[
                      'flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200',
                      'text-muted-foreground/40 hover:text-red-500',
                      'hover:bg-red-500/10 hover:scale-110',
                    ]"
                    title="Delete preset"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Font Settings -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-4 hover:border-border/70 transition-colors"
        >
          <h3
            class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90 flex items-center gap-2 pb-1 border-b border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
            Font
          </h3>

          <!-- Font Family -->
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">Font Family</label>
            <select
              v-model="subtitleSettings.fontFamily"
              @change="emitSettingsChange"
              class="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            >
              <option value="Inter">Inter</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Poppins">Poppins</option>
              <option value="Roboto">Roboto</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Impact">Impact</option>
              <option value="Bebas Neue">Bebas Neue</option>
            </select>
          </div>

          <!-- Font Size -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Font Size</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.fontSize }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.fontSize - 12) / (72 - 12)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.fontSize"
                @input="emitSettingsChange"
                min="12"
                max="72"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Font Weight -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Font Weight</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.fontWeight }}
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.fontWeight - 100) / (900 - 100)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.fontWeight"
                @input="emitSettingsChange"
                min="100"
                max="900"
                step="100"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>

        <!-- Color Settings -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-4 hover:border-border/70 transition-colors"
        >
          <h3
            class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90 flex items-center gap-2 pb-1 border-b border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            Colors
          </h3>

          <!-- Text Color -->
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">Text Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="subtitleSettings.textColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="subtitleSettings.textColor"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          <!-- Background -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-muted-foreground">Background Box</label>
              <button
                @click="
                  subtitleSettings.backgroundEnabled = !subtitleSettings.backgroundEnabled;
                  emitSettingsChange();
                "
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                  subtitleSettings.backgroundEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
                ]"
                :title="subtitleSettings.backgroundEnabled ? 'Disable background' : 'Enable background'"
                :aria-pressed="subtitleSettings.backgroundEnabled"
              >
                <span
                  :class="[
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                    subtitleSettings.backgroundEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                  ]"
                ></span>
              </button>
            </div>
            <div v-if="subtitleSettings.backgroundEnabled" class="flex gap-2 animate-in fade-in duration-200">
              <ColorPicker v-model="subtitleSettings.backgroundColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="subtitleSettings.backgroundColor"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Outline Settings -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-4 hover:border-border/70 transition-colors"
        >
          <h3
            class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90 flex items-center gap-2 pb-1 border-b border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Outline
          </h3>

          <!-- Outline Width -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Width</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.outlineWidth }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(subtitleSettings.outlineWidth / 8) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.outlineWidth"
                @input="emitSettingsChange"
                min="0"
                max="8"
                step="0.5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Outline Color -->
          <div v-if="subtitleSettings.outlineWidth > 0" class="space-y-2 animate-in fade-in duration-200">
            <label class="text-xs font-medium text-muted-foreground">Outline Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="subtitleSettings.outlineColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="subtitleSettings.outlineColor"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Shadow Settings -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-4 hover:border-border/70 transition-colors"
        >
          <h3
            class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90 flex items-center gap-2 pb-1 border-b border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            Shadow
          </h3>

          <!-- Shadow Blur -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Blur</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.shadowBlur }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(subtitleSettings.shadowBlur / 20) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.shadowBlur"
                @input="emitSettingsChange"
                min="0"
                max="20"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <div v-if="subtitleSettings.shadowBlur > 0" class="grid grid-cols-2 gap-3">
            <!-- Shadow Offset X -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-medium text-muted-foreground">Offset X</label>
                <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                  {{ subtitleSettings.shadowOffsetX }}px
                </span>
              </div>
              <div class="relative h-2 bg-muted-foreground/30 rounded-md">
                <div
                  class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                  :style="{ width: `${((subtitleSettings.shadowOffsetX + 20) / 40) * 100}%` }"
                ></div>
                <input
                  type="range"
                  v-model.number="subtitleSettings.shadowOffsetX"
                  @input="emitSettingsChange"
                  min="-20"
                  max="20"
                  step="1"
                  class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                />
              </div>
            </div>

            <!-- Shadow Offset Y -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-medium text-muted-foreground">Offset Y</label>
                <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                  {{ subtitleSettings.shadowOffsetY }}px
                </span>
              </div>
              <div class="relative h-2 bg-muted-foreground/30 rounded-md">
                <div
                  class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                  :style="{ width: `${((subtitleSettings.shadowOffsetY + 20) / 40) * 100}%` }"
                ></div>
                <input
                  type="range"
                  v-model.number="subtitleSettings.shadowOffsetY"
                  @input="emitSettingsChange"
                  min="-20"
                  max="20"
                  step="1"
                  class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                />
              </div>
            </div>
          </div>

          <!-- Shadow Color -->
          <div v-if="subtitleSettings.shadowBlur > 0" class="space-y-2 animate-in fade-in duration-200">
            <label class="text-xs font-medium text-muted-foreground">Shadow Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="subtitleSettings.shadowColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="subtitleSettings.shadowColor"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Position Settings -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-4 hover:border-border/70 transition-colors"
        >
          <h3
            class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90 flex items-center gap-2 pb-1 border-b border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Position
          </h3>

          <!-- Position Preset -->
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">Position</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="setPosition('top')"
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  subtitleSettings.position === 'top'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Top
              </button>
              <button
                @click="setPosition('middle')"
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  subtitleSettings.position === 'middle'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Middle
              </button>
              <button
                @click="setPosition('bottom')"
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  subtitleSettings.position === 'bottom'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Bottom
              </button>
            </div>
          </div>

          <!-- Fine-tune Position -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Fine-tune</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.positionPercentage }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${subtitleSettings.positionPercentage}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.positionPercentage"
                @input="emitSettingsChange"
                min="0"
                max="100"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Max Width -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Max Width</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.maxWidth }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.maxWidth - 40) / (100 - 40)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.maxWidth"
                @input="emitSettingsChange"
                min="40"
                max="100"
                step="5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div
          class="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-4 hover:border-border/70 transition-colors"
        >
          <h3
            class="text-sm font-bold text-foreground tracking-wide uppercase text-primary/90 flex items-center gap-2 pb-1 border-b border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Advanced
          </h3>

          <!-- Line Height -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Line Height</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ Number(subtitleSettings.lineHeight).toFixed(2) }}
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((Number(subtitleSettings.lineHeight) - 0.5) / (2.5 - 0.5)) * 100}%` }"
              ></div>
              <input
                type="range"
                :value="subtitleSettings.lineHeight"
                @input="
                  (e) => {
                    subtitleSettings.lineHeight = parseFloat((e.target as HTMLInputElement).value);
                    emitSettingsChange();
                  }
                "
                min="0.5"
                max="2.5"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Letter Spacing -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Letter Spacing</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.letterSpacing }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.letterSpacing + 2) / (10 + 2)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.letterSpacing"
                @input="emitSettingsChange"
                min="-2"
                max="10"
                step="0.5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Word Spacing -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Word Spacing</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.wordSpacing.toFixed(2) }}em
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.wordSpacing - 0.1) / (1 - 0.1)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.wordSpacing"
                @input="emitSettingsChange"
                min="0.1"
                max="1"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Text Align -->
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">Text Align</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="
                  subtitleSettings.textAlign = 'left';
                  emitSettingsChange();
                "
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  subtitleSettings.textAlign === 'left'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Left
              </button>
              <button
                @click="
                  subtitleSettings.textAlign = 'center';
                  emitSettingsChange();
                "
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  subtitleSettings.textAlign === 'center'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Center
              </button>
              <button
                @click="
                  subtitleSettings.textAlign = 'right';
                  emitSettingsChange();
                "
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  subtitleSettings.textAlign === 'right'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Right
              </button>
            </div>
          </div>

          <!-- Text Offset X (Horizontal Position) -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Horizontal Offset</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.textOffsetX }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.textOffsetX + 50) / 100) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.textOffsetX"
                @input="emitSettingsChange"
                min="-50"
                max="50"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Text Offset Y (Vertical Position) -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Vertical Offset</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.textOffsetY }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((subtitleSettings.textOffsetY + 50) / 100) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.textOffsetY"
                @input="emitSettingsChange"
                min="-50"
                max="50"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Padding -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Padding</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.padding }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(subtitleSettings.padding / 40) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.padding"
                @input="emitSettingsChange"
                min="0"
                max="40"
                step="2"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Border Radius -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-medium text-muted-foreground">Border Radius</label>
              <span class="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">
                {{ subtitleSettings.borderRadius }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(subtitleSettings.borderRadius / 20) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="subtitleSettings.borderRadius"
                @input="emitSettingsChange"
                min="0"
                max="20"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>

        <!-- Reset Button -->
        <div
          class="bg-destructive/5 backdrop-blur-sm border border-destructive/20 rounded-lg p-4 hover:border-destructive/30 transition-colors"
        >
          <button
            @click="resetToDefaults"
            class="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive-foreground text-sm font-bold rounded-md transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md border border-destructive/30 hover:border-destructive/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>

    <!-- Save Preset Dialog -->
    <Teleport to="body">
      <div
        v-if="showSavePresetDialog"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="closeSaveDialog"
      >
        <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
          <h2 class="text-2xl font-bold mb-4">
            {{ saveMode === 'update' ? 'Update Preset' : 'Save New Preset' }}
          </h2>

          <div class="space-y-4">
            <p v-if="saveMode === 'update'" class="text-muted-foreground">
              Update
              <span class="font-semibold text-foreground">{{ selectedPreset?.name }}</span>
              with your current settings.
            </p>
            <p v-else class="text-muted-foreground">Save your current subtitle settings as a reusable preset.</p>

            <div v-if="saveMode === 'new'">
              <label class="block text-sm font-medium text-foreground mb-2">Preset Name *</label>
              <input
                v-model="newPresetName"
                type="text"
                placeholder="e.g., My Custom Style"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                @keydown.enter="handleSavePreset"
              />
            </div>

            <div v-if="saveMode === 'new'">
              <label class="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea
                v-model="newPresetDescription"
                placeholder="Optional description for this preset"
                rows="2"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
              ></textarea>
            </div>

            <button
              @click="handleSavePreset"
              :class="[
                'w-full py-3 rounded-md font-semibold transition-all text-white',
                saveMode === 'update'
                  ? 'bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500/90 hover:to-green-600/90'
                  : 'bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90',
              ]"
            >
              {{ saveMode === 'update' ? 'Update Preset' : 'Save Preset' }}
            </button>
            <button
              @click="closeSaveDialog"
              class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Preset Confirmation Dialog -->
    <Teleport to="body">
      <div
        v-if="presetToDelete"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="presetToDelete = null"
      >
        <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
          <h2 class="text-2xl font-bold mb-4">Delete Preset</h2>

          <div class="space-y-4">
            <p class="text-muted-foreground">
              Are you sure you want to delete this preset?
              <span class="font-semibold text-foreground">This action cannot be undone.</span>
            </p>

            <button
              @click="deleteCustomPreset(presetToDelete)"
              class="w-full py-3 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md font-semibold transition-all"
            >
              Delete Preset
            </button>
            <button
              @click="presetToDelete = null"
              class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Build Settings Dialog -->
    <ClipBuildSettingsDialog v-model="showBuildSettingsDialog" :clip="clipToBuild" @confirm="onBuildConfirm" />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
  import { listen } from '@tauri-apps/api/event';
  import {
    getClipDetectionSessionsByProjectId,
    getAllPrompts,
    getClipsWithBuildStatus,
    updateClipBuildStatus,
    getRawVideosByProjectId,
    getAllCustomSubtitlePresets,
    createCustomSubtitlePreset,
    updateCustomSubtitlePreset,
    deleteCustomSubtitlePreset,
    customPresetToSettings,
    type ClipWithVersion,
    type ClipDetectionSession,
    type Prompt,
    type CustomSubtitlePreset,
  } from '@/services/database';
  import type { MediaPanelProps, MediaPanelEmits, SubtitleSettings, SubtitlePreset } from '../types';
  import {
    PlayIcon,
    BrainIcon,
    CheckCircleIcon,
    XCircleIcon,
    ActivityIcon,
    MicIcon,
    ClockIcon,
    TrendingUpIcon,
    WrenchIcon,
    DownloadIcon,
    LoaderIcon,
    CheckIcon,
  } from 'lucide-vue-next';
  import TranscriptPanel from './TranscriptPanel.vue';
  import ColorPicker from './ColorPicker.vue';
  import ClipBuildSettingsDialog, { type BuildSettings } from './ClipBuildSettingsDialog.vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';

  const props = withDefaults(defineProps<MediaPanelProps>(), {
    isGenerating: false,
    generationProgress: 0,
    generationStage: '',
    generationMessage: '',
    generationError: '',
    playingClipId: null,
    isPlayingSegments: false,
    videoDuration: 0,
    currentTime: 0,
    aspectRatio: () => ({ width: 16, height: 9 }),
  });

  const emit = defineEmits<MediaPanelEmits>();

  // Tab state
  const activeTab = ref('clips');

  // Prompts state for matching prompt names to session prompts
  const prompts = ref<Prompt[]>([]);

  // Clips state
  const clips = ref<ClipWithVersion[]>([]);
  const detectionSessions = ref<ClipDetectionSession[]>([]);
  const loadingClips = ref(false);
  const hoveredClipId = ref<string | null>(null);

  // Refs for scroll containers
  const clipsScrollContainer = ref<HTMLElement | null>(null);

  // Use transcript data composable
  const { transcriptData } = useTranscriptData(computed(() => props.projectId || null));

  // Calculate max words based on aspect ratio (matches VideoPlayer.vue logic)
  const maxWordsForAspectRatio = computed(() => {
    const aspectRatioValue = props.aspectRatio.width / props.aspectRatio.height;

    if (aspectRatioValue > 1.5) {
      return 6; // wide formats (16:9, 21:9)
    } else if (aspectRatioValue > 0.9) {
      return 4; // squarish (1:1, 4:3)
    } else {
      return 3; // vertical (9:16, 4:5)
    }
  });

  // Subtitle state
  const getDefaultSubtitleSettings = (): SubtitleSettings => ({
    enabled: false,
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: 700,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundEnabled: false,
    outlineWidth: 3,
    outlineColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowColor: '#000000',
    position: 'bottom',
    positionPercentage: 85,
    maxWidth: 90,
    animationStyle: 'none',
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    padding: 16,
    borderRadius: 8,
    wordSpacing: 0.35,
  });

  const subtitleSettings = ref<SubtitleSettings>(getDefaultSubtitleSettings());
  const customPresets = ref<CustomSubtitlePreset[]>([]);
  const selectedPresetId = ref<string | null>(null);

  // UI state for saving presets
  const showSavePresetDialog = ref(false);
  const newPresetName = ref('');
  const newPresetDescription = ref('');
  const presetToDelete = ref<string | null>(null);
  const saveMode = ref<'new' | 'update'>('new');

  // UI state for build settings dialog
  const showBuildSettingsDialog = ref(false);
  const clipToBuild = ref<ClipWithVersion | null>(null);

  // Computed property for custom presets only
  const allPresets = computed(() => {
    return customPresets.value.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description || '',
      settings: customPresetToSettings(preset),
    }));
  });

  // Get the currently selected preset
  const selectedPreset = computed(() => {
    if (!selectedPresetId.value) return null;
    return allPresets.value.find((p) => p.id === selectedPresetId.value) || null;
  });

  // Load custom presets from database
  async function loadCustomPresets() {
    try {
      customPresets.value = await getAllCustomSubtitlePresets();
      console.log('[MediaPanel] Loaded custom presets:', customPresets.value.length);
    } catch (error) {
      console.error('[MediaPanel] Failed to load custom presets:', error);
    }
  }

  // Open save dialog with specified mode
  function openSaveDialog(mode: 'new' | 'update') {
    saveMode.value = mode;
    if (mode === 'new') {
      newPresetName.value = '';
      newPresetDescription.value = '';
    } else if (mode === 'update' && selectedPreset.value) {
      newPresetName.value = selectedPreset.value.name;
      newPresetDescription.value = selectedPreset.value.description;
    }
    showSavePresetDialog.value = true;
  }

  // Close save dialog
  function closeSaveDialog() {
    showSavePresetDialog.value = false;
    newPresetName.value = '';
    newPresetDescription.value = '';
  }

  // Handle save/update action
  async function handleSavePreset() {
    if (saveMode.value === 'update') {
      await updatePreset();
    } else {
      await saveAsCustomPreset();
    }
  }

  // Update existing preset
  async function updatePreset() {
    if (!selectedPresetId.value || !selectedPreset.value) {
      showErrorMessage('Error', 'No preset selected to update.');
      return;
    }

    try {
      // Save preset with enabled always set to false (presets should only store styling, not enabled state)
      const settingsToSave = { ...subtitleSettings.value, enabled: false };

      await updateCustomSubtitlePreset(
        selectedPresetId.value,
        undefined, // Keep the same name
        undefined, // Keep the same description
        settingsToSave
      );

      // Reload custom presets
      await loadCustomPresets();

      // Close dialog
      closeSaveDialog();

      showSuccessMessage('Preset Updated', `"${selectedPreset.value.name}" has been updated successfully!`);
    } catch (error) {
      console.error('[MediaPanel] Failed to update preset:', error);
      showErrorMessage('Update Failed', 'Failed to update preset. Please try again.');
    }
  }

  // Save current settings as a new custom preset
  async function saveAsCustomPreset() {
    if (!newPresetName.value.trim()) {
      showErrorMessage('Invalid Name', 'Please enter a name for the preset.');
      return;
    }

    const presetName = newPresetName.value.trim();

    try {
      // Save preset with enabled always set to false (presets should only store styling, not enabled state)
      const settingsToSave = { ...subtitleSettings.value, enabled: false };

      const newId = await createCustomSubtitlePreset(presetName, newPresetDescription.value.trim(), settingsToSave);

      // Reload custom presets
      await loadCustomPresets();

      // Set the newly created preset as selected
      selectedPresetId.value = newId;

      // Close dialog
      closeSaveDialog();

      showSuccessMessage('Preset Saved', `Preset "${presetName}" has been saved successfully!`);
    } catch (error) {
      console.error('[MediaPanel] Failed to save preset:', error);
      showErrorMessage('Save Failed', 'Failed to save preset. Please try again.');
    }
  }

  // Delete a preset
  async function deleteCustomPreset(presetId: string) {
    try {
      await deleteCustomSubtitlePreset(presetId);

      // Clear selection if the deleted preset was selected
      if (selectedPresetId.value === presetId) {
        selectedPresetId.value = null;
      }

      await loadCustomPresets();
      presetToDelete.value = null;
      showSuccessMessage('Preset Deleted', 'Preset has been deleted successfully!');
    } catch (error) {
      console.error('[MediaPanel] Failed to delete preset:', error);
      showErrorMessage('Delete Failed', 'Failed to delete preset. Please try again.');
    }
  }

  onMounted(async () => {
    // Load prompts for name matching
    await loadPrompts();

    // Load custom subtitle presets
    await loadCustomPresets();

    // Load subtitle settings from localStorage
    try {
      const saved = localStorage.getItem('subtitle-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore all settings from localStorage but always default subtitles to off
        subtitleSettings.value = { ...getDefaultSubtitleSettings(), ...parsed, enabled: false };
        // Emit to sync with VideoPlayer
        emitSettingsChange();
      }
    } catch (error) {
      console.error('[MediaPanel] Failed to load subtitle settings:', error);
    }
  });

  // Watch for project changes and load clips
  watch(
    () => props.projectId,
    async (projectId) => {
      if (projectId) {
        await loadClipsAndHistory(projectId);
      } else {
        clips.value = [];
        detectionSessions.value = [];
      }
    },
    { immediate: true }
  );

  // Watch for generation state changes to refresh clips when generation completes
  watch([() => props.isGenerating, () => props.generationProgress], async ([isGenerating, progress]) => {
    if (!isGenerating && progress === 100 && props.projectId) {
      // Add a small delay to ensure database writes are committed
      setTimeout(async () => {
        await loadClipsAndHistory(props.projectId!);
      }, 500);
    }
  });

  // Watch for timeline hover changes to clear internal hover state
  watch(
    () => props.hoveredTimelineClipId,
    (newTimelineHoverId) => {
      if (newTimelineHoverId) {
        // Clear internal hover state when timeline hover is active
        hoveredClipId.value = null;
      }
    }
  );

  // Watch for playing clip changes to clear hover state when playback starts
  watch(
    () => props.playingClipId,
    (newPlayingId) => {
      if (newPlayingId) {
        // Clear all hover states when a clip starts playing
        hoveredClipId.value = null;
      }
    }
  );

  // Load prompts for name matching
  async function loadPrompts() {
    try {
      prompts.value = await getAllPrompts();
    } catch (error) {
      console.error('[MediaPanel] Failed to load prompts:', error);
    }
  }

  // Load clips and detection history
  async function loadClipsAndHistory(projectId: string) {
    if (!projectId) return;

    loadingClips.value = true;
    try {
      // Load current clips with versions and build status
      clips.value = await getClipsWithBuildStatus(projectId);
      if (clips.value.length > 0) {
        // Log all unique run colors for debugging
        const uniqueRuns = new Map<number, string>();
        clips.value.forEach((clip) => {
          if (clip.run_number && clip.session_run_color) {
            uniqueRuns.set(clip.run_number, clip.session_run_color);
          }
        });
      }

      // Load detection sessions for history
      detectionSessions.value = await getClipDetectionSessionsByProjectId(projectId);
    } catch (error) {
      console.error('[MediaPanel] Failed to load clips:', error);
    } finally {
      loadingClips.value = false;
    }
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

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function refreshClips() {
    if (props.projectId) {
      await loadClipsAndHistory(props.projectId);
    }
  }

  function handleDetectClips() {
    emit('detectClips');
  }

  function onDeleteClip(clipId: string) {
    emit('deleteClip', clipId);
  }

  function onPlayClip(clip: ClipWithVersion) {
    emit('playClip', clip);
  }

  // Clip click event handler
  function onClipClick(clipId: string) {
    // Find the clip from our clips array
    const clip = clips.value.find((c) => c.id === clipId);

    if (clip && clip.current_version_segments && clip.current_version_segments.length > 0) {
      // Sort segments by start_time to find the first one
      const sortedSegments = [...clip.current_version_segments].sort((a, b) => a.start_time - b.start_time);
      const firstSegment = sortedSegments[0];

      // Emit seek event to move video to the start of the first segment
      emit('seekVideo', firstSegment.start_time);
    }

    // Toggle the hovered state - if clicking the same clip, unhighlight it
    hoveredClipId.value = hoveredClipId.value === clipId ? null : clipId;
    emit('clipHover', clipId);
    emit('scrollToTimeline');
  }

  function onSeekVideo(time: number) {
    emit('seekVideo', time);
  }

  // Ref management for clip elements
  const clipElements = ref<Map<string, HTMLElement>>(new Map());

  function setClipRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      clipElements.value.set(clipId, el);
    } else {
      clipElements.value.delete(clipId);
    }
  }

  // Function to scroll clip into view
  function scrollClipIntoView(clipId: string) {
    const clipElement = clipElements.value.get(clipId);
    const container = clipsScrollContainer.value;

    if (clipElement && container) {
      // Always force scroll to the bottom-most clip for testing
      clipElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      return;
    } else {
      console.log('[MediaPanel] Cannot scroll - missing elements');
    }
  }

  // Expose function to parent (will be merged with existing defineExpose)

  // Computed property to match session prompt content to prompt names
  const promptNameMap = computed(() => {
    const map = new Map<string, string>();
    prompts.value.forEach((prompt) => {
      map.set(prompt.content, prompt.name);
    });
    return map;
  });

  // Function to get prompt name from session prompt content
  function getPromptName(sessionPrompt?: string): string {
    if (!sessionPrompt) return 'Unknown Prompt';
    return promptNameMap.value.get(sessionPrompt) || 'Custom Prompt';
  }

  // Computed properties for progress display
  const stageIcon = computed(() => {
    switch (props.generationStage) {
      case 'starting':
        return PlayIcon;
      case 'transcribing':
        return MicIcon;
      case 'analyzing':
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
        return 'text-blue-500';
      case 'transcribing':
        return 'text-yellow-500';
      case 'analyzing':
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
        return 'Separating Audio';
      case 'transcribing':
        return 'Transcribing Audio';
      case 'analyzing':
        return 'Detecting Clips';
      case 'validating':
        return 'Validating Results';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Separating Audio';
    }
  });

  const stageDescription = computed(() => {
    switch (props.generationStage) {
      case 'starting':
        return 'Separating audio from vidoe...';
      case 'transcribing':
        return 'Converting audio to text using AI...';
      case 'analyzing':
        return 'Analyzing transcript for clip-worthy moments...';
      case 'validating':
        return 'Validating timestamps and refining clips...';
      case 'completed':
        return 'Clips have been successfully generated!';
      case 'error':
        return 'An error occurred during processing.';
      default:
        return 'Separating audio from vidoe...';
    }
  });

  // Functions for the new spinner UI
  function getLoadingMessage(): string {
    switch (props.generationStage) {
      case 'starting':
        return 'Initializing detection...';
      case 'transcribing':
        return 'Transcribing audio...';
      case 'analyzing':
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

  function getTimeEstimate(): string {
    // Base time estimates in minutes for different video lengths
    // These are rough estimates to set user expectations
    const estimates = {
      starting: 'This usually takes about 30 seconds',
      transcribing: getTranscriptionEstimate(),
      analyzing: 'This typically takes 1-2 minutes',
      validating: 'Almost done... 30 seconds remaining',
      completed: 'Finishing up...',
      error: 'Please try again',
      default: 'This may take a few minutes depending on video length',
    };

    return estimates[props.generationStage as keyof typeof estimates] || estimates.default;
  }

  function getTranscriptionEstimate(): string {
    if (!props.videoDuration || props.videoDuration === 0) {
      return 'This typically takes 2-10 minutes depending on video length';
    }

    // Convert video duration from seconds to minutes
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

  // ===== CLIP BUILDING FUNCTIONS =====

  // Format file size for display
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Handle clip build request - show settings dialog
  async function onBuildClip(clip: ClipWithVersion) {
    if (!props.projectId) {
      console.error('[MediaPanel] No project ID available for clip build');
      return;
    }

    if (!clip.current_version_segments || clip.current_version_segments.length === 0) {
      console.error('[MediaPanel] No segments found for clip build');
      return;
    }

    // Show build settings dialog
    clipToBuild.value = clip;
    showBuildSettingsDialog.value = true;
  }

  // Handle build confirmation with settings
  async function onBuildConfirm(settings: BuildSettings) {
    const clip = clipToBuild.value;
    if (!clip || !props.projectId) {
      console.error('[MediaPanel] No clip or project ID available for build');
      return;
    }

    try {
      console.log('[MediaPanel] Starting clip build for:', clip.id, 'with settings:', settings);

      // Update database status to building
      await updateClipBuildStatus(clip.id, 'building', { progress: 0 });

      // Get the project video file path
      const rawVideos = await getRawVideosByProjectId(props.projectId);
      if (rawVideos.length === 0) {
        throw new Error('No project video found');
      }

      const projectVideo = rawVideos[0];

      // Prepare segments for the Rust backend
      const segments = clip.current_version_segments.map((segment) => ({
        id: segment.id,
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration,
        transcript: segment.transcript,
      }));

      // Call the Tauri clip building command
      const { invoke } = await import('@tauri-apps/api/core');

      // Get transcript data
      const transcriptWords = transcriptData.value?.words || [];
      const transcriptSegments = transcriptData.value?.whisperSegments || [];

      // Get max words per line based on aspect ratio (matches VideoPlayer.vue preview)
      const maxWords = maxWordsForAspectRatio.value;

      // TODO: Update backend to handle multiple aspect ratios and other settings
      // For now, just use the first selected aspect ratio
      await invoke('build_clip_from_segments', {
        projectId: props.projectId,
        clipId: clip.id,
        clipName: clip.current_version_name || clip.name || 'Untitled', // Pass clip name for folder
        videoPath: projectVideo.file_path,
        segments: segments,
        subtitleSettings: settings.includeSubtitles
          ? subtitleSettings.value
          : { ...subtitleSettings.value, enabled: false },
        transcriptWords: transcriptWords,
        transcriptSegments: transcriptSegments,
        maxWords: maxWords,
        aspectRatio: props.aspectRatio,
        runNumber: clip.run_number || null, // Pass the run number from detection session
      });

      console.log('[MediaPanel] Clip build started successfully');

      // Refresh clips to show building status
      await refreshClips();
    } catch (error) {
      console.error('[MediaPanel] Failed to start clip build:', error);

      // Update database status to failed
      await updateClipBuildStatus(clip.id, 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Refresh clips to show failed status
      await refreshClips();

      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorMessage(
        'Build Failed',
        `Failed to build clip "${clip.current_version_name || clip.name || 'Untitled'}": ${errorMessage}`
      );
    }
  }

  // Open/view built clip
  async function onOpenBuiltClip(clip: ClipWithVersion) {
    if (!clip.built_file_path) {
      console.error('[MediaPanel] No built file path available');
      return;
    }

    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(clip.built_file_path);
      console.log('[MediaPanel] Opened built clip:', clip.built_file_path);
    } catch (error) {
      console.error('[MediaPanel] Failed to open built clip:', error);
      showErrorMessage('Failed to Open', 'Could not open the built clip file. Please check if the file still exists.');
    }
  }

  // Show error message to user (using toast)
  async function showErrorMessage(title: string, message: string) {
    try {
      // Import and use toast composable
      const toastComposable = await import('@/composables/useToast');
      const { error: showError } = toastComposable.useToast();
      showError(title, message, 8000);
    } catch (error) {
      console.error('[MediaPanel] Failed to show error message:', error);
      // Fallback to alert if toast is not available
      alert(`${title}: ${message}`);
    }
  }

  // ===== SUBTITLE FUNCTIONS =====

  function toggleSubtitles() {
    const wasEnabled = subtitleSettings.value.enabled;
    subtitleSettings.value.enabled = !subtitleSettings.value.enabled;

    // When turning subtitles ON for the first time, select the most recent preset if available
    // (Presets are ordered by created_at DESC, so index 0 is the newest)
    if (!wasEnabled && subtitleSettings.value.enabled && allPresets.value.length > 0 && !selectedPresetId.value) {
      const latestPreset = allPresets.value[0];
      applyPreset(latestPreset);
      return; // applyPreset already calls emitSettingsChange
    }

    emitSettingsChange();
  }

  function applyPreset(preset: SubtitlePreset) {
    // Preserve the current enabled state when applying a preset
    const currentEnabledState = subtitleSettings.value.enabled;
    subtitleSettings.value = { ...preset.settings, enabled: currentEnabledState };
    selectedPresetId.value = preset.id;
    emitSettingsChange();
  }

  function isCurrentPreset(preset: SubtitlePreset): boolean {
    // Only show as active if this preset is actually selected
    return selectedPresetId.value === preset.id;
  }

  function setPosition(position: 'top' | 'middle' | 'bottom') {
    subtitleSettings.value.position = position;
    // Set default percentages for each position
    if (position === 'top') {
      subtitleSettings.value.positionPercentage = 15;
    } else if (position === 'middle') {
      subtitleSettings.value.positionPercentage = 50;
    } else {
      subtitleSettings.value.positionPercentage = 85;
    }
    emitSettingsChange();
  }

  function emitSettingsChange() {
    emit('subtitleSettingsChanged', subtitleSettings.value);
  }

  function resetToDefaults() {
    subtitleSettings.value = getDefaultSubtitleSettings();
    selectedPresetId.value = null;
    emitSettingsChange();
  }

  // Watch for subtitle settings changes and save to localStorage
  watch(
    subtitleSettings,
    (newSettings) => {
      try {
        localStorage.setItem('subtitle-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.error('[MediaPanel] Failed to save subtitle settings:', error);
      }
    },
    { deep: true }
  );

  // Expose methods for external access
  defineExpose({
    refreshClips,
    scrollClipIntoView,
  });

  // Event listener for fallback refresh mechanism
  function handleRefreshEvent(event: CustomEvent) {
    if (event.detail?.projectId === props.projectId) {
      refreshClips();
    }
  }

  // Handle clip build progress events
  function handleClipBuildProgress(event: any) {
    // Tauri events provide payload in event.payload, not event.detail
    const payload = event.payload || event.detail;
    const { clip_id, progress, stage, message } = payload;

    console.log(`[MediaPanel] Received clip build progress event for: ${clip_id}`);

    // Only process if this clip belongs to our project
    const clip = clips.value.find((c) => c.id === clip_id);
    if (!clip) {
      console.log(`[MediaPanel] Clip ${clip_id} not found in current clips array, updating database anyway`);
      // Still update database even if not in current array
    } else {
      console.log(`[MediaPanel] Clip build progress: ${clip_id} - ${progress}% - ${stage}`);

      // Update local state immediately
      clip.build_status = 'building';
      clip.build_progress = progress;
    }

    // Update the clip's progress in the database
    updateClipBuildStatus(clip_id, 'building', {
      progress,
      error: stage === 'error' ? message : undefined,
    }).catch((error) => {
      console.error('[MediaPanel] Failed to update clip build progress:', error);
    });

    // Refresh clips to show updated progress
    refreshClips();
  }

  // Handle clip build completion events
  function handleClipBuildComplete(event: any) {
    // Tauri events provide payload in event.payload, not event.detail
    const payload = event.payload || event.detail;
    const { clip_id, success, output_path, thumbnail_path, duration, file_size, error } = payload;

    console.log(`[MediaPanel] Received clip build complete event for: ${clip_id}`);

    // Process regardless of whether clip is in current array - update database directly
    if (success) {
      console.log(`[MediaPanel] Clip build SUCCEEDED: ${clip_id}`);

      // Update database with success status and file info
      updateClipBuildStatus(clip_id, 'completed', {
        progress: 100,
        builtFilePath: output_path,
        builtThumbnailPath: thumbnail_path,
        builtDuration: duration,
        builtFileSize: file_size,
        error: undefined,
      })
        .then(() => {
          console.log(`[MediaPanel] Database updated successfully for clip: ${clip_id}`);
          // Find the clip for showing success message
          const clip = clips.value.find((c) => c.id === clip_id);
          if (clip) {
            showSuccessMessage(
              'Clip Built Successfully',
              `Clip "${clip.current_version_name || clip.name || 'Untitled'}" has been built successfully! (${formatFileSize(file_size || 0)})`
            );
          } else {
            showSuccessMessage(
              'Clip Built Successfully',
              `Clip has been built successfully! (${formatFileSize(file_size || 0)})`
            );
          }
          // Refresh clips to get updated status
          refreshClips();
        })
        .catch((dbError) => {
          console.error('[MediaPanel] Failed to update clip build completion:', dbError);
        });
    } else {
      console.log(`[MediaPanel] Clip build FAILED: ${clip_id} - ${error}`);

      // Update database with failure status
      updateClipBuildStatus(clip_id, 'failed', {
        progress: 0,
        error: error || 'Unknown build error',
      })
        .then(() => {
          // Find the clip for showing error message
          const clip = clips.value.find((c) => c.id === clip_id);
          if (clip) {
            showErrorMessage(
              'Build Failed',
              `Failed to build clip "${clip.current_version_name || clip.name || 'Untitled'}": ${error || 'Unknown error'}`
            );
          } else {
            showErrorMessage('Build Failed', `Failed to build clip: ${error || 'Unknown error'}`);
          }
          // Refresh clips to get updated status
          refreshClips();
        })
        .catch((dbError) => {
          console.error('[MediaPanel] Failed to update clip build failure:', dbError);
        });
    }
  }

  // Show success message to user (using toast)
  async function showSuccessMessage(title: string, message: string) {
    try {
      // Import and use toast composable
      const toastComposable = await import('@/composables/useToast');
      const { success: showSuccess } = toastComposable.useToast();
      showSuccess(title, message, 6000);
    } catch (error) {
      console.error('[MediaPanel] Failed to show success message:', error);
      // Fallback to console if toast is not available
      console.log(`✅ ${title}: ${message}`);
    }
  }

  onMounted(async () => {
    // Add event listener for refresh events
    document.addEventListener('refresh-clips', handleRefreshEvent as EventListener);

    // Add event listeners for clip build events using Tauri API
    try {
      await listen('clip-build-progress', handleClipBuildProgress);
      await listen('clip-build-complete', handleClipBuildComplete);
      console.log('[MediaPanel] Tauri event listeners for clip build events set up successfully');
    } catch (error) {
      console.error('[MediaPanel] Failed to set up Tauri event listeners:', error);
    }
  });

  onUnmounted(() => {
    // Remove event listener to prevent memory leaks
    document.removeEventListener('refresh-clips', handleRefreshEvent as EventListener);

    // Note: Tauri event listeners are automatically cleaned up when the component is unmounted
    // so we don't need to manually remove them
    console.log('[MediaPanel] Component unmounted, event listeners cleaned up');
  });
</script>

<style scoped>
  @keyframes shine {
    0% {
      transform: translateX(-100%) skewX(-12deg);
    }
    100% {
      transform: translateX(200%) skewX(-12deg);
    }
  }

  .animate-shine {
    animation: shine 2s infinite;
  }

  /* Custom slider styling - matches app design */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  /* Webkit browsers (Chrome, Safari, Edge) */
  .slider::-webkit-slider-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-webkit-slider-thumb:active {
    transform: scale(1.1);
  }

  /* Firefox */
  .slider::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-moz-range-thumb:active {
    transform: scale(1.1);
  }

  /* Progress fill for Firefox */
  .slider::-moz-range-progress {
    background: hsl(var(--primary));
    height: 8px;
    border-radius: 4px 0 0 4px;
  }

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
