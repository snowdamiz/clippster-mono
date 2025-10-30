<template>
  <div class="videos-page">
    <PageLayout
    title="Raw Videos"
    description="Browse and manage your raw video files"
    :show-header="!loading && videos.length > 0"
    icon="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <button
          @click="openVideosFolder"
          title="Open videos folder"
          class="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        <button
          @click="handleUpload"
          :disabled="uploading"
          class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {{ uploading ? 'Uploading...' : 'Upload Video' }}
        </button>
      </div>
    </template>

    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading videos..." />

    <!-- Content when not loading -->
    <div v-else>
        <!-- Header with stats -->
        <div v-if="videos.length > 0 || uploading || activeDownloads.length > 0" class="flex items-center justify-between mb-4">
          <p class="text-sm text-muted-foreground">
            <span v-if="activeDownloads.length > 0">
              {{ activeDownloads.length }} download{{ activeDownloads.length !== 1 ? 's' : '' }} in progress
              <span v-if="videos.length > 0">• {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}</span>
            </span>
            <span v-else-if="videos.length > 0">
              {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}
            </span>
          </p>
        </div>

        <!-- Videos Grid -->
        <div v-if="videos.length > 0 || uploading || activeDownloads.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <!-- Skeleton loader card for uploading -->
      <div v-if="uploading" class="relative bg-card border border-border rounded-lg overflow-hidden animate-pulse">
        <!-- Thumbnail skeleton -->
        <div class="aspect-video bg-muted/50 relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <svg class="animate-spin h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm text-muted-foreground">Uploading...</span>
            </div>
          </div>
        </div>
        <!-- Info skeleton -->
        <div class="p-4">
          <div class="h-5 bg-muted/50 rounded mb-2 w-3/4"></div>
          <div class="h-3 bg-muted/50 rounded mb-2 w-1/2"></div>
          <div class="h-3 bg-muted/50 rounded w-2/3"></div>
        </div>
      </div>

      <!-- Active download cards -->
      <div v-for="download in activeDownloads" :key="download.id" class="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20">
        <!-- Thumbnail with progress overlay -->
        <div class="aspect-video bg-muted/50 relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <svg class="animate-spin h-8 w-8 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span v-if="download.progress.current_time && download.progress.total_time" class="text-xs text-muted-foreground">
                {{ formatDuration(download.progress.current_time) }} / {{ formatDuration(download.progress.total_time) }}
              </span>
            </div>
          </div>

          <!-- Progress bar at bottom of thumbnail -->
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
              :style="{ width: `${download.progress.progress}%` }"
            ></div>
          </div>

          <!-- Hover overlay -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div class="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-white mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="text-white text-sm font-medium">Downloading...</p>
              <p class="text-white/80 text-xs">{{ Math.round(download.progress.progress) }}% complete</p>
            </div>
          </div>
        </div>

        <!-- Download info -->
        <div class="p-4">
          <h4 class="font-semibold text-foreground truncate mb-1">{{ download.title }}</h4>
          <div class="flex items-center justify-between">
            <p class="text-xs text-muted-foreground">PumpFun Stream</p>
            <p class="text-xs text-purple-400 font-medium">{{ Math.round(download.progress.progress) }}%</p>
          </div>
        </div>
      </div>

      <!-- Existing video cards -->
      <div v-for="video in paginatedVideos" :key="video.id" class="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 cursor-pointer">
        <!-- Thumbnail with vignette background -->
        <div class="aspect-video bg-muted/50 relative">
          <!-- Thumbnail background with vignette -->
          <div
            v-if="getThumbnailUrl(video)"
            class="absolute inset-0 z-0"
            :style="{
              backgroundImage: `url(${getThumbnailUrl(video)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }"
          >
            <!-- Dark vignette overlay -->
            <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/80"></div>
          </div>

          <!-- Content overlay -->
          <div class="relative z-10 h-full flex flex-col">
            <!-- Duration overlay -->
            <div
              v-if="video.duration"
              class="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm"
            >
              {{ formatDuration(video.duration) }}
            </div>

            <!-- Center placeholder if no thumbnail -->
            <div v-if="!getThumbnailUrl(video)" class="flex-1 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>

            <!-- Hover Overlay -->
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
              <button class="p-2.5 bg-white/90 hover:bg-white rounded-lg transition-colors" title="Play" @click.stop="playVideo(video)">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button class="p-2.5 bg-white/90 hover:bg-white rounded-lg transition-colors" title="Delete" @click.stop="confirmDelete(video)">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <!-- Info -->
        <div :class="[
          'p-4 border-t',
          getThumbnailUrl(video)
            ? 'border-white/10 bg-black/20 backdrop-blur-sm'
            : 'border-border bg-card'
        ]">
          <h4 :class="[
            'font-semibold truncate mb-2',
            getThumbnailUrl(video)
              ? 'text-white'
              : 'text-foreground'
          ]">{{ video.original_filename || video.file_path.split(/[\\\/]/).pop() || 'Untitled Video' }}</h4>
          <p :class="[
            'text-xs',
            getThumbnailUrl(video)
              ? 'text-white/80'
              : 'text-muted-foreground'
          ]">Added {{ getRelativeTime(video.created_at) }}</p>
        </div>
      </div>
    </div>

  
        <!-- Empty State -->
        <EmptyState
          v-if="videos.length === 0 && !uploading && activeDownloads.length === 0"
          title="No videos yet"
          description="Upload your first raw video or download directly from Pump.fun to get started"
          button-text="Upload Video"
          @action="handleUpload"
        >
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
      </template>
    </EmptyState>
      </div> <!-- Close content when not loading -->
  </PageLayout>

  <!-- Video Player Dialog -->
    <div
      v-if="showVideoPlayer"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showVideoPlayer = false"
    >
      <div class="bg-card rounded-2xl max-w-6xl max-h-[calc(100vh-80px)] w-full mx-4 border border-border overflow-hidden">
        <!-- Custom Video Player -->
        <div v-if="videoSrc" class="relative w-full h-full flex flex-col">
          <!-- Video Title Header -->
          <div class="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-6 pt-8">
            <h3 class="text-white text-lg font-semibold truncate pr-12">
              {{ videoToPlay?.original_filename || videoToPlay?.file_path.split(/[\\\/]/).pop() || 'Untitled Video' }}
            </h3>
          </div>

          <!-- Close Button (Top Right) -->
          <button
            @click="showVideoPlayer = false"
            class="absolute top-6 right-6 z-30 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <!-- Video Display (16:9 Aspect Ratio) -->
          <div class="relative flex-1 flex items-center justify-center bg-black aspect-video">
            <video
              ref="videoElement"
              :src="videoSrc"
              class="w-full h-full object-contain"
              @timeupdate="onTimeUpdate"
              @loadedmetadata="onLoadedMetadata"
              @ended="onVideoEnded"
            />

            <!-- Loading Indicator -->
            <div v-if="isVideoLoading" class="absolute inset-0 flex items-center justify-center bg-black/50">
              <div class="flex flex-col items-center gap-3">
                <svg class="animate-spin h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-white text-sm">Loading video...</span>
              </div>
            </div>

            <!-- Center Play/Pause Overlay -->
            <button
              v-if="!isVideoLoading"
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

          <!-- Custom Video Controls -->
          <div class="bg-gradient-to-t from-black/80 to-black/60 backdrop-blur-md border-t border-border">
            <!-- Timeline/Seek Bar -->
            <div
              class="relative h-2 cursor-pointer group mx-4 mt-4"
              @click="seekTo($event)"
              @mousemove="onTimelineHover($event)"
              @mouseleave="hoverTime = null"
            >
              <!-- Background track (darker gray) -->
              <div class="absolute inset-0 bg-gray-800 rounded-full"></div>

              <!-- Buffered segments indicator -->
              <div
                class="absolute h-full bg-purple-400/30 rounded-full transition-all duration-300"
                :style="{ width: `${duration ? (buffered / duration) * 100 : 0}%` }"
              ></div>

              <!-- Progress Bar (purple for played section) -->
              <div
                class="absolute h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-100"
                :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
              ></div>

              <!-- Seek thumb (fixed positioning) -->
              <div
                class="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 border-purple-500"
                :style="{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }"
              ></div>

              <!-- Hover time preview -->
              <div
                v-if="hoverTime !== null"
                class="absolute -top-10 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg font-medium"
                :style="{ left: `${hoverPosition}%`, transform: 'translateX(-50%)' }"
              >
                {{ formatDuration(hoverTime) }}
                <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-black/90"></div>
              </div>
            </div>

            <!-- Control Buttons and Time Display -->
            <div class="flex items-center justify-between p-4 pb-6">
              <!-- Left Controls -->
              <div class="flex items-center gap-3">
                <!-- Play/Pause Button (matching height with other controls) -->
                <button
                  @click="togglePlayPause"
                  class="px-1.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
                  title="Play/Pause"
                >
                  <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
                  </svg>
                </button>

                <!-- Time Display -->
                <div class="text-white text-sm font-mono font-medium bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
                  {{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}
                </div>
              </div>

              <!-- Right Controls -->
              <div class="flex items-center gap-4">
                <!-- Volume Control -->
                <div class="flex items-center gap-3">
                  <button
                    @click="toggleMute"
                    class="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    title="Mute/Unmute"
                  >
                    <svg v-if="isMuted || volume === 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white pt-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                  <div class="relative w-24 h-1.5 bg-gray-800 rounded-lg">
                    <div
                      class="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg transition-all duration-200"
                      :style="{ width: `${volume * 100}%` }"
                    ></div>
                    <input
                      v-model="volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      class="absolute inset-0 w-full h-full cursor-pointer slider z-10 mt-0.5"
                      @input="updateVolume"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete Video</h2>
        
        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete "<span class="font-semibold text-foreground">{{ videoToDelete?.original_filename || videoToDelete?.file_path.split(/[\\\\/]/).pop() }}</span>"? This action cannot be undone.
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deleteVideoConfirmed"
          >
            Delete
          </button>

          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
            @click="showDeleteDialog = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

  <!-- Fixed Pagination Footer (styled like breadcrumbs header) -->
  <footer
    v-if="!loading && videos.length > 0 && totalPages > 1"
    class="fixed bottom-0 left-64 right-0 h-16 px-8 flex items-center justify-between border-t border-border/40 bg-background/95 backdrop-blur-sm z-10"
  >
    <!-- Page info -->
    <div class="text-sm text-muted-foreground">
      <span v-if="videos.length > 0">
        {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }} •
        Page {{ currentPage }} of {{ totalPages }}
      </span>
    </div>

    <!-- Pagination Controls -->
    <div class="flex items-center gap-2 rounded-md p-0.5">
      <!-- Previous Button -->
      <button
        @click="previousPage"
        :disabled="currentPage === 1"
        class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all text-sm"
        title="Previous page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Previous
      </button>

      <!-- Page Numbers -->
      <div class="flex items-center gap-1">
        <!-- Generate page numbers with smart ellipsis -->
        <template v-for="page in totalPages" :key="page">
          <!-- Show first page -->
          <button
            v-if="page === 1"
            @click="goToPage(page)"
            :class="[
              'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
              currentPage === page
                ? 'text-purple-500'
                : 'hover:bg-muted/80 text-foreground'
            ]"
          >
            {{ page }}
          </button>

          <!-- Show ellipsis before current page range -->
          <span v-else-if="page === currentPage - 2 && page > 2" class="px-1.5 text-muted-foreground text-sm">...</span>

          <!-- Show pages around current -->
          <button
            v-else-if="page >= currentPage - 1 && page <= currentPage + 1"
            @click="goToPage(page)"
            :class="[
              'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
              currentPage === page
                ? 'text-purple-500'
                : 'hover:bg-muted/80 text-foreground'
            ]"
          >
            {{ page }}
          </button>

          <!-- Show ellipsis after current page range -->
          <span v-else-if="page === currentPage + 2 && page < totalPages - 1" class="px-1.5 text-muted-foreground text-sm">...</span>

          <!-- Show last page -->
          <button
            v-else-if="page === totalPages && totalPages > 1"
            @click="goToPage(page)"
            :class="[
              'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
              currentPage === page
                ? 'bg-purple-500 text-white'
                : 'hover:bg-muted/80 text-foreground'
            ]"
          >
            {{ page }}
          </button>
        </template>
      </div>

      <!-- Next Button -->
      <button
        @click="nextPage"
        :disabled="currentPage === totalPages"
        class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all text-sm"
        title="Next page"
      >
        Next
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getAllRawVideos, createRawVideo, deleteRawVideo, getDatabase, type RawVideo } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import { useToast } from '@/composables/useToast'
import { useDownloads } from '@/composables/useDownloads'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { getStoragePath } from '@/services/storage'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'

const videos = ref<RawVideo[]>([])
const loading = ref(true)
const uploading = ref(false)
const showDeleteDialog = ref(false)
const videoToDelete = ref<RawVideo | null>(null)
const showVideoPlayer = ref(false)
const videoToPlay = ref<RawVideo | null>(null)
const videoSrc = ref<string | null>(null)
const thumbnailCache = ref<Map<string, string>>(new Map())
const { getRelativeTime } = useFormatters()
const { success, error } = useToast()

// Pagination state
const currentPage = ref(1)
const videosPerPage = 20

// Video player state
const videoElement = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isVideoLoading = ref(true)
const buffered = ref(0)
const hoverTime = ref<number | null>(null)
const hoverPosition = ref(0)

// Helper function to format duration in seconds to human readable format
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

// Video player methods
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
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width)) // Clamp between 0 and 1

  // Use the video's duration if available, otherwise wait for metadata to load
  const videoDuration = videoElement.value.duration || duration.value
  if (!videoDuration || isNaN(videoDuration)) return

  const seekTime = clickPercent * videoDuration

  // Set the current time on the video element directly
  videoElement.value.currentTime = seekTime

  // Update reactive state
  currentTime.value = seekTime

  // If video was paused and we seek to a new position, we should show a preview
  // but don't auto-play unless the user explicitly clicks play
  console.log(`Seeking to ${seekTime}s (${Math.round(clickPercent * 100)}%)`)
}

function onTimelineHover(event: MouseEvent) {
  if (!videoElement.value) return

  const timeline = event.currentTarget as HTMLElement
  const rect = timeline.getBoundingClientRect()
  const hoverX = event.clientX - rect.left
  const hoverPercent = Math.max(0, Math.min(1, hoverX / rect.width)) // Clamp between 0 and 1

  // Use the video's actual duration if available
  const videoDuration = videoElement.value.duration || duration.value
  if (!videoDuration || isNaN(videoDuration)) return

  const hoverTimeSeconds = hoverPercent * videoDuration

  hoverPosition.value = hoverPercent * 100
  hoverTime.value = hoverTimeSeconds
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

  // Update duration if it changes (some videos report different durations)
  const currentDuration = videoElement.value.duration
  if (currentDuration && currentDuration !== duration.value && !isNaN(currentDuration)) {
    duration.value = currentDuration
  }

  // Update buffered time
  if (videoElement.value.buffered.length > 0) {
    buffered.value = videoElement.value.buffered.end(videoElement.value.buffered.length - 1)
  }
}

function onLoadedMetadata() {
  if (!videoElement.value) return

  isVideoLoading.value = false
  duration.value = videoElement.value.duration

  // Set initial volume
  videoElement.value.volume = volume.value
  videoElement.value.muted = isMuted.value

  // Auto-play
  videoElement.value.play()
  isPlaying.value = true
}

function onVideoEnded() {
  isPlaying.value = false
  currentTime.value = 0
}

// Watch for dialog close to properly reset video state
watch(showVideoPlayer, (newVal) => {
  if (!newVal) {
    // Dialog is closing, reset video
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.currentTime = 0
    }
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    isVideoLoading.value = true
    hoverTime.value = null
    hoverPosition.value = 0
    videoSrc.value = null
    videoToPlay.value = null
  }
})

// Downloads setup
const {
  initialize: initializeDownloads,
  getActiveDownloads,
  cleanupOldDownloads,
  getAllDownloads,
  onDownloadComplete
} = useDownloads()

const activeDownloads = computed(() => getActiveDownloads())

// Pagination computed properties
const totalPages = computed(() => Math.ceil(videos.value.length / videosPerPage))
const paginatedVideos = computed(() => {
  const startIndex = (currentPage.value - 1) * videosPerPage
  const endIndex = startIndex + videosPerPage
  const paginated = videos.value.slice(startIndex, endIndex)
  console.log(`[Videos] Page ${currentPage.value}: Showing ${paginated.length} of ${videos.value.length} videos`)
  return paginated
})

// Pagination functions
function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// Reset to first page when videos change
watch(videos, () => {
  currentPage.value = 1
})

let cleanupInterval: ReturnType<typeof setInterval> | null = null
let unregisterDownloadCallback: (() => void) | null = null

async function loadVideos() {
  loading.value = true
  try {
    videos.value = await getAllRawVideos()
    console.log(`[Videos] Loaded ${videos.value.length} videos`)

    // Debug: Check database directly
    const db = await getDatabase()
    try {
      const allTables = await db.select<any[]>("SELECT name FROM sqlite_master WHERE type='table'")
      console.log(`[Videos] Database tables:`, allTables.map(t => t.name))

      const rawVideosCount = await db.select<any[]>("SELECT COUNT(*) as count FROM raw_videos")
      console.log(`[Videos] Raw videos count:`, rawVideosCount[0].count)

      if (rawVideosCount[0].count > 0) {
        const sampleVideos = await db.select<any[]>("SELECT id, file_path, project_id, original_filename FROM raw_videos LIMIT 5")
        console.log(`[Videos] Sample videos:`, sampleVideos)
      }
    } catch (dbError) {
      console.error('[Videos] Database debug error:', dbError)
    }

    // Reset pagination to first page when loading new videos
    currentPage.value = 1
    // Load thumbnails
    for (const video of videos.value) {
      if (video.thumbnail_path && !thumbnailCache.value.has(video.id)) {
        try {
          const dataUrl = await invoke<string>('read_file_as_data_url', {
            filePath: video.thumbnail_path
          })
          thumbnailCache.value.set(video.id, dataUrl)
        } catch (error) {
          console.warn('Failed to load thumbnail for video:', video.id, error)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load videos:', error)
  } finally {
    loading.value = false
  }
}

// Handle download completion - immediately refresh the videos list
function handleDownloadComplete(download: any) {
  console.log('[Videos] Download completed:', download.title)

  // Immediately refresh the videos list to show the newly completed download
  loadVideos()

  // Show a success notification if available
  if (download.result?.success && download.rawVideoId) {
    success('Download Complete', `"${download.title}" has been downloaded and added to your videos`)
  }
}

function getThumbnailUrl(video: RawVideo): string | null {
  return thumbnailCache.value.get(video.id) || null
}

async function handleUpload() {
  if (uploading.value) return
  
  try {
    // Open file dialog with video file filters
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video',
        extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']
      }]
    })
    
    if (!selected) return // User cancelled
    
    uploading.value = true
    
    // Copy video to storage directory
    const result = await invoke<{ destination_path: string; original_filename: string }>('copy_video_to_storage', {
      sourcePath: selected
    })
    
    // Generate thumbnail
    let thumbnailPath: string | undefined
    try {
      thumbnailPath = await invoke<string>('generate_thumbnail', {
        videoPath: result.destination_path
      })
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error)
    }
    
    // Create raw_videos record with original filename and thumbnail
    await createRawVideo(result.destination_path, {
      originalFilename: result.original_filename,
      thumbnailPath
    })
    
    // Show success toast
    success('Video uploaded', `"${result.original_filename}" has been uploaded successfully`)
    
    // Reload videos list
    await loadVideos()
  } catch (err) {
    console.error('Failed to upload video:', err)
    error('Upload failed', `Failed to upload video: ${err}`)
  } finally {
    uploading.value = false
  }
}

async function playVideo(video: RawVideo) {
  try {
    // Reset video player state
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    isVideoLoading.value = true
    hoverTime.value = null
    hoverPosition.value = 0

    videoToPlay.value = video
    // Get video server port
    const port = await invoke<number>('get_video_server_port')
    // Encode file path as base64 for URL
    const encodedPath = btoa(video.file_path)
    videoSrc.value = `http://localhost:${port}/video/${encodedPath}`
    showVideoPlayer.value = true
  } catch (err) {
    console.error('Failed to prepare video:', err)
    error('Playback failed', 'Unable to load the video for playback')
  }
}

