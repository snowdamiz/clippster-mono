<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      @click.self="close"
    >
      <div class="bg-card rounded-xl w-full max-w-4xl mx-4 border border-border shadow-2xl max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-gradient-to-r from-[#070707] to-[#0a0a0a] rounded-t-xl"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/30"
            >
              <WrenchIcon class="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">Export Configuration</h2>
              <p class="text-xs text-muted-foreground">
                {{ clip?.current_version_name || clip?.name || 'Untitled Clip' }} • {{ formatDuration(clipDuration) }}
              </p>
            </div>
          </div>
          <button @click="close" class="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-foreground/70 hover:text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content - Two Column Layout -->
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <div class="p-6 grid grid-cols-2 gap-6">
            <!-- Left Column: Aspect Ratios -->
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground mb-1">Aspect Ratios</h3>
                <p class="text-xs text-muted-foreground">
                  Select target platforms ({{ selectedRatios.length }} selected)
                </p>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <!-- 16:9 Landscape -->
                <button
                  @click="toggleRatio('16:9')"
                  :class="[
                    'group relative overflow-hidden rounded-xl border-2 transition-all',
                    selectedRatios.includes('16:9')
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                  ]"
                >
                  <div class="p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-bold text-foreground">16:9</span>
                      <div
                        :class="[
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          selectedRatios.includes('16:9')
                            ? 'border-primary bg-primary scale-110'
                            : 'border-muted-foreground/30',
                        ]"
                      >
                        <CheckIcon v-if="selectedRatios.includes('16:9')" class="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div class="flex items-center justify-center py-3">
                      <div
                        class="w-16 h-9 border-2 border-current rounded transition-all"
                        :class="selectedRatios.includes('16:9') ? 'text-primary' : 'text-muted-foreground/40'"
                      ></div>
                    </div>
                    <div class="text-center">
                      <p class="text-xs font-medium text-muted-foreground">YouTube • Twitch</p>
                    </div>
                  </div>
                </button>

                <!-- 9:16 Portrait -->
                <button
                  @click="toggleRatio('9:16')"
                  :class="[
                    'group relative overflow-hidden rounded-xl border-2 transition-all',
                    selectedRatios.includes('9:16')
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                  ]"
                >
                  <div class="p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-bold text-foreground">9:16</span>
                      <div
                        :class="[
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          selectedRatios.includes('9:16')
                            ? 'border-primary bg-primary scale-110'
                            : 'border-muted-foreground/30',
                        ]"
                      >
                        <CheckIcon v-if="selectedRatios.includes('9:16')" class="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div class="flex items-center justify-center py-3">
                      <div
                        class="w-5 h-9 border-2 border-current rounded transition-all"
                        :class="selectedRatios.includes('9:16') ? 'text-primary' : 'text-muted-foreground/40'"
                      ></div>
                    </div>
                    <div class="text-center">
                      <p class="text-xs font-medium text-muted-foreground">TikTok • Reels</p>
                    </div>
                  </div>
                </button>

                <!-- 1:1 Square -->
                <button
                  @click="toggleRatio('1:1')"
                  :class="[
                    'group relative overflow-hidden rounded-xl border-2 transition-all',
                    selectedRatios.includes('1:1')
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                  ]"
                >
                  <div class="p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-bold text-foreground">1:1</span>
                      <div
                        :class="[
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          selectedRatios.includes('1:1')
                            ? 'border-primary bg-primary scale-110'
                            : 'border-muted-foreground/30',
                        ]"
                      >
                        <CheckIcon v-if="selectedRatios.includes('1:1')" class="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div class="flex items-center justify-center py-3">
                      <div
                        class="w-9 h-9 border-2 border-current rounded transition-all"
                        :class="selectedRatios.includes('1:1') ? 'text-primary' : 'text-muted-foreground/40'"
                      ></div>
                    </div>
                    <div class="text-center">
                      <p class="text-xs font-medium text-muted-foreground">Instagram Feed</p>
                    </div>
                  </div>
                </button>

                <!-- 4:5 Portrait -->
                <button
                  @click="toggleRatio('4:5')"
                  :class="[
                    'group relative overflow-hidden rounded-xl border-2 transition-all',
                    selectedRatios.includes('4:5')
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                  ]"
                >
                  <div class="p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-bold text-foreground">4:5</span>
                      <div
                        :class="[
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          selectedRatios.includes('4:5')
                            ? 'border-primary bg-primary scale-110'
                            : 'border-muted-foreground/30',
                        ]"
                      >
                        <CheckIcon v-if="selectedRatios.includes('4:5')" class="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div class="flex items-center justify-center py-3">
                      <div
                        class="w-7 h-9 border-2 border-current rounded transition-all"
                        :class="selectedRatios.includes('4:5') ? 'text-primary' : 'text-muted-foreground/40'"
                      ></div>
                    </div>
                    <div class="text-center">
                      <p class="text-xs font-medium text-muted-foreground">Instagram Post</p>
                    </div>
                  </div>
                </button>
              </div>

              <!-- Intro/Outro Compact -->
              <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-3">
                <h4 class="text-sm font-semibold text-foreground">Add-ons</h4>

                <!-- Intro Compact Selector -->
                <div class="space-y-2">
                  <label class="text-xs font-medium text-muted-foreground">Intro</label>
                  <div class="relative">
                    <button
                      ref="introButtonRef"
                      @click="toggleIntroDropdown"
                      class="w-full px-3 py-2 bg-muted/50 border border-border/40 rounded-lg text-left flex items-center justify-between hover:border-border hover:bg-muted/60 transition-all text-sm text-foreground"
                    >
                      <span class="truncate">
                        {{
                          selectedIntro
                            ? `${selectedIntro.name} (${formatDuration(selectedIntro.duration || 0)})`
                            : 'None'
                        }}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2"
                        :class="{ 'rotate-180': showIntroDropdown }"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <!-- Dropdown - Teleported -->
                    <Teleport to="body">
                      <div
                        v-if="showIntroDropdown"
                        ref="introDropdownRef"
                        class="fixed bg-card border border-border rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar"
                        :style="{
                          top: introDropdownPosition.top,
                          left: introDropdownPosition.left,
                          width: introDropdownPosition.width,
                          maxHeight: introDropdownPosition.maxHeight,
                        }"
                        @click.stop
                      >
                        <button
                          @click="selectIntro(null)"
                          class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm border-b border-border/30"
                          :class="{ 'bg-primary/10 text-primary': !selectedIntro }"
                        >
                          None
                        </button>
                        <button
                          v-for="intro in intros"
                          :key="intro.id"
                          @click="selectIntro(intro)"
                          class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm"
                          :class="{ 'bg-primary/10 text-primary': selectedIntro?.id === intro.id }"
                        >
                          <div class="flex items-center justify-between">
                            <span class="truncate">{{ intro.name }}</span>
                            <span class="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {{ formatDuration(intro.duration || 0) }}
                            </span>
                          </div>
                        </button>
                        <div v-if="loadingAssets" class="px-3 py-2.5 text-sm text-center text-muted-foreground">
                          Loading...
                        </div>
                        <div
                          v-if="!loadingAssets && intros.length === 0"
                          class="px-3 py-2.5 text-sm text-center text-muted-foreground"
                        >
                          No intros available
                        </div>
                      </div>
                    </Teleport>
                  </div>
                </div>

                <!-- Outro Compact Selector -->
                <div class="space-y-2">
                  <label class="text-xs font-medium text-muted-foreground">Outro</label>
                  <div class="relative">
                    <button
                      ref="outroButtonRef"
                      @click="toggleOutroDropdown"
                      class="w-full px-3 py-2 bg-muted/50 border border-border/40 rounded-lg text-left flex items-center justify-between hover:border-border hover:bg-muted/60 transition-all text-sm text-foreground"
                    >
                      <span class="truncate">
                        {{
                          selectedOutro
                            ? `${selectedOutro.name} (${formatDuration(selectedOutro.duration || 0)})`
                            : 'None'
                        }}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2"
                        :class="{ 'rotate-180': showOutroDropdown }"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <!-- Dropdown - Teleported -->
                    <Teleport to="body">
                      <div
                        v-if="showOutroDropdown"
                        ref="outroDropdownRef"
                        class="fixed bg-card border border-border rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar"
                        :style="{
                          top: outroDropdownPosition.top,
                          left: outroDropdownPosition.left,
                          width: outroDropdownPosition.width,
                          maxHeight: outroDropdownPosition.maxHeight,
                        }"
                        @click.stop
                      >
                        <button
                          @click="selectOutro(null)"
                          class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm border-b border-border/30"
                          :class="{ 'bg-primary/10 text-primary': !selectedOutro }"
                        >
                          None
                        </button>
                        <button
                          v-for="outro in outros"
                          :key="outro.id"
                          @click="selectOutro(outro)"
                          class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm"
                          :class="{ 'bg-primary/10 text-primary': selectedOutro?.id === outro.id }"
                        >
                          <div class="flex items-center justify-between">
                            <span class="truncate">{{ outro.name }}</span>
                            <span class="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {{ formatDuration(outro.duration || 0) }}
                            </span>
                          </div>
                        </button>
                        <div v-if="loadingAssets" class="px-3 py-2.5 text-sm text-center text-muted-foreground">
                          Loading...
                        </div>
                        <div
                          v-if="!loadingAssets && outros.length === 0"
                          class="px-3 py-2.5 text-sm text-center text-muted-foreground"
                        >
                          No outros available
                        </div>
                      </div>
                    </Teleport>
                  </div>
                </div>

                <!-- Duration Summary -->
                <div v-if="selectedIntro || selectedOutro" class="pt-2 border-t border-border/30">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted-foreground">Total Duration</span>
                    <span class="font-semibold text-primary">{{ formatDuration(totalDuration) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Export Settings -->
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground mb-1">Video Settings</h3>
                <p class="text-xs text-muted-foreground">Configure quality and export options</p>
              </div>

              <div class="space-y-3">
                <!-- Quality -->
                <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-sm font-semibold text-foreground">Quality</label>
                    <span class="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded capitalize">
                      {{ quality }}
                    </span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="quality = 'low'"
                      :class="[
                        'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        quality === 'low'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      ]"
                    >
                      Low
                    </button>
                    <button
                      @click="quality = 'medium'"
                      :class="[
                        'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        quality === 'medium'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      ]"
                    >
                      Medium
                    </button>
                    <button
                      @click="quality = 'high'"
                      :class="[
                        'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        quality === 'high'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      ]"
                    >
                      High
                    </button>
                  </div>
                  <p class="text-[10px] text-muted-foreground/70 mt-1">
                    {{
                      quality === 'low'
                        ? 'Fast export, smaller file'
                        : quality === 'medium'
                          ? 'Balanced quality'
                          : 'Best quality, larger file'
                    }}
                  </p>
                </div>

                <!-- Frame Rate -->
                <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-sm font-semibold text-foreground">Frame Rate</label>
                    <span class="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                      {{ frameRate }} FPS
                    </span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="frameRate = 30"
                      :class="[
                        'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        frameRate === 30
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      ]"
                    >
                      30 FPS
                    </button>
                    <button
                      @click="frameRate = 60"
                      :class="[
                        'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        frameRate === 60
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      ]"
                    >
                      60 FPS
                    </button>
                  </div>
                  <p class="text-[10px] text-muted-foreground/70 mt-1">
                    {{ frameRate === 30 ? 'Standard for most platforms' : 'Smoother motion for fast content' }}
                  </p>
                </div>

                <!-- Format & Subtitles -->
                <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-3">
                  <!-- Format -->
                  <div class="space-y-2">
                    <label class="text-sm font-semibold text-foreground">Output Format</label>
                    <div class="flex gap-2">
                      <button
                        @click="outputFormat = 'mp4'"
                        :class="[
                          'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                          outputFormat === 'mp4'
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                        ]"
                      >
                        MP4
                      </button>
                      <button
                        @click="outputFormat = 'mov'"
                        :class="[
                          'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                          outputFormat === 'mov'
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                        ]"
                      >
                        MOV
                      </button>
                    </div>
                  </div>

                  <!-- Subtitles Toggle -->
                  <div class="pt-3 border-t border-border/30">
                    <button
                      @click="includeSubtitles = !includeSubtitles"
                      type="button"
                      :class="[
                        'w-full flex items-center justify-between p-3 rounded-lg transition-all',
                        includeSubtitles
                          ? 'bg-primary/15 border-2 border-primary'
                          : 'bg-muted/50 border-2 border-border/40 hover:border-border',
                      ]"
                    >
                      <div class="text-left">
                        <div class="text-sm font-semibold text-foreground">Include Subtitles</div>
                        <div class="text-xs text-muted-foreground mt-0.5">
                          {{ includeSubtitles ? 'Subtitles will be burned in' : 'No subtitles' }}
                        </div>
                      </div>
                      <div
                        :class="[
                          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all',
                          includeSubtitles ? 'bg-primary' : 'bg-muted-foreground/30',
                        ]"
                      >
                        <span
                          :class="[
                            'inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all',
                            includeSubtitles ? 'translate-x-[22px]' : 'translate-x-0.5',
                          ]"
                        ></span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/50 bg-muted/10">
          <div class="text-sm text-muted-foreground">
            <span v-if="selectedRatios.length === 0" class="text-amber-500">⚠ Select at least one aspect ratio</span>
            <span v-else>
              {{ selectedRatios.length }} aspect ratio{{ selectedRatios.length > 1 ? 's' : '' }} selected
            </span>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="close"
              class="px-5 py-2.5 text-sm font-medium text-foreground bg-transparent hover:bg-muted/50 border border-border rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              @click="confirmBuild"
              :disabled="selectedRatios.length === 0"
              :class="[
                'flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all',
                selectedRatios.length === 0
                  ? 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
              ]"
            >
              <WrenchIcon class="h-4 w-4" />
              <span>Build {{ selectedRatios.length > 1 ? `${selectedRatios.length} Videos` : 'Video' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { WrenchIcon, CheckIcon } from 'lucide-vue-next';
  import type { ClipWithVersion } from '@/services/database';
  import { getAllIntroOutros, type IntroOutro } from '@/services/database';
  import { convertFileSrc } from '@tauri-apps/api/core';

  const props = defineProps<{
    modelValue: boolean;
    clip: ClipWithVersion | null;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [settings: BuildSettings];
  }>();

  export interface BuildSettings {
    aspectRatios: string[];
    quality: 'low' | 'medium' | 'high';
    frameRate: 30 | 60;
    format: 'mp4' | 'mov';
    includeSubtitles: boolean;
    intro: IntroOutro | null;
    outro: IntroOutro | null;
  }

  // State
  const selectedRatios = ref<string[]>(['16:9']);
  const includeSubtitles = ref(true);
  const quality = ref<'low' | 'medium' | 'high'>('high');
  const frameRate = ref<30 | 60>(30);
  const outputFormat = ref<'mp4' | 'mov'>('mp4');
  const intros = ref<IntroOutro[]>([]);
  const outros = ref<IntroOutro[]>([]);
  const selectedIntro = ref<IntroOutro | null>(null);
  const selectedOutro = ref<IntroOutro | null>(null);
  const loadingAssets = ref(false);
  const showIntroDropdown = ref(false);
  const showOutroDropdown = ref(false);
  const introButtonRef = ref<HTMLElement | null>(null);
  const outroButtonRef = ref<HTMLElement | null>(null);
  const introDropdownRef = ref<HTMLElement | null>(null);
  const outroDropdownRef = ref<HTMLElement | null>(null);
  const introDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });
  const outroDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });

  // Computed
  const clipDuration = computed(() => {
    if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
      return 0;
    }
    return props.clip.current_version_end_time - props.clip.current_version_start_time;
  });

  const totalDuration = computed(() => {
    let total = clipDuration.value;
    if (selectedIntro.value?.duration) total += selectedIntro.value.duration;
    if (selectedOutro.value?.duration) total += selectedOutro.value.duration;
    return total;
  });

  // Load intros and outros when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen && intros.value.length === 0 && outros.value.length === 0) {
        await loadIntroOutros();
      }
    }
  );

  onMounted(async () => {
    if (props.modelValue) {
      await loadIntroOutros();
    }
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Handle click outside to close dropdowns
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;

    if (
      showIntroDropdown.value &&
      introButtonRef.value &&
      !introButtonRef.value.contains(target) &&
      introDropdownRef.value &&
      !introDropdownRef.value.contains(target)
    ) {
      showIntroDropdown.value = false;
    }

    if (
      showOutroDropdown.value &&
      outroButtonRef.value &&
      !outroButtonRef.value.contains(target) &&
      outroDropdownRef.value &&
      !outroDropdownRef.value.contains(target)
    ) {
      showOutroDropdown.value = false;
    }
  }

  function calculateDropdownPosition(buttonRef: HTMLElement) {
    const rect = buttonRef.getBoundingClientRect();
    const dropdownHeight = 192; // max-h-48 = 192px
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spacing = 4;

    // Check if there's enough space below
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: string;
    let maxHeight = '192px'; // default max-h-48

    // If not enough space below but enough space above, show above
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      top = `${rect.top - dropdownHeight - spacing}px`;
      // If it would go off the top, limit the height
      if (rect.top - dropdownHeight - spacing < 0) {
        maxHeight = `${spaceAbove - spacing}px`;
        top = `${spacing}px`;
      }
    } else {
      // Show below
      top = `${rect.bottom + spacing}px`;
      // If it would go off the bottom, limit the height
      if (rect.bottom + spacing + dropdownHeight > viewportHeight) {
        maxHeight = `${spaceBelow - spacing}px`;
      }
    }

    // Handle horizontal positioning
    let left = `${rect.left}px`;
    let width = `${rect.width}px`;

    // Check if it would go off the right edge
    if (rect.left + rect.width > viewportWidth) {
      left = `${viewportWidth - rect.width - spacing}px`;
    }

    // Check if it would go off the left edge
    if (rect.left < 0) {
      left = `${spacing}px`;
    }

    return {
      top,
      left,
      width,
      maxHeight,
    };
  }

  function toggleIntroDropdown() {
    if (introButtonRef.value) {
      introDropdownPosition.value = calculateDropdownPosition(introButtonRef.value);
    }
    showIntroDropdown.value = !showIntroDropdown.value;
    showOutroDropdown.value = false;
  }

  function toggleOutroDropdown() {
    if (outroButtonRef.value) {
      outroDropdownPosition.value = calculateDropdownPosition(outroButtonRef.value);
    }
    showOutroDropdown.value = !showOutroDropdown.value;
    showIntroDropdown.value = false;
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      const allAssets = await getAllIntroOutros();
      intros.value = allAssets.filter((a) => a.type === 'intro');
      outros.value = allAssets.filter((a) => a.type === 'outro');
    } catch (error) {
      console.error('Failed to load intro/outros:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  function selectIntro(intro: IntroOutro | null) {
    selectedIntro.value = intro;
    showIntroDropdown.value = false;
  }

  function selectOutro(outro: IntroOutro | null) {
    selectedOutro.value = outro;
    showOutroDropdown.value = false;
  }

  function getThumbnailUrl(asset: IntroOutro): string | null {
    if (!asset.thumbnail_path) return null;
    return convertFileSrc(asset.thumbnail_path);
  }

  // Methods
  function toggleRatio(ratio: string) {
    const index = selectedRatios.value.indexOf(ratio);
    if (index > -1) {
      selectedRatios.value.splice(index, 1);
    } else {
      selectedRatios.value.push(ratio);
    }
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function close() {
    emit('update:modelValue', false);
  }

  function confirmBuild() {
    if (selectedRatios.value.length === 0) return;

    const settings: BuildSettings = {
      aspectRatios: selectedRatios.value,
      quality: quality.value,
      frameRate: frameRate.value,
      format: outputFormat.value,
      includeSubtitles: includeSubtitles.value,
      intro: selectedIntro.value,
      outro: selectedOutro.value,
    };

    emit('confirm', settings);
    close();
  }
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
