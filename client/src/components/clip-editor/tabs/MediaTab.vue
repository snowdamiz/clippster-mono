<template>
  <div class="space-y-3">
    <!-- Asset Upload Dialog -->
    <AssetUploadDialog
      :show="showAssetUploadDialog"
      @close="showAssetUploadDialog = false"
      @uploaded="handleAssetUploaded"
    />

    <!-- Unified Search Bar -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style="color: var(--sidebar-text-muted)" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search media..."
        class="w-full pl-9 pr-3 py-2 rounded-lg text-sm border transition-colors focus:outline-none"
        style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border); color: var(--sidebar-text)"
        @focus="(e) => ((e.target as HTMLInputElement).style.borderColor = 'var(--sidebar-accent)')"
        @blur="(e) => ((e.target as HTMLInputElement).style.borderColor = 'var(--sidebar-border)')"
      />
    </div>

    <!-- Project Media Section -->
    <CollapsibleSection title="PROJECT MEDIA" :count="filteredProjectMedia.length" :default-open="true">
      <div class="space-y-3">
        <!-- Media Type Filter Chips -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-for="filter in mediaFilters"
            :key="filter.id"
            @click="mediaTypeFilter = filter.id"
            class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
            :style="
              mediaTypeFilter === filter.id
                ? 'background-color: var(--sidebar-active); color: var(--sidebar-accent)'
                : 'background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)'
            "
            @mouseenter="
              (e) => {
                if (mediaTypeFilter !== filter.id)
                  (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
              }
            "
            @mouseleave="
              (e) => {
                if (mediaTypeFilter !== filter.id)
                  (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
              }
            "
          >
            <component :is="filter.icon" :size="12" />
            {{ filter.label }} ({{ filter.count }})
          </button>

          <!-- Actions -->
          <div class="ml-auto flex items-center gap-1">
            <button
              @click="showAssetUploadDialog = true"
              class="p-1.5 rounded-md transition-all"
              style="color: var(--sidebar-text-muted)"
              @mouseenter="(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--sidebar-accent)')"
              @mouseleave="(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)')"
              title="Upload asset"
            >
              <Plus :size="14" />
            </button>
          </div>
        </div>

        <!-- Watermark Content (when watermark filter is selected) -->
        <template v-if="mediaTypeFilter === 'watermark'">
          <!-- Active Watermarks List -->
          <div v-if="watermarks.length > 0" class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-medium" style="color: var(--sidebar-text)">Active Watermarks</h4>
              <span class="text-[10px]" style="color: var(--sidebar-text-muted)">
                {{ watermarks.length }} watermark{{ watermarks.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <div
              v-for="watermark in watermarks"
              :key="watermark.id"
              class="p-3 rounded-lg border"
              :style="{
                backgroundColor: 'var(--sidebar-hover)',
                borderColor: selectedWatermarkId === watermark.id ? 'var(--sidebar-accent)' : 'var(--sidebar-border)',
              }"
            >
              <!-- Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    class="w-8 h-8 rounded overflow-hidden flex-shrink-0"
                    style="background-color: var(--sidebar-surface)"
                  >
                    <img
                      v-if="watermark.previewUrl"
                      :src="watermark.previewUrl"
                      alt="Watermark"
                      class="w-full h-full object-contain"
                    />
                    <ImageIcon v-else :size="16" class="m-auto mt-1.5" style="color: var(--sidebar-text-muted)" />
                  </div>
                  <span class="text-xs truncate" style="color: var(--sidebar-text)">Watermark</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    @click="selectWatermark(watermark.id)"
                    class="p-1.5 rounded transition-colors"
                    :style="{
                      backgroundColor: selectedWatermarkId === watermark.id ? 'var(--sidebar-active)' : 'transparent',
                    }"
                    title="Edit"
                  >
                    <Pencil
                      :size="12"
                      :style="{
                        color:
                          selectedWatermarkId === watermark.id ? 'var(--sidebar-accent)' : 'var(--sidebar-text-muted)',
                      }"
                    />
                  </button>
                  <button
                    @click="emit('deleteWatermark', watermark.id)"
                    class="p-1.5 rounded transition-colors hover:bg-red-500/10"
                    title="Remove"
                  >
                    <Trash2 :size="12" class="text-red-400" />
                  </button>
                </div>
              </div>

              <!-- Quick Info -->
              <div class="flex items-center gap-3 text-[10px]" style="color: var(--sidebar-text-muted)">
                <span>{{ formatTime(watermark.startTime) }} - {{ formatTime(watermark.endTime) }}</span>
                <span>{{ watermark.scale }}%</span>
                <span>{{ watermark.opacity }}% opacity</span>
              </div>

              <!-- Aspect Ratio Config Buttons -->
              <div v-if="configuredAspectRatios.length > 0" class="mt-2 flex flex-wrap items-center gap-1.5">
                <span class="text-[9px] uppercase tracking-wide" style="color: var(--sidebar-text-muted)">
                  Configure:
                </span>
                <button
                  @click="switchToRatio('16:9')"
                  class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-all"
                  :style="{
                    backgroundColor: previewAspectRatio === '16:9' ? 'var(--sidebar-accent)' : 'var(--sidebar-hover)',
                    color: previewAspectRatio === '16:9' ? 'white' : 'var(--sidebar-text-muted)',
                  }"
                >
                  16:9
                </button>
                <button
                  v-for="ratio in configuredAspectRatios"
                  :key="ratio"
                  @click="switchToRatio(ratio)"
                  class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-all flex items-center gap-0.5"
                  :style="{
                    backgroundColor:
                      previewAspectRatio === ratio
                        ? 'var(--sidebar-accent)'
                        : watermark.perRatioConfigs?.[ratio]
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'var(--sidebar-hover)',
                    color:
                      previewAspectRatio === ratio
                        ? 'white'
                        : watermark.perRatioConfigs?.[ratio]
                          ? 'rgb(52, 211, 153)'
                          : 'var(--sidebar-text-muted)',
                  }"
                >
                  {{ ratio }}
                  <span
                    v-if="watermark.perRatioConfigs?.[ratio]"
                    class="w-1 h-1 rounded-full"
                    style="background-color: rgb(52, 211, 153)"
                  ></span>
                </button>
              </div>

              <!-- Expanded Edit Panel -->
              <div
                v-if="selectedWatermarkId === watermark.id"
                class="mt-3 pt-3 space-y-3"
                style="border-top: 1px solid var(--sidebar-border)"
              >
                <!-- Timing -->
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[10px] mb-1" style="color: var(--sidebar-text-muted)">Start Time</label>
                    <div class="flex items-center gap-1">
                      <input
                        type="number"
                        :value="watermark.startTime.toFixed(1)"
                        @input="
                          (e) =>
                            updateWatermark(watermark.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))
                        "
                        step="0.1"
                        min="0"
                        :max="duration"
                        class="w-full px-2 py-1 rounded text-xs border"
                        style="
                          background-color: var(--sidebar-hover);
                          border-color: var(--sidebar-border);
                          color: var(--sidebar-text);
                        "
                      />
                      <span class="text-[10px]" style="color: var(--sidebar-text-muted)">s</span>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] mb-1" style="color: var(--sidebar-text-muted)">End Time</label>
                    <div class="flex items-center gap-1">
                      <input
                        type="number"
                        :value="watermark.endTime.toFixed(1)"
                        @input="
                          (e) =>
                            updateWatermark(watermark.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))
                        "
                        step="0.1"
                        :min="watermark.startTime"
                        :max="duration"
                        class="w-full px-2 py-1 rounded text-xs border"
                        style="
                          background-color: var(--sidebar-hover);
                          border-color: var(--sidebar-border);
                          color: var(--sidebar-text);
                        "
                      />
                      <span class="text-[10px]" style="color: var(--sidebar-text-muted)">s</span>
                    </div>
                  </div>
                </div>

                <!-- Scale & Opacity -->
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[10px] mb-1" style="color: var(--sidebar-text-muted)">Scale</label>
                    <div class="flex items-center gap-1">
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="1"
                        :value="getWatermarkConfig(watermark).scale"
                        @input="
                          (e) =>
                            updateWatermarkConfig(
                              watermark.id,
                              'scale',
                              parseFloat((e.target as HTMLInputElement).value)
                            )
                        "
                        class="watermark-range flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                      <span class="text-[10px] w-8 text-right" style="color: var(--sidebar-text-muted)">
                        {{ getWatermarkConfig(watermark).scale }}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] mb-1" style="color: var(--sidebar-text-muted)">Opacity</label>
                    <div class="flex items-center gap-1">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        :value="getWatermarkConfig(watermark).opacity"
                        @input="
                          (e) =>
                            updateWatermarkConfig(
                              watermark.id,
                              'opacity',
                              parseFloat((e.target as HTMLInputElement).value)
                            )
                        "
                        class="watermark-range flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                      <span class="text-[10px] w-8 text-right" style="color: var(--sidebar-text-muted)">
                        {{ getWatermarkConfig(watermark).opacity }}%
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Position Grid -->
                <div>
                  <label class="block text-[10px] mb-1" style="color: var(--sidebar-text-muted)">Position</label>
                  <div class="grid grid-cols-3 gap-1 max-w-[120px]">
                    <button
                      v-for="pos in positionPresets"
                      :key="pos.id"
                      @click="setWatermarkPosition(watermark.id, pos.x, pos.y)"
                      class="aspect-square rounded text-[8px] transition-all border"
                      :style="{
                        backgroundColor: isNearPosition(watermark, pos.x, pos.y)
                          ? 'var(--sidebar-active)'
                          : 'var(--sidebar-hover)',
                        borderColor: isNearPosition(watermark, pos.x, pos.y)
                          ? 'var(--sidebar-accent)'
                          : 'var(--sidebar-border)',
                        color: isNearPosition(watermark, pos.x, pos.y)
                          ? 'var(--sidebar-accent)'
                          : 'var(--sidebar-text-muted)',
                      }"
                      :title="pos.label"
                    >
                      <component :is="pos.icon" :size="10" class="mx-auto" />
                    </button>
                  </div>
                  <p class="text-[9px] mt-1" style="color: var(--sidebar-text-muted)">Drag in preview to fine-tune</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Watermark List (hidden when a watermark is already active - only one allowed) -->
          <div v-if="watermarks.length === 0" class="max-h-[350px] overflow-y-auto pr-1 space-y-1.5 watermark-scroll">
            <!-- Loading State -->
            <div v-if="watermarkLibraryLoading" class="flex items-center justify-center py-6">
              <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
            </div>

            <!-- Empty State -->
            <div v-else-if="allWatermarksFiltered.length === 0" class="py-6 text-center">
              <Droplet :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
              <p class="text-xs" style="color: var(--sidebar-text-muted)">
                {{ searchQuery ? 'No matching watermarks found' : 'No watermarks available' }}
              </p>
            </div>

            <!-- Combined Watermarks List -->
            <template v-else>
              <div
                v-for="wm in allWatermarksFiltered"
                :key="wm.id"
                @click="addWatermarkFromLibrary(wm)"
                class="watermark-asset group p-3 rounded-lg border transition-all cursor-pointer"
                style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border)"
                @mouseenter="
                  (e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-accent)';
                  }
                "
                @mouseleave="
                  (e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)';
                  }
                "
              >
                <div class="flex items-center gap-3">
                  <!-- Thumbnail -->
                  <div
                    class="w-16 h-10 rounded overflow-hidden flex-shrink-0 relative"
                    style="background-color: var(--sidebar-surface)"
                  >
                    <img
                      v-if="getWatermarkThumbnail(wm)"
                      :src="getWatermarkThumbnail(wm)"
                      :alt="wm.name"
                      class="w-full h-full object-contain"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <Droplet :size="14" style="color: var(--sidebar-text-muted)" />
                    </div>
                    <!-- Organization Badge -->
                    <div
                      v-if="wm.isOrgAsset"
                      class="absolute top-0.5 right-0.5 px-1 py-0.5 text-[8px] font-medium rounded bg-cyan-500/90 text-white flex items-center gap-0.5"
                      :title="wm.organization_name || 'Organization asset'"
                    >
                      <Building2 :size="8" />
                    </div>
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <p class="text-sm truncate" style="color: var(--sidebar-text)">{{ wm.name }}</p>
                    </div>
                    <p class="text-xs" style="color: var(--sidebar-text-muted)">
                      {{ wm.width && wm.height ? `${wm.width}x${wm.height}` : 'Watermark' }}
                      <span v-if="wm.organization_name" class="text-cyan-400/60">• {{ wm.organization_name }}</span>
                    </p>
                  </div>

                  <!-- Add button -->
                  <button
                    @click.stop="addWatermarkFromLibrary(wm)"
                    class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
                    title="Add to timeline"
                  >
                    <Plus :size="14" />
                  </button>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Regular Media Grid (when not watermark filter) -->
        <template v-else>
          <div v-if="loading" class="flex items-center justify-center py-6">
            <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
          </div>

          <div v-else-if="filteredProjectMedia.length === 0" class="py-6 text-center">
            <FolderOpen :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
            <p class="text-xs" style="color: var(--sidebar-text-muted)">
              {{ searchQuery ? 'No matching media found' : 'No media in this project' }}
            </p>
          </div>

          <div v-else class="grid grid-cols-3 gap-2">
            <MediaItem
              v-for="media in filteredProjectMedia"
              :key="media.id"
              :media="media"
              @click="addMediaToTimeline(media)"
            />
          </div>
        </template>
      </div>
    </CollapsibleSection>

    <!-- Library Section -->
    <CollapsibleSection
      title="LIBRARY"
      :count="libraryFilter === 'clips' ? filteredClips.length : filteredRawVideos.length"
      :default-open="false"
    >
      <div class="space-y-3">
        <!-- Library Filter Toggle -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            @click="libraryFilter = 'clips'"
            class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
            :style="
              libraryFilter === 'clips'
                ? 'background-color: var(--sidebar-active); color: var(--sidebar-accent)'
                : 'background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)'
            "
            @mouseenter="
              (e) => {
                if (libraryFilter !== 'clips')
                  (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
              }
            "
            @mouseleave="
              (e) => {
                if (libraryFilter !== 'clips') (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
              }
            "
          >
            <Film :size="12" />
            My Clips ({{ filteredClips.length }})
          </button>
          <button
            @click="libraryFilter = 'videos'"
            class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
            :style="
              libraryFilter === 'videos'
                ? 'background-color: var(--sidebar-active); color: var(--sidebar-accent)'
                : 'background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)'
            "
            @mouseenter="
              (e) => {
                if (libraryFilter !== 'videos')
                  (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
              }
            "
            @mouseleave="
              (e) => {
                if (libraryFilter !== 'videos')
                  (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
              }
            "
          >
            <Video :size="12" />
            Raw Videos ({{ filteredRawVideos.length }})
          </button>
        </div>

        <!-- Clips List -->
        <div v-if="libraryFilter === 'clips'" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          <div v-if="libraryLoading" class="flex items-center justify-center py-6">
            <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
          </div>

          <div v-else-if="filteredClips.length === 0" class="py-6 text-center">
            <Film :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
            <p class="text-xs" style="color: var(--sidebar-text-muted)">
              {{ searchQuery ? 'No matching clips found' : 'No clips available' }}
            </p>
          </div>

          <div
            v-for="clip in filteredClips"
            :key="clip.id"
            class="group p-3 rounded-lg transition-all cursor-pointer border"
            style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border)"
            draggable="true"
            @dragstart="(e) => onDragStart(e, 'clip', clip)"
            @click="addSourceToTimeline('clip', clip)"
            @mouseenter="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-accent)';
              }
            "
            @mouseleave="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)';
              }
            "
          >
            <div class="flex items-center gap-3">
              <div
                class="w-14 h-9 rounded overflow-hidden flex-shrink-0"
                style="background-color: var(--sidebar-surface)"
              >
                <img
                  v-if="getThumbnailUrl(clip.id)"
                  :src="getThumbnailUrl(clip.id)!"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Film :size="12" style="color: var(--sidebar-text-muted)" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs truncate" style="color: var(--sidebar-text)">{{ clip.name }}</p>
                <p class="text-[10px]" style="color: var(--sidebar-text-muted)">{{ formatDuration(clip.duration) }}</p>
              </div>
              <button
                @click.stop="addSourceToTimeline('clip', clip)"
                class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
              >
                <Plus :size="12" />
              </button>
            </div>
          </div>
        </div>

        <!-- Raw Videos List -->
        <div v-if="libraryFilter === 'videos'" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          <div v-if="libraryLoading" class="flex items-center justify-center py-6">
            <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
          </div>

          <div v-else-if="filteredRawVideos.length === 0" class="py-6 text-center">
            <Video :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
            <p class="text-xs" style="color: var(--sidebar-text-muted)">
              {{ searchQuery ? 'No matching videos found' : 'No raw videos available' }}
            </p>
          </div>

          <div
            v-for="video in filteredRawVideos"
            :key="video.id"
            class="group p-3 rounded-lg transition-all cursor-pointer border"
            style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border)"
            draggable="true"
            @dragstart="(e) => onDragStart(e, 'raw_video', video)"
            @click="addSourceToTimeline('raw_video', video)"
            @mouseenter="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-accent)';
              }
            "
            @mouseleave="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)';
              }
            "
          >
            <div class="flex items-center gap-3">
              <div
                class="w-14 h-9 rounded overflow-hidden flex-shrink-0"
                style="background-color: var(--sidebar-surface)"
              >
                <img
                  v-if="getThumbnailUrl(video.id)"
                  :src="getThumbnailUrl(video.id)!"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Video :size="12" style="color: var(--sidebar-text-muted)" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs truncate" style="color: var(--sidebar-text)">{{ video.name }}</p>
                <p class="text-[10px]" style="color: var(--sidebar-text-muted)">{{ formatDuration(video.duration) }}</p>
              </div>
              <button
                @click.stop="addSourceToTimeline('raw_video', video)"
                class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
              >
                <Plus :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>

    <!-- Intro/Outro Section -->
    <CollapsibleSection title="INTRO / OUTRO" :default-open="false">
      <IntroOutroTab
        :current-intro="currentIntro"
        :current-outro="currentOutro"
        :search-query="searchQuery"
        @add-intro="$emit('addIntro', $event)"
        @add-outro="$emit('addOutro', $event)"
        @remove-intro="$emit('removeIntro')"
        @remove-outro="$emit('removeOutro')"
      />
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import {
    Search,
    Video,
    Music,
    Image as ImageIcon,
    Film,
    Plus,
    Loader2,
    FolderOpen,
    Droplet,
    Pencil,
    Trash2,
    Building2,
    ArrowUpLeft,
    ArrowUp,
    ArrowUpRight,
    ArrowLeft,
    Maximize2,
    ArrowRight,
    ArrowDownLeft,
    ArrowDown,
    ArrowDownRight,
  } from 'lucide-vue-next';
  import type { SourceItem, ClipWatermark, ManualFramingConfigs } from '@/types';
  import {
    getProjectMedia,
    addProjectMedia,
    recordMediaUsage,
    type ProjectMedia,
    type MediaType,
  } from '@/services/database/project-media';
  import { getAllClips } from '@/services/database/clips';
  import { getAllRawVideos } from '@/services/database/raw-videos';
  import { getAllProjects } from '@/services/database/projects';
  import { getThumbnailByClipId } from '@/services/database/thumbnails';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { useAuthStore } from '@/stores/auth';
  import { invoke } from '@tauri-apps/api/core';
  import CollapsibleSection from '../CollapsibleSection.vue';
  import MediaItem from '../MediaItem.vue';
  import IntroOutroTab from './IntroOutroTab.vue';
  import AssetUploadDialog from '@/components/AssetUploadDialog.vue';

  const props = withDefaults(
    defineProps<{
      projectId: string | null;
      currentIntro: any;
      currentOutro: any;
      // Watermark props (optional - parent may not pass these initially)
      watermarks?: ClipWatermark[];
      previewAspectRatio?: string;
      selectedAspectRatios?: string[];
      framingConfigs?: ManualFramingConfigs;
      duration?: number;
      currentTime?: number;
    }>(),
    {
      watermarks: () => [],
      previewAspectRatio: '16:9',
      selectedAspectRatios: () => [],
      framingConfigs: () => ({}) as ManualFramingConfigs,
      duration: 0,
      currentTime: 0,
    }
  );

  const emit = defineEmits<{
    (e: 'addSource', source: SourceItem): void;
    (e: 'importFile', filePath: string, name: string, duration: number, thumbnailPath?: string): void;
    (e: 'addProjectMedia', media: ProjectMedia): void;
    (e: 'addIntro', intro: any): void;
    (e: 'addOutro', outro: any): void;
    (e: 'removeIntro'): void;
    (e: 'removeOutro'): void;
    // Watermark emits
    (e: 'addWatermark', watermarkId: string, filePath: string, previewUrl: string): void;
    (e: 'updateWatermark', watermarkId: string, updates: Partial<ClipWatermark>): void;
    (e: 'deleteWatermark', watermarkId: string): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // Extended WatermarkImage type that includes org asset properties
  interface WatermarkItem extends Omit<WatermarkImage, 'id' | 'organization_id' | 'organization_name'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string | null;
    organization_name?: string | null;
    thumbnail_path?: string | null;
  }

  // Position presets for watermark placement
  const positionPresets = [
    { id: 'top-left', label: 'Top Left', x: 8, y: 8, icon: ArrowUpLeft },
    { id: 'top-center', label: 'Top Center', x: 50, y: 8, icon: ArrowUp },
    { id: 'top-right', label: 'Top Right', x: 92, y: 8, icon: ArrowUpRight },
    { id: 'center-left', label: 'Center Left', x: 8, y: 50, icon: ArrowLeft },
    { id: 'center', label: 'Center', x: 50, y: 50, icon: Maximize2 },
    { id: 'center-right', label: 'Center Right', x: 92, y: 50, icon: ArrowRight },
    { id: 'bottom-left', label: 'Bottom Left', x: 8, y: 92, icon: ArrowDownLeft },
    { id: 'bottom-center', label: 'Bottom Center', x: 50, y: 92, icon: ArrowDown },
    { id: 'bottom-right', label: 'Bottom Right', x: 92, y: 92, icon: ArrowDownRight },
  ];

  const loading = ref(false);
  const libraryLoading = ref(false);
  const searchQuery = ref('');
  const libraryFilter = ref<'clips' | 'videos'>('clips');
  const mediaTypeFilter = ref<'all' | 'video' | 'audio' | 'image' | 'watermark'>('all');
  const showAssetUploadDialog = ref(false);

  // Auth store for organization checks
  const authStore = useAuthStore();

  // Project media
  const projectMedia = ref<ProjectMedia[]>([]);
  const orgAssets = ref<ServerOrganizationAsset[]>([]);

  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  // Library data
  const clips = ref<SourceItem[]>([]);
  const rawVideos = ref<SourceItem[]>([]);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const projectNames = ref<Map<string, string>>(new Map());

  // Watermark state
  const selectedWatermarkId = ref<string | null>(null);
  const personalWatermarks = ref<WatermarkItem[]>([]);
  const orgWatermarks = ref<WatermarkItem[]>([]);
  const watermarkThumbnailCache = ref<Map<string, string>>(new Map());
  const watermarkLibraryLoading = ref(false);
  const { onUploadComplete } = useWatermarkOperations();

  // Unified project media (includes organization assets)
  const allProjectMedia = computed(() => {
    // Convert org assets to a compatible format
    const orgMediaItems = orgAssets.value.map((a) => ({
      id: `org_${a.id}`,
      project_id: props.projectId || '',
      file_name: a.name,
      file_path: a.url,
      thumbnail_path: a.thumbnail_url,
      media_type: a.asset_type as MediaType,
      duration: a.duration,
      width: a.width,
      height: a.height,
      file_size: a.file_size,
      is_favorite: false,
      use_count: 0,
      last_used_at: null,
      created_at: new Date(a.inserted_at).getTime(),
      user_id: null,
      isOrgAsset: true,
      organization_name: a.organization_name,
    }));

    return [...projectMedia.value, ...(orgMediaItems as any)];
  });

  // Media type counts (include org assets)
  const videoCount = computed(() => allProjectMedia.value.filter((m) => m.media_type === 'video').length);
  const audioCount = computed(() => allProjectMedia.value.filter((m) => m.media_type === 'audio').length);
  const imageCount = computed(() => allProjectMedia.value.filter((m) => m.media_type === 'image').length);

  // Media filters configuration
  const mediaFilters = computed(() => [
    { id: 'all' as const, label: 'All', icon: FolderOpen, count: allProjectMedia.value.length },
    { id: 'video' as const, label: 'Video', icon: Video, count: videoCount.value },
    { id: 'audio' as const, label: 'Audio', icon: Music, count: audioCount.value },
    { id: 'image' as const, label: 'Images', icon: ImageIcon, count: imageCount.value },
    { id: 'watermark' as const, label: 'Watermarks', icon: Droplet, count: watermarkCount.value },
  ]);

  // Unified filtered project media (combines favorites, recent, and all, including org assets)
  const filteredProjectMedia = computed(() => {
    let media = [...allProjectMedia.value];

    // Filter by type
    if (mediaTypeFilter.value !== 'all') {
      media = media.filter((m) => m.media_type === mediaTypeFilter.value);
    }

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      media = media.filter((m) => m.file_name.toLowerCase().includes(query));
    }

    // Sort by most recently used
    media.sort((a, b) => new Date(b.last_used_at || 0).getTime() - new Date(a.last_used_at || 0).getTime());

    return media;
  });

  const filteredClips = computed(() => {
    let filtered = clips.value;

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
    }

    return filtered;
  });

  const filteredRawVideos = computed(() => {
    let filtered = rawVideos.value;

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((v) => v.name.toLowerCase().includes(query));
    }

    return filtered;
  });

  function formatDuration(seconds: number | null): string {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getThumbnailUrl(id: string): string | null {
    return thumbnailCache.value.get(id) || null;
  }

  async function loadProjectMedia() {
    if (!props.projectId) return;

    loading.value = true;
    try {
      projectMedia.value = await getProjectMedia(props.projectId);
    } catch (error) {
      console.error('[MediaTab] Failed to load project media:', error);
    } finally {
      loading.value = false;
    }
  }

  async function loadOrgAssets() {
    if (!hasOrganizations.value) return;
    try {
      const response = await getUserOrganizationAssets();
      if (response.success) {
        // Filter to only media types (image, audio) - not intro/outro/watermark
        orgAssets.value = response.assets.filter((a) => a.asset_type === 'image' || a.asset_type === 'audio');
      }
    } catch (error) {
      console.error('[MediaTab] Failed to load org assets:', error);
    }
  }

  async function loadLibrary() {
    libraryLoading.value = true;
    try {
      const projectList = await getAllProjects();
      projectNames.value = new Map(projectList.map((p) => [String(p.id), p.name]));

      const [allClips, allRawVideos] = await Promise.all([getAllClips(), getAllRawVideos()]);

      clips.value = allClips
        .filter((c) => c.built_file_path && c.build_status === 'completed')
        .map((c) => ({
          id: String(c.id),
          type: 'clip' as const,
          name: c.name || 'Untitled Clip',
          path: c.built_file_path!,
          thumbnailPath: c.built_thumbnail_path || null,
          duration: c.built_duration ?? c.duration ?? null,
          projectId: c.project_id ? String(c.project_id) : null,
          projectName: c.project_id ? projectNames.value.get(String(c.project_id)) || null : null,
        }));

      rawVideos.value = allRawVideos.map((v) => ({
        id: String(v.id),
        type: 'raw_video' as const,
        name: v.original_filename || 'Untitled Video',
        path: v.file_path,
        thumbnailPath: v.thumbnail_path,
        duration: v.duration,
        projectId: v.project_id ? String(v.project_id) : null,
        projectName: v.project_id ? projectNames.value.get(String(v.project_id)) || null : null,
      }));

      // Load thumbnails
      await Promise.all([
        ...clips.value.map((c) => loadThumbnail(c.id, c.thumbnailPath)),
        ...rawVideos.value.map((v) => loadThumbnail(v.id, v.thumbnailPath)),
      ]);
    } catch (error) {
      console.error('[MediaTab] Failed to load library:', error);
    } finally {
      libraryLoading.value = false;
    }
  }

  async function loadThumbnail(id: string, path: string | null): Promise<void> {
    if (thumbnailCache.value.has(id) || !path) return;
    try {
      const exists = await invoke<boolean>('check_file_exists', { path });
      if (exists) {
        const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: path });
        thumbnailCache.value.set(id, dataUrl);
      }
    } catch (err) {
      console.warn('[MediaTab] Failed to load thumbnail:', err);
    }
  }

  async function addMediaToTimeline(media: ProjectMedia & { isOrgAsset?: boolean }) {
    // Record usage (only for non-org assets)
    if (!media.isOrgAsset) {
      await recordMediaUsage(media.id);
    }

    // Emit based on type
    if (media.media_type === 'video') {
      emit('addSource', {
        id: media.id,
        type: 'raw_video',
        name: media.file_name,
        path: media.file_path,
        thumbnailPath: media.thumbnail_path,
        duration: media.duration,
        projectId: media.project_id,
        projectName: null,
      });
    } else if (media.media_type === 'audio') {
      emit('importFile', media.file_path, media.file_name, media.duration || 0, media.thumbnail_path || undefined);
    } else if (media.media_type === 'image') {
      emit('addProjectMedia', media);
    }

    // Refresh to update sort order (only if not org asset)
    if (!media.isOrgAsset) {
      await loadProjectMedia();
    }
  }

  function onDragStart(event: DragEvent, type: 'clip' | 'raw_video', source: SourceItem) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({ type, source }));
  }

  function addSourceToTimeline(type: 'clip' | 'raw_video', source: SourceItem) {
    emit('addSource', { ...source, type });
  }

  async function handleAssetUploaded() {
    // Reload all asset data when an asset is uploaded via the dialog
    await Promise.all([loadProjectMedia(), loadWatermarkImages(), loadOrgAssets()]);
  }

  // ==================== Watermark Methods ====================

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getWatermarkConfig(watermark: ClipWatermark) {
    const ratio = props.previewAspectRatio;
    const ratioConfig = watermark.perRatioConfigs?.[ratio];
    return ratioConfig || { position: watermark.position, scale: watermark.scale, opacity: watermark.opacity };
  }

  function isNearPosition(watermark: ClipWatermark, x: number, y: number): boolean {
    const config = getWatermarkConfig(watermark);
    const threshold = 10;
    return Math.abs(config.position.x - x) < threshold && Math.abs(config.position.y - y) < threshold;
  }

  function selectWatermark(id: string) {
    selectedWatermarkId.value = selectedWatermarkId.value === id ? null : id;
  }

  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  function updateWatermark(watermarkId: string, key: keyof ClipWatermark, value: any) {
    emit('updateWatermark', watermarkId, { [key]: value });
  }

  function updateWatermarkConfig(watermarkId: string, key: 'scale' | 'opacity' | 'position', value: any) {
    const watermark = props.watermarks.find((w) => w.id === watermarkId);
    if (!watermark) return;

    const ratio = props.previewAspectRatio;
    const perRatioConfigs = watermark.perRatioConfigs ? { ...watermark.perRatioConfigs } : {};
    const currentConfig = perRatioConfigs[ratio] || {
      position: { ...watermark.position },
      scale: watermark.scale,
      opacity: watermark.opacity,
    };

    if (key === 'position') {
      currentConfig.position = value;
    } else {
      currentConfig[key] = value;
    }
    perRatioConfigs[ratio] = currentConfig;

    emit('updateWatermark', watermarkId, { perRatioConfigs });
  }

  function setWatermarkPosition(watermarkId: string, x: number, y: number) {
    updateWatermarkConfig(watermarkId, 'position', { x, y });
  }

  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return !!(config && config.regions && config.regions.length > 0);
  }

  const configuredAspectRatios = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => isRatioConfigured(ratio));
  });

  // Watermark library filtered lists
  const personalWatermarksFiltered = computed(() => {
    if (!searchQuery.value) return personalWatermarks.value;
    const query = searchQuery.value.toLowerCase();
    return personalWatermarks.value.filter((w) => w.name.toLowerCase().includes(query));
  });

  const orgWatermarksFiltered = computed(() => {
    if (!searchQuery.value) return orgWatermarks.value;
    const query = searchQuery.value.toLowerCase();
    return orgWatermarks.value.filter(
      (w) => w.name.toLowerCase().includes(query) || w.organization_name?.toLowerCase().includes(query)
    );
  });

  // Combined watermark count for filter
  const watermarkCount = computed(() => {
    return personalWatermarks.value.length + orgWatermarks.value.length;
  });

  // Combined all watermarks (personal + org) sorted by name
  const allWatermarks = computed(() => {
    return [...personalWatermarks.value, ...orgWatermarks.value].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Filtered combined watermarks list
  const allWatermarksFiltered = computed(() => {
    if (!searchQuery.value) return allWatermarks.value;
    const query = searchQuery.value.toLowerCase();
    return allWatermarks.value.filter(
      (w) => w.name.toLowerCase().includes(query) || w.organization_name?.toLowerCase().includes(query)
    );
  });

  function getWatermarkThumbnail(wm: WatermarkItem): string {
    const cached = watermarkThumbnailCache.value.get(wm.id);
    if (cached) return cached;

    if (wm.isOrgAsset && wm.thumbnail_path) {
      return wm.thumbnail_path;
    }
    if (wm.isOrgAsset && wm.serverUrl) {
      return wm.serverUrl;
    }

    return '';
  }

  async function loadWatermarkThumbnail(wm: WatermarkItem): Promise<void> {
    if (watermarkThumbnailCache.value.has(wm.id)) return;

    try {
      if (wm.isOrgAsset) {
        const url = wm.thumbnail_path || wm.serverUrl || wm.file_path;
        if (url) {
          watermarkThumbnailCache.value.set(wm.id, url);
        }
      } else if (wm.file_path) {
        const exists = await invoke<boolean>('check_file_exists', { path: wm.file_path });
        if (exists) {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: wm.file_path });
          watermarkThumbnailCache.value.set(wm.id, dataUrl);
        }
      }
    } catch (err) {
      console.warn('[MediaTab] Failed to load watermark thumbnail:', wm.id, err);
    }
  }

  async function loadWatermarkImages() {
    watermarkLibraryLoading.value = true;
    try {
      const localWatermarks = await getAllWatermarkImages();
      personalWatermarks.value = localWatermarks
        .filter((w) => !w.organization_id)
        .map((w) => ({ ...w, isOrgAsset: false }));

      if (hasOrganizations.value) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            orgWatermarks.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'watermark')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url,
                thumbnail_path: a.thumbnail_url || null,
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                width: a.width,
                height: a.height,
                file_size: null,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));
          }
        } catch (orgError) {
          console.warn('[MediaTab] Failed to load organization watermarks:', orgError);
        }
      }

      const allWatermarks = [...personalWatermarks.value, ...orgWatermarks.value];
      await Promise.all(allWatermarks.map((wm) => loadWatermarkThumbnail(wm)));
    } catch (err) {
      console.error('[MediaTab] Failed to load watermarks:', err);
    } finally {
      watermarkLibraryLoading.value = false;
    }
  }

  async function addWatermarkFromLibrary(wm: WatermarkItem) {
    try {
      let previewUrl: string;
      let filePathForEmit: string;

      if (wm.isOrgAsset) {
        previewUrl = wm.serverUrl || wm.file_path;
        filePathForEmit = wm.serverUrl || wm.file_path;
      } else {
        previewUrl =
          watermarkThumbnailCache.value.get(wm.id) ||
          (await invoke<string>('read_file_as_data_url', { filePath: wm.file_path }));
        filePathForEmit = wm.file_path;
      }

      emit('addWatermark', wm.id, filePathForEmit, previewUrl);
    } catch (err) {
      console.error('[MediaTab] Failed to add watermark:', err);
    }
  }

  let unregisterWatermarkUploadCallback: (() => void) | null = null;

  watch(
    () => props.projectId,
    () => {
      if (props.projectId) {
        loadProjectMedia();
      }
    },
    { immediate: true }
  );

  watch(
    () => authStore.user,
    (newUser, oldUser) => {
      const oldOrgId = oldUser?.owned_organization_id || oldUser?.created_by_organization_id;
      const newOrgId = newUser?.owned_organization_id || newUser?.created_by_organization_id;
      if (oldOrgId !== newOrgId) {
        loadOrgAssets();
      }
    },
    { deep: true }
  );

  onMounted(() => {
    loadLibrary();
    loadOrgAssets();
    loadWatermarkImages();
    unregisterWatermarkUploadCallback = onUploadComplete(() => {
      loadWatermarkImages();
    });
  });

  onUnmounted(() => {
    if (unregisterWatermarkUploadCallback) {
      unregisterWatermarkUploadCallback();
    }
  });
