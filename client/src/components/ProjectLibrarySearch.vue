<template>
<SearchPalette
      v-model="showSearchPalette"
      :search-query="paletteSearchQuery"
      :active-tab="paletteActiveTab"
      :placeholder="
        paletteActiveTab === 'search'
          ? 'Search projects by name or description...'
          : paletteActiveTab === 'live'
            ? 'Filter live projects...'
            : 'Filter projects with clips...'
      "
      :tabs="projectsPaletteTabs"
      @update:search-query="paletteSearchQuery = $event"
      @update:active-tab="onPaletteTabChange"
      @close="closeSearchPalette"
    >
      <!-- Search Results -->
      <template v-if="paletteSearchResults.length > 0">
        <div class="search-palette__results">
          <div class="search-palette__results-header">
            <span class="search-palette__results-label">
              {{
                paletteActiveTab === 'live'
                  ? 'Live Projects'
                  : paletteActiveTab === 'with_clips'
                    ? 'Projects with Clips'
                    : 'Results'
              }}
            </span>
            <span class="search-palette__results-count">{{ paletteSearchResults.length }} found</span>
          </div>
          <div class="search-palette__list">
            <div
              v-for="item in paletteSearchResults"
              :key="item.id"
              class="search-palette__item"
              @click="selectPaletteResult(item)"
            >
              <div class="search-palette__item-thumb-wrap">
                <div
                  v-if="item.thumbnailUrl"
                  class="search-palette__item-thumb"
                  :style="{ backgroundImage: `url(${item.thumbnailUrl})` }"
                ></div>
                <div v-else class="search-palette__item-thumb search-palette__item-thumb--empty">
                  <Folder class="w-5 h-5" />
                </div>
                <div v-if="item.isLive" class="search-palette__item-live-badge" title="Live">
                  <Radio class="w-3 h-3" />
                </div>
              </div>

              <div class="search-palette__item-content">
                <div class="search-palette__item-title">{{ item.project.name }}</div>
                <div class="search-palette__item-meta">
                  <!-- Platform -->
                  <span v-if="item.platform" class="search-palette__item-platform">
                    {{ item.platform }}
                  </span>
                  <!-- Live Badge -->
                  <span v-if="item.isLive" class="search-palette__item-live-tag">
                    <span class="search-palette__live-dot"></span>
                    Live
                  </span>
                  <!-- Clip Count -->
                  <span v-if="item.clipCount > 0" class="search-palette__item-clips">
                    {{ item.clipCount }} clip{{ item.clipCount !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>

              <div class="search-palette__item-arrow">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- No Results -->
      <template v-else-if="paletteSearchQuery || paletteActiveTab !== 'search'">
        <div class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap">
            <Search v-if="paletteActiveTab === 'search'" class="search-palette__empty-icon" />
            <Radio v-else-if="paletteActiveTab === 'live'" class="search-palette__empty-icon" />
            <Video v-else class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">
            {{
              paletteActiveTab === 'live'
                ? 'No live projects'
                : paletteActiveTab === 'with_clips'
                  ? 'No projects with clips'
                  : 'No projects found'
            }}
          </h3>
          <p class="search-palette__empty-desc">
            {{
              paletteActiveTab === 'live'
                ? 'Start monitoring a livestream to see it here'
                : paletteActiveTab === 'with_clips'
                  ? 'Detect clips in your projects to see them here'
                  : 'Try a different search term'
            }}
          </p>
        </div>
      </template>

      <!-- Initial State -->
      <template v-else>
        <div class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap search-palette__empty-icon-wrap--subtle">
            <Search class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">Search your projects</h3>
          <p class="search-palette__empty-desc">Find projects by name or description</p>
        </div>
      </template>
    </SearchPalette>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { Folder, Radio, Search, Video } from 'lucide-vue-next';
import SearchPalette from './SearchPalette.vue';
export default defineComponent({ components: { Folder, Radio, Search, Video, SearchPalette }, props: { model: { type: Object, required: true } }, setup(props) { return props.model; } });
</script>