function confirmDelete(video: RawVideo) {
  videoToDelete.value = video
  showDeleteDialog.value = true
}

async function deleteVideoConfirmed() {
  if (!videoToDelete.value) return
  
  const deletedVideoName = videoToDelete.value.original_filename || videoToDelete.value.file_path.split(/[\\\/]/).pop() || 'Video'
  
  try {
    // Delete the video file and thumbnail from the filesystem first
    await invoke('delete_video_file', {
      filePath: videoToDelete.value.file_path,
      thumbnailPath: videoToDelete.value.thumbnail_path || undefined
    })
    
    // Then delete from database
    await deleteRawVideo(videoToDelete.value.id)
    
    // Remove from thumbnail cache if exists
    if (videoToDelete.value.id && thumbnailCache.value.has(videoToDelete.value.id)) {
      thumbnailCache.value.delete(videoToDelete.value.id)
    }
    
    // Show success toast
    success('Video deleted', `"${deletedVideoName}" has been deleted successfully`)
    
    await loadVideos()
  } catch (err) {
    console.error('Failed to delete video:', err)
    error('Delete failed', `Failed to delete video: ${err}`)
  } finally {
    showDeleteDialog.value = false
    videoToDelete.value = null
  }
}

async function openVideosFolder() {
  try {
    const videosPath = await getStoragePath('videos')
    // Use the first video file if available, otherwise use a dummy path
    if (videos.value.length > 0) {
      // Reveal the first video file, which will open the videos folder
      await revealItemInDir(videos.value[0].file_path)
    } else {
      // If no videos, append a dummy filename to open the videos folder
      // The file doesn't need to exist, revealItemInDir will still open the parent folder
      await revealItemInDir(videosPath + '\\dummy.mp4')
    }
  } catch (err) {
    console.error('Failed to open videos folder:', err)
    error('Failed to open folder', 'Unable to open the videos folder')
  }
}