</script>

<style scoped>
  /* Custom scrollbar styling for library lists */
  .space-y-2::-webkit-scrollbar {
    width: 6px;
  }

  .space-y-2::-webkit-scrollbar-track {
    background: transparent;
  }

  .space-y-2::-webkit-scrollbar-thumb {
    background-color: var(--sidebar-border);
    border-radius: 3px;
  }

  .space-y-2::-webkit-scrollbar-thumb:hover {
    background-color: var(--sidebar-text-muted);
  }

  /* Firefox scrollbar */
  .space-y-2 {
    scrollbar-width: thin;
    scrollbar-color: var(--sidebar-border) transparent;
  }

  /* Smooth transitions for all interactive elements */
  button {
    transition: all 150ms ease;
  }

  /* Focus styles for accessibility */
  input:focus {
    outline: none;
  }

  /* Placeholder styling */
  input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  /* Watermark range input styling */
  .watermark-range {
    -webkit-appearance: none;
    appearance: none;
    background: var(--sidebar-border);
    border-radius: 4px;
  }

  .watermark-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--sidebar-text);
    cursor: pointer;
  }

  .watermark-range::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--sidebar-text);
    cursor: pointer;
    border: none;
  }

  /* Watermark scroll container */
  .watermark-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .watermark-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .watermark-scroll::-webkit-scrollbar-thumb {
    background: var(--sidebar-border);
    border-radius: 2px;
  }

  .watermark-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--sidebar-text-muted);
  }

  .watermark-scroll {
    scrollbar-width: thin;
    scrollbar-color: var(--sidebar-border) transparent;
  }

  /* Smooth transitions for watermark items */
  .watermark-asset {
    transition: all 150ms ease;
  }
</style>
