<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-t-2xl rounded-b-2xl w-full h-full border border-border shadow-2xl"
           style="margin: 30px; max-height: calc(100vh - 60px); max-width: calc(100vw - 60px);">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-[#0a0a0a]/50 backdrop-blur-sm rounded-t-xl">
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-medium text-foreground/90 truncate">{{ project?.name || 'New Project' }}</h2>
          </div>
          <button
            @click="close"
            class="p-1.5 hover:bg-[#ffffff]/10 rounded-md transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-foreground/70 hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Main Content Area -->
        <div class="flex flex-col h-full" style="height: calc(100% - 52px);">
          <!-- Top Row: Video Player, Transcript, and Clips -->
          <div class="flex flex-1 min-h-0 border-b border-border">
            <!-- Video Player Section -->
            <div class="w-1/2 min-w-0 p-4 border-r border-border flex flex-col">
              <!-- Video Player Container -->
              <div class="flex-1 min-h-0 rounded-lg bg-black relative overflow-hidden">
                <!-- Loading State -->
                <div v-if="videoLoading" class="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div class="flex flex-col items-center gap-3">
                    <svg class="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-white text-sm">Loading video...</span>
                  </div>
                </div>

                <!-- No Video State -->
                <div v-else-if="!videoSrc && !videoError" class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p class="text-sm">No video assigned</p>
                  </div>
                </div>

                <!-- Error State -->
                <div v-else-if="videoError" class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center text-red-400 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p class="text-sm font-medium">Video Error</p>
                    <p class="text-xs mt-1 text-red-300">{{ videoError }}</p>
                    <button
                      @click="loadVideoForProject"
                      class="mt-3 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-xs text-red-300 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>

                <!-- Video Element -->
                <video
                  v-else
                  ref="videoElement"
                  :src="videoSrc || undefined"
                  class="w-full h-full object-contain"
                  @timeupdate="onTimeUpdate"
                  @loadedmetadata="onLoadedMetadata"
                  @ended="onVideoEnded"
                  @click="togglePlayPause"
                  @error="onVideoError"
                  @loadstart="onLoadStart"
                  @canplay="onCanPlay"
                  @loadeddata="() => console.log('[ProjectWorkspaceDialog] Video loadeddata event')"
                  data-testid="project-video"
                />

                <!-- Center Play/Pause Overlay -->
                <button
                  v-if="videoSrc && !videoLoading"
                  @click="togglePlayPause"
                  class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
                  title="Play/Pause"
                >
                  <div class="p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
                    <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
                    </svg>
                  </div>
                </button>
              </div>

              <!-- Video Controls Bar -->
              <div v-if="videoSrc && !videoLoading" class="mt-3 bg-[#0a0a0a]/50 rounded-lg p-3 backdrop-blur-sm">
                <!-- Timeline/Seek Bar -->
                <div
                  class="relative h-1.5 cursor-pointer group mb-3"
                  @click="seekTo($event)"
                  @mousemove="onTimelineHover($event)"
                  @mouseleave="hoverTime = null"
                >
                  <!-- Background track -->
                  <div class="absolute inset-0 bg-gray-700 rounded-full"></div>

                  <!-- Buffered segments indicator -->
                  <div
                    class="absolute h-full bg-purple-400/30 rounded-full transition-all duration-300"
                    :style="{ width: `${duration ? (buffered / duration) * 100 : 0}%` }"
                  ></div>

                  <!-- Progress Bar -->
                  <div
                    class="absolute h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-100"
                    :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
                  ></div>

                  <!-- Seek thumb -->
                  <div
                    class="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 border border-purple-500"
                    :style="{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }"
                  ></div>

                  <!-- Hover time preview -->
                  <div
                    v-if="hoverTime !== null"
                    class="absolute -top-8 bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-medium"
                    :style="{ left: `${hoverPosition}%`, transform: 'translateX(-50%)' }"
                  >
                    {{ formatDuration(hoverTime) }}
                    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-black/90"></div>
                  </div>
                </div>

                <!-- Control Buttons and Time Display -->
                <div class="flex items-center justify-between">
                  <!-- Left Controls -->
                  <div class="flex items-center gap-2">
                    <!-- Play/Pause Button -->
                    <button
                      @click="togglePlayPause"
                      class="p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-all duration-200 backdrop-blur-sm"
                      title="Play/Pause"
                    >
                      <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
                      </svg>
                    </button>

                    <!-- Time Display -->
                    <div class="text-white text-xs font-mono font-medium bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
                      {{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}
                    </div>
                  </div>

                  <!-- Right Controls -->
                  <div class="flex items-center gap-2">
                    <!-- Volume Control -->
                    <div class="flex items-center gap-1.5">
                      <button
                        @click="toggleMute"
                        class="p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-all duration-200 backdrop-blur-sm"
                        title="Mute/Unmute"
                      >
                        <svg v-if="isMuted || volume === 0" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                      <div class="relative w-16 h-1 bg-gray-700 rounded-md">
                        <div
                          class="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-md transition-all duration-200"
                          :style="{ width: `${volume * 100}%` }"
                        ></div>
                        <input
                          v-model="volume"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                          @input="updateVolume"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Side: Transcript and Clips -->
            <div class="w-1/2 min-w-0 flex flex-col">
              <!-- Transcript Section -->
              <div :class="clipsCollapsed ? 'flex-1' : transcriptCollapsed ? 'h-auto' : 'flex-1'" class="p-4 border-b border-border flex flex-col">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-foreground">Transcript</h3>
                  <button
                    @click="toggleTranscript"
                    class="p-1 hover:bg-muted rounded transition-colors"
                    :title="transcriptCollapsed ? 'Expand transcript' : 'Collapse transcript'"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out" :class="{ 'rotate-180': transcriptCollapsed }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div v-if="!transcriptCollapsed" class="overflow-hidden">
                  <div ref="transcriptContent" class="text-muted-foreground text-sm space-y-2">
                    <div class="p-2 hover:bg-black/10 rounded cursor-pointer">
                      <span class="text-xs text-muted-foreground/60">00:00</span>
                      <p class="text-xs mt-1">Welcome to the project workspace...</p>
                    </div>
                    <div class="p-2 hover:bg-black/10 rounded cursor-pointer">
                      <span class="text-xs text-muted-foreground/60">00:05</span>
                      <p class="text-xs mt-1">This is where your transcript will appear...</p>
                    </div>
                    <div class="p-2 hover:bg-black/10 rounded cursor-pointer">
                      <span class="text-xs text-muted-foreground/60">00:10</span>
                      <p class="text-xs mt-1">Click on any text to jump to that timestamp...</p>
                    </div>
                  </div>
                  </div>
              </div>

              <!-- Generated Clips Section -->
              <div :class="transcriptCollapsed ? 'flex-1' : clipsCollapsed ? 'h-auto' : 'flex-1'" class="p-4 flex flex-col">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-foreground">Generated Clips</h3>
                  <button
                    @click="toggleClips"
                    class="p-1 hover:bg-muted rounded transition-colors"
                    :title="clipsCollapsed ? 'Expand clips' : 'Collapse clips'"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out" :class="{ 'rotate-180': clipsCollapsed }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div :class="clipsCollapsed ? 'h-0' : 'flex-1'" class="overflow-hidden">
                    <div v-if="!clipsCollapsed" class="h-full flex flex-col">
                      <div ref="clipsContent" class="flex-1 flex items-center justify-center min-h-[120px]">
                        <div class="text-center text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <p class="text-xs mb-4">No clips generated yet</p>
                          <button class="px-4 py-2 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all mx-auto text-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Generate Clips
                          </button>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Timeline -->
          <div class="h-36 bg-[#0a0a0a]/30 border-t border-border">
            <div class="p-4 h-full">
              <!-- Timeline Header -->
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-medium text-foreground">Timeline</h3>
                <div class="flex items-center gap-2">
                  <span v-if="videoSrc && duration > 0" class="text-xs text-muted-foreground">
                    {{ formatDuration(duration) }}
                  </span>
                  <button
                    @click="togglePlayPause"
                    :disabled="!videoSrc"
                    class="px-3 py-1 bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-foreground transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path v-if="!isPlaying" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {{ isPlaying ? 'Pause' : 'Play' }}
                  </button>
                </div>
              </div>

              <!-- Timeline Tracks -->
              <div class="bg-muted/20 rounded-lg h-20 relative overflow-hidden">
                <!-- Video Track -->
                <div class="h-full">
                  <div class="flex items-center h-full px-2">
                    <!-- Track Label -->
                    <div class="w-16 h-12 pr-2 flex items-center justify-center text-xs text-center text-muted-foreground/60 border-r border-border/70">Video</div>

                    <!-- Track Content -->
                    <div
                      class="flex-1 h-12 bg-[#0a0a0a]/50 rounded-md relative cursor-pointer group"
                      @click="seekTimeline($event)"
                      @mousemove="onTimelineTrackHover($event)"
                      @mouseleave="timelineHoverTime = null"
                    >
                      <!-- Video Track Background -->
                      <div v-if="!videoSrc" class="absolute inset-0 flex items-center justify-center">
                        <div class="text-center text-muted-foreground/40">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <p class="text-xs">No video</p>
                        </div>
                      </div>

                      <!-- Video Track Progress -->
                      <div v-else>
                        <!-- Full video duration background -->
                        <div class="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 rounded-md"></div>

                        <!-- Played progress -->
                        <div
                          class="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500/60 to-indigo-500/60 rounded-md transition-all duration-100"
                          :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
                        ></div>

                        <!-- Playhead -->
                        <div
                          class="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 transition-all duration-100"
                          :style="{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }"
                        >
                          <div class="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-full shadow-md"></div>
                        </div>

                        <!-- Hover time indicator -->
                        <div
                          v-if="timelineHoverTime !== null"
                          class="absolute top-0 transform -translate-x-1/2 z-20"
                          :style="{ left: `${timelineHoverPosition}%` }"
                        >
                          <div class="bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-medium mb-1">
                            {{ formatDuration(timelineHoverTime) }}
                            <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-black/90"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Custom range input styling */
input[type="range"].slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

input[type="range"].slider::-webkit-slider-track {
  background: transparent;
  height: 4px;
  border-radius: 2px;
}

input[type="range"].slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  background: white;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  margin-top: -4px;
}

input[type="range"].slider::-webkit-slider-thumb:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

input[type="range"].slider::-moz-range-track {
  background: transparent;
  height: 4px;
  border-radius: 2px;
}

input[type="range"].slider::-moz-range-thumb {
  border: none;
  background: white;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

input[type="range"].slider::-moz-range-thumb:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

/* Video player specific styles */
.video-container {
  position: relative;
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Play overlay animation */
.play-overlay {
  transition: opacity 0.2s ease;
}

.play-overlay:hover {
  opacity: 1 !important;
}

/* Timeline controls */
.timeline-controls {
  background: rgba(10, 10, 10, 0.5);
  backdrop-filter: blur(4px);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.timeline-seek-bar {
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeline-seek-bar:hover .seek-thumb {
  opacity: 1;
}

.seek-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: all 0.2s ease;
  transform: translate(-50%, -50%);
  border: 2px solid rgb(147, 51, 234);
}

/* Timeline track */
.timeline-track {
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeline-track:hover {
  background: rgba(0, 0, 0, 0.7);
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: white;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  transition: left 0.1s ease;
  z-index: 10;
}

.playhead::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -6px;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Video track styling */
.video-track {
  background: linear-gradient(to right, rgba(147, 51, 234, 0.3), rgba(99, 102, 241, 0.3));
  border-radius: 0.375rem;
  position: relative;
  overflow: hidden;
}

.video-track-progress {
  background: linear-gradient(to right, rgba(147, 51, 234, 0.6), rgba(99, 102, 241, 0.6));
  transition: width 0.1s ease;
}

/* Control buttons */
.control-button {
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.control-button:hover {
  transform: scale(1.05);
}

.control-button:active {
  transform: scale(0.95);
}

/* Loading spinner */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Hover time preview */
.hover-preview {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  z-index: 20;
  pointer-events: none;
}

.hover-preview::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%) translateY(50%) rotate(45deg);
  width: 6px;
  height: 6px;
  background: rgba(0, 0, 0, 0.9);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .timeline-controls {
    padding: 0.5rem;
  }

  .control-button {
    padding: 0.375rem;
  }

  .time-display {
    font-size: 0.625rem;
    padding: 0.25rem 0.5rem;
  }
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

.transition-opacity {
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Ensure proper z-index layering */
.z-10 {
  z-index: 10;
}

.z-20 {
  z-index: 20;
}

/* Backdrop blur effects */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

.backdrop-blur-md {
  backdrop-filter: blur(8px);
}

/* Custom scrollbar for timeline */
.timeline-track::-webkit-scrollbar {
  height: 4px;
}

.timeline-track::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.timeline-track::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.timeline-track::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { type Project, getAllRawVideos, type RawVideo } from '@/services/database'
import { invoke } from '@tauri-apps/api/core'

console.log('[ProjectWorkspaceDialog] Script setup running')

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

console.log('[ProjectWorkspaceDialog] Props defined:', props.modelValue, props.project?.name)

// Initialize reactive state
const transcriptCollapsed = ref(false)
const clipsCollapsed = ref(false)

// Template refs for content measurement
const transcriptContent = ref<HTMLElement>()
const clipsContent = ref<HTMLElement>()

// Video player state
const videoElement = ref<HTMLVideoElement | null>(null)
const videoSrc = ref<string | null>(null)
const videoLoading = ref(false)
const videoError = ref<string | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const buffered = ref(0)
const hoverTime = ref<number | null>(null)
const hoverPosition = ref(0)
const timelineHoverTime = ref<number | null>(null)
const timelineHoverPosition = ref(0)

// Video data
const availableVideos = ref<RawVideo[]>([])
const currentVideo = ref<RawVideo | null>(null)

// Debug: Log state changes
watch([videoLoading, videoSrc, videoElement], () => {
  console.log('[ProjectWorkspaceDialog] State update:', {
    loading: videoLoading.value,
    src: videoSrc.value?.substring(0, 50) + '...',
    element: !!videoElement.value
  })
}, { immediate: true })

function close() {
  emit('update:modelValue', false)
}

function toggleTranscript() {
  transcriptCollapsed.value = !transcriptCollapsed.value

  // If we're collapsing transcript, auto-expand clips
  if (transcriptCollapsed.value) {
    clipsCollapsed.value = false
  }
}

function toggleClips() {
  clipsCollapsed.value = !clipsCollapsed.value

  // If we're collapsing clips, auto-expand transcript
  if (clipsCollapsed.value) {
    transcriptCollapsed.value = false
  }
}

// Video player functions
function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'

  if (seconds < 60) {
    return `0:${Math.round(seconds).toString().padStart(2, '0')}`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

function togglePlayPause() {
  if (!videoElement.value) return

  if (videoElement.value.paused) {
    videoElement.value.play()
    isPlaying.value = true
  } else {
    videoElement.value.pause()
    isPlaying.value = false
  }
}

function seekTo(event: MouseEvent) {
  if (!videoElement.value) return

  const timeline = event.currentTarget as HTMLElement
  const rect = timeline.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width))

  const videoDuration = videoElement.value.duration || duration.value
  if (!videoDuration || isNaN(videoDuration)) return

  const seekTime = clickPercent * videoDuration
  videoElement.value.currentTime = seekTime
  currentTime.value = seekTime
}

function seekTimeline(event: MouseEvent) {
  if (!videoElement.value || !videoSrc.value) return

  const timeline = event.currentTarget as HTMLElement
  const rect = timeline.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width))

  const videoDuration = videoElement.value.duration || duration.value
  if (!videoDuration || isNaN(videoDuration)) return

  const seekTime = clickPercent * videoDuration
  videoElement.value.currentTime = seekTime
  currentTime.value = seekTime
}

function onTimelineHover(event: MouseEvent) {
  if (!videoElement.value) return

  const timeline = event.currentTarget as HTMLElement
  const rect = timeline.getBoundingClientRect()
  const hoverX = event.clientX - rect.left
  const hoverPercent = Math.max(0, Math.min(1, hoverX / rect.width))

  const videoDuration = videoElement.value.duration || duration.value
  if (!videoDuration || isNaN(videoDuration)) return

  const hoverTimeSeconds = hoverPercent * videoDuration
  hoverPosition.value = hoverPercent * 100
  hoverTime.value = hoverTimeSeconds
}

function onTimelineTrackHover(event: MouseEvent) {
  if (!videoElement.value || !videoSrc.value) return

  const timeline = event.currentTarget as HTMLElement
  const rect = timeline.getBoundingClientRect()
  const hoverX = event.clientX - rect.left
  const hoverPercent = Math.max(0, Math.min(1, hoverX / rect.width))

  const videoDuration = videoElement.value.duration || duration.value
  if (!videoDuration || isNaN(videoDuration)) return

  const hoverTimeSeconds = hoverPercent * videoDuration
  timelineHoverPosition.value = hoverPercent * 100
  timelineHoverTime.value = hoverTimeSeconds
}

function updateVolume() {
  if (!videoElement.value) return

  videoElement.value.volume = volume.value
  if (volume.value === 0) {
    isMuted.value = true
  } else if (isMuted.value) {
    isMuted.value = false
  }
}

function toggleMute() {
  if (!videoElement.value) return

  if (isMuted.value) {
    videoElement.value.muted = false
    isMuted.value = false
    volume.value = 1
  } else {
    videoElement.value.muted = true
    isMuted.value = true
    volume.value = 0
  }
}

function onTimeUpdate() {
  if (!videoElement.value) return

  currentTime.value = videoElement.value.currentTime

  const currentDuration = videoElement.value.duration
  if (currentDuration && currentDuration !== duration.value && !isNaN(currentDuration)) {
    duration.value = currentDuration
  }

  if (videoElement.value.buffered.length > 0) {
    buffered.value = videoElement.value.buffered.end(videoElement.value.buffered.length - 1)
  }
}

function onLoadedMetadata() {
  console.log('[ProjectWorkspaceDialog] Video loadedmetadata event')
  if (!videoElement.value) {
    console.log('[ProjectWorkspaceDialog] Video element not found in loadedmetadata')
    return
  }

  videoLoading.value = false
  duration.value = videoElement.value.duration
  console.log('[ProjectWorkspaceDialog] Video duration:', duration.value)

  videoElement.value.volume = volume.value
  videoElement.value.muted = isMuted.value
}

function onVideoEnded() {
  isPlaying.value = false
  currentTime.value = 0
}

function onLoadStart() {
  console.log('[ProjectWorkspaceDialog] Video loadstart event - video started loading')
  videoError.value = null
  // Don't set loading to true here since we want the video to be visible while loading
}

function onCanPlay() {
  console.log('[ProjectWorkspaceDialog] Video canplay event')
  videoLoading.value = false
}

function onVideoError(event: Event) {
  console.log('[ProjectWorkspaceDialog] Video error event:', event)
  videoLoading.value = false
  videoError.value = 'Failed to load video. The file may be corrupted or in an unsupported format.'
  console.error('Video error:', event)
  videoSrc.value = null
}

// Video loading functions
async function loadVideos() {
  try {
    availableVideos.value = await getAllRawVideos()
  } catch (error) {
    console.error('Failed to load videos:', error)
  }
}

async function loadVideoForProject() {
  console.log('[ProjectWorkspaceDialog] Loading video for project:', props.project?.name)

  if (!props.project) {
    console.log('[ProjectWorkspaceDialog] No project, clearing video')
    videoSrc.value = null
    currentVideo.value = null
    videoError.value = null
    videoLoading.value = false
    return
  }

  videoError.value = null
  currentTime.value = 0
  duration.value = 0
  isPlaying.value = false

  try {
    let videoPath: string | null = null

    // First try to get video from project.raw_video_path
    const project = props.project
    console.log('[ProjectWorkspaceDialog] Project raw_video_path:', project.raw_video_path)
    console.log('[ProjectWorkspaceDialog] Available videos:', availableVideos.value.length)

    if (project?.raw_video_path) {
      videoPath = project.raw_video_path
      currentVideo.value = availableVideos.value.find(v => v.file_path === project.raw_video_path) || null
      console.log('[ProjectWorkspaceDialog] Found video via raw_video_path:', videoPath)
    }

    // If no video found via raw_video_path, try to find first video associated with this project
    if (!videoPath && project?.id) {
      const projectVideo = availableVideos.value.find(v => v.project_id === project.id)
      if (projectVideo) {
        videoPath = projectVideo.file_path
        currentVideo.value = projectVideo
        console.log('[ProjectWorkspaceDialog] Found video via project_id:', videoPath)
      }
    }

    if (!videoPath) {
      console.log('[ProjectWorkspaceDialog] No video found for project')
      videoSrc.value = null
      videoLoading.value = false
      return
    }

    console.log('[ProjectWorkspaceDialog] Loading video from path:', videoPath)

    // Get video server port and create video URL
    const port = await invoke<number>('get_video_server_port')
    const encodedPath = btoa(videoPath)
    videoSrc.value = `http://localhost:${port}/video/${encodedPath}`

    console.log('[ProjectWorkspaceDialog] Video URL created:', videoSrc.value)

    // Set loading to false AFTER setting videoSrc to allow the video element to render
    videoLoading.value = false
    console.log('[ProjectWorkspaceDialog] Loading state set to false, video element should render now')

    // The video element loading will be handled by the videoSrc watcher

  } catch (error) {
    console.error('[ProjectWorkspaceDialog] Failed to load video for project:', error)
    videoError.value = 'Failed to connect to video server. Please try again.'
    videoSrc.value = null
    videoLoading.value = false
  }
}

// Watch for project changes
watch(() => props.project, () => {
  loadVideoForProject()
}, { immediate: true })

// Watch for video element to become available
watch(videoElement, (newElement) => {
  if (newElement && videoSrc.value && videoLoading.value) {
    console.log('[ProjectWorkspaceDialog] Video element became available, loading video')
    newElement.load()
  }
})

// Watch for videoSrc changes to reload video
watch(videoSrc, async (newSrc) => {
  console.log('[ProjectWorkspaceDialog] Video source changed:', !!newSrc)
  if (newSrc) {
    console.log('[ProjectWorkspaceDialog] New video source, waiting for element...')
    // Wait for DOM to update with the new video element
    await nextTick()
    await nextTick()

    console.log('[ProjectWorkspaceDialog] Video element after nextTick:', !!videoElement.value)
    if (videoElement.value) {
      console.log('[ProjectWorkspaceDialog] Loading video with new source')
      videoElement.value.load()
    } else {
      console.log('[ProjectWorkspaceDialog] Video element still not found, setting up a retry')
      // Set up a retry mechanism
      let retries = 0
      const checkInterval = setInterval(() => {
        retries++
        console.log(`[ProjectWorkspaceDialog] Retry ${retries}: Element found:`, !!videoElement.value)
        if (videoElement.value) {
          console.log('[ProjectWorkspaceDialog] Video element found via retry, loading video')
          videoElement.value.load()
          clearInterval(checkInterval)
        } else if (retries >= 10) {
          console.log('[ProjectWorkspaceDialog] Max retries reached, giving up')
          clearInterval(checkInterval)
          videoError.value = 'Failed to initialize video player. Please refresh and try again.'
          videoLoading.value = false
        }
      }, 50)
    }
  }
})

// Watch for dialog open/close
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    await loadVideos()
    await loadVideoForProject()
  } else {
    // Reset video state when dialog closes
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.currentTime = 0
    }
    videoSrc.value = null
    currentVideo.value = null
    videoError.value = null
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    videoLoading.value = false
    hoverTime.value = null
    hoverPosition.value = 0
    timelineHoverTime.value = null
    timelineHoverPosition.value = 0
  }
})

// Check if video element is available when component mounts
onMounted(() => {
  console.log('[ProjectWorkspaceDialog] Component mounted')
  console.log('[ProjectWorkspaceDialog] Video element ref on mount:', videoElement.value)

  // If we have a video source but element is not immediately available, wait a bit and check again
  if (videoSrc.value && !videoElement.value) {
    setTimeout(() => {
      console.log('[ProjectWorkspaceDialog] Video element ref after timeout:', videoElement.value)
      if (videoElement.value) {
        console.log('[ProjectWorkspaceDialog] Loading video after timeout')
        videoElement.value.load()
      }
    }, 100)
  }
})

</script>