onMounted(async () => {
  // Initialize downloads system
  await initializeDownloads()

  // Register for download completion events for immediate updates
  unregisterDownloadCallback = onDownloadComplete(handleDownloadComplete)

  // Check for any completed downloads that might have been missed
  // This handles cases where the user navigates to the page after downloads completed
  const allDownloads = getAllDownloads()
  const completedDownloads = allDownloads.filter(d =>
    d.result?.success && d.rawVideoId
  )

  // Load videos (will show existing videos + any recently completed downloads)
  await loadVideos()

  // If there were completed downloads that might not be in the videos list yet,
  // we'll handle it through the normal loadVideos() process
  console.log(`[Videos] Found ${completedDownloads.length} completed downloads on mount`)

  // Set up periodic cleanup (no longer need to check for completed downloads)
  cleanupInterval = setInterval(() => {
    cleanupOldDownloads()
  }, 2000) // Cleanup every 2 seconds
})

onUnmounted(() => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
  }
  if (unregisterDownloadCallback) {
    unregisterDownloadCallback()
  }
})
</script>

<style scoped>
/* Root wrapper to ensure single root element for Transition */
.videos-page {
  position: relative;
  width: 100%;
  min-height: 100%;
}

/* Custom range input styling */
input[type="range"].slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

input[type="range"].slider::-webkit-slider-track {
  background: #374151;
  height: 6px;
  border-radius: 3px;
}

input[type="range"].slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  background: white;
  height: 14px;
  width: 14px;
  border-radius: 50%;
  margin-top: -5px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type="range"].slider::-webkit-slider-thumb:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

input[type="range"].slider::-moz-range-track {
  background: #374151;
  height: 6px;
  border-radius: 3px;
}

input[type="range"].slider::-moz-range-thumb {
  border: none;
  background: white;
  height: 14px;
  width: 14px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type="range"].slider::-moz-range-thumb:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

/* Timeline hover effects */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Video element styling */
video {
  object-fit: contain;
}

/* Custom dialog styling improvements */
.rounded-2xl {
  border-radius: 1rem;
}

/* Timeline seek thumb positioning fix */
.group .absolute.top-1\/2 {
  top: 50%;
}

/* Center play overlay animation */
.absolute.inset-0:hover {
  opacity: 1 !important;
}

/* Gradient backdrop effects */
.backdrop-blur-md {
  backdrop-filter: blur(12px);
}

.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* Smooth transitions for controls */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Custom scrollbar for better aesthetics */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Loading indicator animation */
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
</style>
