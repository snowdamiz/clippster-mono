<template>
  <PageLayout
    title="PumpFun"
    description="Download streams directly from PumpFun"
    :show-header="pumpFunStore.clips.length > 0"
    icon="/capsule.svg"
  >
    <template #actions v-if="pumpFunStore.clips.length > 0">
      <div class="flex items-center gap-3">
        <!-- Recent Searches Dropdown -->
        <div class="relative" v-if="pumpFunStore.getRecentSearches.length > 0">
          <button
            @click="showRecentDropdown = !showRecentDropdown"
            class="px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center gap-2"
            title="Recent searches"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm">Recent</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 transition-transform"
              :class="{ 'rotate-180': showRecentDropdown }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <!-- Dropdown Menu -->
          <div
            v-if="showRecentDropdown"
            class="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"
            @click.stop
          >
            <div class="p-2">
              <div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Recent Searches</div>
              <div v-for="search in pumpFunStore.getRecentSearches.slice(0, 10)" :key="search.mintId" class="group">
                <div
                  @click="
                    handleRecentSearchClick(search);
                    showRecentDropdown = false;
                  "
                  class="w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-2 cursor-pointer"
                  :title="`Search: ${search.displayText}${search.label ? ` (${search.label})` : ''}`"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3 text-muted-foreground group-hover:text-purple-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate">{{ search.displayText }}</div>
                    <div v-if="search.label" class="text-xs text-purple-400 truncate" :title="`Label: ${search.label}`">
                      {{ search.label }}
                    </div>
                  </div>
                  <button
                    @click.stop="startEditingLabel(search.mintId, search.label)"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/60 rounded transition-all"
                    title="Edit label"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3 text-muted-foreground hover:text-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>

                <!-- Label editing row -->
                <div
                  v-if="editingLabel === search.mintId"
                  class="px-2 py-1.5 bg-muted/50 border-t border-border"
                  @click.stop
                >
                  <div class="flex items-center gap-1.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3 text-muted-foreground flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <input
                      ref="labelInputRef"
                      v-model="labelInput"
                      @keydown="handleLabelKeydown($event, search.mintId)"
                      @blur="saveLabel(search.mintId)"
                      placeholder="Add label..."
                      class="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      maxlength="30"
                    />
                    <button
                      @click="saveLabel(search.mintId)"
                      class="p-0.5 text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                      title="Save"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      @click="cancelEditingLabel"
                      class="p-0.5 text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                      title="Cancel"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <button
                @click="
                  pumpFunStore.clearRecentSearches();
                  showRecentDropdown = false;
                "
                class="w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 text-xs transition-colors mt-1"
                title="Clear all recent searches"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
        <SearchInput
          v-model="mintId"
          placeholder="Mint ID or PumpFun URL"
          :loading="pumpFunStore.loading"
          @search="handleSearch"
          class="flex-1 max-w-md"
        />
      </div>
    </template>
    <!-- Loading State -->
    <div v-if="pumpFunStore.loading" class="space-y-6">
      <!-- Search Bar -->
      <div class="flex justify-center">
        <SearchInput
          v-model="mintId"
          placeholder="Mint ID or PumpFun URL"
          :loading="true"
          :disabled="true"
          class="max-w-md"
        />
      </div>
      <!-- Skeleton Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Show 6 skeleton cards during loading -->
        <div
          v-for="i in 6"
          :key="i"
          class="relative bg-card border border-border rounded-lg overflow-hidden animate-pulse"
        >
          <!-- Thumbnail skeleton -->
          <div class="aspect-video bg-muted/50 relative">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="flex flex-col items-center gap-3">
                <svg
                  class="animate-spin h-8 w-8 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>

                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span class="text-sm text-muted-foreground">Loading...</span>
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
      </div>
    </div>
    <!-- Error State -->
    <div v-else-if="pumpFunStore.error" class="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-12 w-12 text-red-500 mx-auto mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 class="text-lg font-semibold text-red-400 mb-2">Error</h3>

      <p class="text-muted-foreground">{{ pumpFunStore.error }}</p>
      <button
        @click="handleSearch"
        class="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
      >
        Try Again
      </button>
    </div>
    <!-- VODs Grid -->
    <div v-else-if="pumpFunStore.clips.length > 0" class="space-y-6">
      <!-- Filter Notice -->
      <div class="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-blue-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1">
          <p class="text-sm text-blue-400">
            Showing videos
            <span class="font-semibold">3 minutes and longer</span>
            . Shorter videos have been filtered out for better quality.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="clip in paginatedClips"
          :key="clip.clipId"
          class="relative bg-card rounded-lg overflow-hidden hover:border-foreground/20 cursor-pointer group aspect-video hover:scale-102 transition-all"
          @click="handleClipClick(clip)"
        >
          <!-- Thumbnail background with vignette -->
          <div
            v-if="clip.thumbnailUrl"
            class="absolute inset-0 z-0"
            :style="{
              backgroundImage: `url(${clip.thumbnailUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }"
          >
            <!-- Dark vignette overlay -->
            <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
          </div>
          <!-- Top right duration -->
          <div class="absolute top-4 right-4 z-5">
            <span
              :class="[
                'text-xs px-2 py-1 rounded-md',
                clip.thumbnailUrl ? 'text-white/70 bg-muted/20 backdrop-blur-sm' : 'text-muted-foreground bg-muted',
              ]"
            >
              {{ formatDuration(clip.duration) }}
            </span>
          </div>
          <!-- Bottom left title and description -->
          <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
            <h3
              :class="[
                'text-md font-semibold mb-0.5 group-hover:transition-colors line-clamp-2',
                clip.thumbnailUrl
                  ? 'text-white group-hover:text-white/80'
                  : 'text-foreground group-hover:text-foreground/80',
              ]"
            >
              {{ clip.title }}
            </h3>

            <p :class="['text-xs line-clamp-2', clip.thumbnailUrl ? 'text-white/80' : 'text-muted-foreground']">
              {{ clip.createdAt ? formatRelativeTime(clip.createdAt) : 'No timestamp available' }}
            </p>
          </div>
          <!-- Hover Overlay Buttons -->
          <div
            v-if="clip.thumbnailUrl"
            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
          >
            <button
              class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
              title="Download"
              @click.stop="handleDownloadClip(clip)"
            >
              <svg
                class="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
            </button>
          </div>
          <!-- Bottom Action Bar (for cards without thumbnails) -->
          <div
            v-if="!clip.thumbnailUrl"
            :class="['flex items-center justify-between px-4 py-2 border-t border-border bg-[#141414]']"
          >
            <span class="text-sm font-medium text-muted-foreground">{{ clip.clipId }}</span>
            <div class="flex items-center gap-1">
              <button
                class="p-2 rounded-md transition-colors hover:bg-muted"
                title="Download"
                @click.stop="handleDownloadClip(clip)"
              >
                <svg
                  class="h-4 w-4 transition-colors text-muted-foreground hover:text-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <!-- Empty State Component -->
      <EmptyState title="Search VODs on Pump" description="Enter a mint ID or PumpFun URL to search for VODs">
        <template #icon>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-16 w-16 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </template>
        <template #action>
          <div class="flex items-center gap-3 w-full max-w-md">
            <!-- Recent Searches Dropdown -->
            <div v-if="pumpFunStore.getRecentSearches.length > 0" class="relative">
              <button
                @click="showEmptyRecentDropdown = !showEmptyRecentDropdown"
                class="h-12 px-3 bg-muted border border-border rounded-lg text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center gap-2"
                title="Recent searches"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span class="text-sm">Recent</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3 w-3 transition-transform"
                  :class="{ 'rotate-180': showEmptyRecentDropdown }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <!-- Dropdown Menu -->
              <div
                v-if="showEmptyRecentDropdown"
                class="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"
                @click.stop
              >
                <div class="p-2">
                  <div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Recent Searches</div>
                  <div v-for="search in pumpFunStore.getRecentSearches.slice(0, 10)" :key="search.mintId" class="group">
                    <div
                      @click="
                        handleRecentSearchClick(search);
                        showEmptyRecentDropdown = false;
                      "
                      class="w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-2 cursor-pointer"
                      :title="`Search: ${search.displayText}${search.label ? ` (${search.label})` : ''}`"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 text-muted-foreground group-hover:text-purple-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm truncate">{{ search.displayText }}</div>
                        <div
                          v-if="search.label"
                          class="text-xs text-purple-400 truncate"
                          :title="`Label: ${search.label}`"
                        >
                          {{ search.label }}
                        </div>
                      </div>
                      <button
                        @click.stop="startEditingLabel(search.mintId, search.label)"
                        class="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/60 rounded transition-all"
                        title="Edit label"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3 w-3 text-muted-foreground hover:text-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>

                    <!-- Label editing row -->
                    <div
                      v-if="editingLabel === search.mintId"
                      class="px-2 py-1.5 bg-muted/50 border-t border-border"
                      @click.stop
                    >
                      <div class="flex items-center gap-1.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3 w-3 text-muted-foreground flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        <input
                          ref="labelInputRef"
                          v-model="labelInput"
                          @keydown="handleLabelKeydown($event, search.mintId)"
                          @blur="saveLabel(search.mintId)"
                          placeholder="Add label..."
                          class="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          maxlength="30"
                        />
                        <button
                          @click="saveLabel(search.mintId)"
                          class="p-0.5 text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                          title="Save"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          @click="cancelEditingLabel"
                          class="p-0.5 text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                          title="Cancel"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    @click="
                      pumpFunStore.clearRecentSearches();
                      showEmptyRecentDropdown = false;
                    "
                    class="w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 text-xs transition-colors mt-1"
                    title="Clear all recent searches"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            <SearchInput v-model="mintId" placeholder="Mint ID or PumpFun URL" @search="handleSearch" class="flex-1" />
          </div>
        </template>
      </EmptyState>
    </div>
    <!-- Download Confirmation Modal -->
    <div
      v-if="showDownloadDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="closeDownloadDialog()"
    >
      <div
        class="bg-card rounded-2xl p-6 max-w-lg w-full mx-4 border border-border max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-foreground">Download Stream</h2>
          <button
            @click="closeDownloadDialog()"
            class="p-1.5 hover:bg-muted rounded-lg transition-colors"
            :disabled="downloadStarting"
          >
            <svg
              class="h-4 w-4 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="space-y-4">
          <!-- Selected Video Info -->
          <div class="bg-muted/30 rounded-lg p-3 border border-border/50">
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0"
              >
                <svg
                  class="h-4 w-4 text-purple-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">{{ downloadTitle }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ clipToDownload?.clipId }}</p>
              </div>
            </div>
          </div>

          <!-- Download Type Selection -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">Download Type:</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                @click="useSegmentDownload = false"
                :class="[
                  'relative p-3 rounded-lg border-2 transition-all text-left',
                  !useSegmentDownload
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-border bg-card hover:bg-muted/50',
                ]"
              >
                <div class="flex items-center gap-2">
                  <div
                    :class="[
                      'w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0',
                      !useSegmentDownload ? 'bg-purple-500 text-white' : 'bg-muted text-muted-foreground',
                    ]"
                  >
                    <svg
                      class="h-3 w-3"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                      />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4
                      :class="[
                        'font-medium text-xs truncate',
                        !useSegmentDownload ? 'text-purple-400' : 'text-foreground',
                      ]"
                    >
                      Full Stream
                    </h4>
                  </div>
                  <div v-if="!useSegmentDownload" class="flex-shrink-0">
                    <div class="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg
                        class="h-2.5 w-2.5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>

              <button
                @click="useSegmentDownload = true"
                :class="[
                  'relative p-3 rounded-lg border-2 transition-all text-left',
                  useSegmentDownload ? 'border-purple-500 bg-purple-500/10' : 'border-border bg-card hover:bg-muted/50',
                ]"
              >
                <div class="flex items-center gap-2">
                  <div
                    :class="[
                      'w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0',
                      useSegmentDownload ? 'bg-purple-500 text-white' : 'bg-muted text-muted-foreground',
                    ]"
                  >
                    <svg
                      class="h-3 w-3"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4
                      :class="[
                        'font-medium text-xs truncate',
                        useSegmentDownload ? 'text-purple-400' : 'text-foreground',
                      ]"
                    >
                      Custom Segment
                    </h4>
                  </div>
                  <div v-if="useSegmentDownload" class="flex-shrink-0">
                    <div class="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg
                        class="h-2.5 w-2.5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Time Range Picker (shown only for segment downloads) -->
          <div v-if="useSegmentDownload" class="space-y-2">
            <label class="text-sm font-medium text-foreground flex items-center gap-1.5">
              <svg
                class="h-3.5 w-3.5 text-purple-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Select Time Range:
            </label>
            <div class="bg-muted/20 rounded-lg p-3 border border-border/50">
              <TimeRangePicker
                v-model="selectedTimeRange"
                :total-duration="clipToDownload?.duration || 0"
                @change="handleTimeRangeChange"
              />
            </div>
          </div>

          <!-- Stream Details -->
          <div class="bg-muted/30 rounded-lg p-3 border border-border/50">
            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Duration:</span>
                <span class="font-medium text-foreground">{{ formatDuration(clipToDownload?.duration) }}</span>
              </div>

              <div v-if="useSegmentDownload" class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Selected:</span>
                <span class="font-medium text-purple-400">
                  {{ formatDuration(selectedTimeRange.endTime - selectedTimeRange.startTime) }}
                </span>
              </div>

              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Est. Time:</span>
                <span class="font-medium text-green-400">{{ estimatedDownloadTime }}</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2 pt-5 border-t border-border">
            <button
              class="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
              @click="downloadClipConfirmed"
              :disabled="
                downloadStarting || (useSegmentDownload && selectedTimeRange.endTime <= selectedTimeRange.startTime)
              "
            >
              <span v-if="downloadStarting" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ useSegmentDownload ? 'Starting Segment Download...' : 'Starting Download...' }}
              </span>
              <span v-else class="flex items-center justify-center gap-2">
                <svg
                  class="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                {{ useSegmentDownload ? 'Download Segment' : 'Download Full Stream' }}
              </span>
            </button>

            <button
              class="w-full py-2.5 px-4 bg-muted/50 text-muted-foreground rounded-lg font-semibold hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-border/50 hover:border-border"
              @click="closeDownloadDialog()"
              :disabled="downloadStarting"
            >
              <span class="flex items-center justify-center gap-2">
                <svg
                  class="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="pumpFunStore.clips.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="pumpFunStore.clips.length"
      item-label="VOD"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SearchInput from '@/components/SearchInput.vue';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { type PumpFunClip } from '@/services/pumpfun';
  import { useToast } from '@/composables/useToast';
  import { useDownloads } from '@/composables/useDownloads';
  import { usePumpFunStore } from '@/stores/pumpfun';
  import { getNextSegmentNumber } from '@/services/database';

  const { success, error: showError } = useToast();
  const { startDownload } = useDownloads();
  const router = useRouter();
  const pumpFunStore = usePumpFunStore();

  // Initialize component
  onMounted(() => {
    // Add click outside listener to close dropdown
    document.addEventListener('click', handleClickOutside);
  });

  // Clean up event listener
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Handle click outside to close dropdowns
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showRecentDropdown.value = false;
      showEmptyRecentDropdown.value = false;
    }
  }

  const mintId = ref(pumpFunStore.currentMintId);
  const showDownloadDialog = ref(false);
  const clipToDownload = ref<PumpFunClip | null>(null);
  const downloadStarting = ref(false);
  const showRecentDropdown = ref(false);
  const showEmptyRecentDropdown = ref(false);

  // Label editing state
  const editingLabel = ref<string | null>(null);
  const labelInput = ref('');
  const labelInputRef = ref<HTMLInputElement | null>(null);

  // Time range selection
  const useSegmentDownload = ref(false);
  const selectedTimeRange = ref({ startTime: 0, endTime: 0 });
  const nextSegmentNumber = ref(1); // Default to 1

  // Pagination state
  const currentPage = ref(1);
  const clipsPerPage = 20;

  // Reactive computed property for download title
  const downloadTitle = computed(() => {
    if (!clipToDownload.value) return '';

    if (useSegmentDownload.value && clipToDownload.value.clipId) {
      // Show the actual segment number that will be used
      const baseTitle = clipToDownload.value.title;
      return `${baseTitle} (will be named "${baseTitle} Segment ${nextSegmentNumber.value}")`;
    }

    return clipToDownload.value.title;
  });

  // Computed properties for dialog
  const formatDuration = (duration?: number) => {
    if (!duration) return 'Unknown';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const estimatedDownloadTime = computed(() => {
    const duration = useSegmentDownload.value
      ? selectedTimeRange.value.endTime - selectedTimeRange.value.startTime
      : clipToDownload.value?.duration;

    if (!duration) return 'Unknown';

    // Estimate based on 1 GB per hour of video content
    const estimatedSizeGB = (duration / 3600) * 1;
    // Assume average download speed of 50 Mbps
    const avgDownloadSpeedMbps = 50;
    // Convert GB to Mb and calculate download time in seconds
    const downloadTimeSeconds = (estimatedSizeGB * 8000) / avgDownloadSpeedMbps;

    return formatDuration(downloadTimeSeconds);
  });

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(pumpFunStore.clips.length / clipsPerPage));
  const paginatedClips = computed(() => {
    const startIndex = (currentPage.value - 1) * clipsPerPage;
    const endIndex = startIndex + clipsPerPage;
    const paginated = pumpFunStore.clips.slice(startIndex, endIndex);
    return paginated;
  });

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function previousPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  // Reset to first page when clips change
  watch(
    () => pumpFunStore.clips,
    () => {
      currentPage.value = 1;
    }
  );

  // Format relative time for stream dates
  function formatRelativeTime(timestamp?: number | string | Date) {
    if (!timestamp) return 'Streamed recently';

    const date = new Date(timestamp);
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secondsAgo < 60) return 'Streamed just now';
    if (secondsAgo < 3600) return `Streamed ${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `Streamed ${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `Streamed ${Math.floor(secondsAgo / 86400)} days ago`;

    return `Streamed ${Math.floor(secondsAgo / 604800)} weeks ago`;
  }

  function handleRecentSearchClick(search: { mintId: string; displayText: string; label?: string }) {
    mintId.value = search.displayText;
    handleSearch();
  }

  // Label editing functions
  function startEditingLabel(mintId: string, currentLabel?: string) {
    editingLabel.value = mintId;
    labelInput.value = currentLabel || '';

    // Focus the input field after it's rendered
    nextTick(() => {
      labelInputRef.value?.focus();
      labelInputRef.value?.select();
    });
  }

  function saveLabel(mintId: string) {
    pumpFunStore.updateRecentSearchLabel(mintId, labelInput.value);
    editingLabel.value = null;
    labelInput.value = '';
  }

  function cancelEditingLabel() {
    editingLabel.value = null;
    labelInput.value = '';
  }

  function handleLabelKeydown(event: KeyboardEvent, mintId: string) {
    if (event.key === 'Enter') {
      saveLabel(mintId);
    } else if (event.key === 'Escape') {
      cancelEditingLabel();
    }
  }

  function handleTimeRangeChange(range: { startTime: number; endTime: number }) {
    selectedTimeRange.value = range;
  }

  // Function to close download dialog
  async function closeDownloadDialog() {
    showDownloadDialog.value = false;
    clipToDownload.value = null;
  }

  async function handleSearch() {
    const input = mintId.value.trim();

    if (!input) {
      showError('Invalid Input', 'Please enter a mint ID or PumpFun URL');
      return;
    }

    // Only update the input field to show the extracted mint ID if it's different from current
    // and we're not dealing with a recent search selection
    const isRecentSearchSelection = pumpFunStore.getRecentSearches.some((search) => search.displayText === input);

    if (!isRecentSearchSelection && input !== pumpFunStore.currentMintId && pumpFunStore.currentMintId) {
      mintId.value = pumpFunStore.currentMintId;
    }

    try {
      const result = await pumpFunStore.searchClips(input, 20);

      if (result.success) {
        if (result.total === 0) {
          showError('No VODs Found', 'This mint ID has no available VODs');
        } else {
          success('VODs Loaded', `Found ${result.total} VOD${result.total !== 1 ? 's' : ''}`);
        }
      } else {
        showError('Search Failed', result.error || 'Failed to fetch VODs');
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  function handleClipClick(clip: PumpFunClip) {
    console.log('Clicked clip:', clip);
    // TODO: Implement clip playback or details view
  }

  function handleDownloadClip(clip: PumpFunClip) {
    clipToDownload.value = clip;
    // Reset segment download state
    useSegmentDownload.value = false;
    selectedTimeRange.value = { startTime: 0, endTime: clip.duration || 0 };

    // Calculate the next segment number for this clip
    calculateNextSegmentNumber(clip.clipId);

    showDownloadDialog.value = true;
  }

  // Calculate the next segment number for a given clip
  async function calculateNextSegmentNumber(clipId: string) {
    try {
      nextSegmentNumber.value = await getNextSegmentNumber(clipId);
    } catch (error) {
      // Fallback to 1 if migration hasn't run or there's an error
      nextSegmentNumber.value = 1;
    }
  }

  async function downloadClipConfirmed() {
    if (!clipToDownload.value) return;

    const clip = clipToDownload.value; // Store reference for error handling
    downloadStarting.value = true;

    try {
      // Get the best available video URL
      const videoUrl = clip.mp4Url || clip.playlistUrl;
      if (!videoUrl) {
        throw new Error('No video URL available for this VOD');
      }

      // Determine download parameters
      const segmentRange = useSegmentDownload.value
        ? { startTime: selectedTimeRange.value.startTime, endTime: selectedTimeRange.value.endTime }
        : undefined;

      // Start the download
      await startDownload(clip.title, videoUrl, pumpFunStore.currentMintId, segmentRange, clip.clipId, clip.duration);

      // Show success toast
      let downloadType = useSegmentDownload.value ? 'segment' : 'full stream';
      let downloadMessage = `Downloading ${downloadType} of "${clip.title}". You'll be notified when it completes.`;

      // Check if auto-segmentation will be applied
      if (!useSegmentDownload.value && clip.duration && clip.duration > 3600) {
        const numberOfSegments = Math.ceil(clip.duration / 3600);
        const segmentDuration = Math.round(clip.duration / numberOfSegments / 60);
        downloadType = 'auto-segmented stream';
        downloadMessage = `Splitting "${clip.title}" into ${numberOfSegments} equal parts (~${segmentDuration} min each). Downloads will process one at a time.`;
      }

      success('Download Started', downloadMessage);

      // Close dialog immediately
      await closeDownloadDialog();

      // Small delay to show loading state briefly, then navigate
      setTimeout(() => {
        downloadStarting.value = false;
        // Navigate to Videos page to see progress
        router.push('/videos');
      }, 500);
    } catch (err) {
      showError('Download Failed', `Failed to download "${clip.title}": ${err}`);
      // Reset loading state on error
      downloadStarting.value = false;
      await closeDownloadDialog();
    }
  }
</script>
