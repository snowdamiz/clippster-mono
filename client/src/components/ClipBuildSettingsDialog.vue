<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      @click.self="close"
    >
      <div class="bg-card rounded-lg w-full max-w-2xl mx-4 border border-border shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-[#070707] rounded-t-lg">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/30"
            >
              <WrenchIcon class="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">Build Clip</h2>
              <p class="text-xs text-muted-foreground">Configure export settings</p>
            </div>
          </div>
          <button @click="close" class="p-2 hover:bg-[#ffffff]/10 rounded-md transition-colors" title="Close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-foreground/70 hover:text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <!-- Clip Info -->
          <div class="bg-muted/30 rounded-lg p-4 border border-border/50">
            <h3 class="text-sm font-semibold text-foreground mb-2">Clip Details</h3>
            <div class="space-y-1.5 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Name:</span>
                <span class="font-medium text-foreground">
                  {{ clip?.current_version_name || clip?.name || 'Untitled Clip' }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Duration:</span>
                <span class="font-medium text-foreground">{{ formatDuration(clipDuration) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Segments:</span>
                <span class="font-medium text-foreground">{{ clip?.current_version_segments?.length || 0 }}</span>
              </div>
            </div>
          </div>

          <!-- Aspect Ratios Section -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-foreground">Aspect Ratios</h3>
              <span class="text-xs text-muted-foreground">{{ selectedRatios.length }} selected</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <!-- 16:9 Landscape -->
              <button
                @click="toggleRatio('16:9')"
                :class="[
                  'group relative overflow-hidden rounded-lg border-2 transition-all duration-200',
                  selectedRatios.includes('16:9')
                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                    : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/30',
                ]"
              >
                <div class="p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-foreground">16:9</span>
                    <div
                      :class="[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        selectedRatios.includes('16:9') ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                      ]"
                    >
                      <CheckIcon v-if="selectedRatios.includes('16:9')" class="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div class="flex items-center justify-center py-4">
                    <div
                      class="w-20 h-[45px] border-2 border-current rounded-sm"
                      :class="selectedRatios.includes('16:9') ? 'text-primary' : 'text-muted-foreground/50'"
                    ></div>
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-medium text-muted-foreground">Landscape</p>
                    <p class="text-[10px] text-muted-foreground/70">YouTube, Desktop</p>
                  </div>
                </div>
              </button>

              <!-- 9:16 Portrait -->
              <button
                @click="toggleRatio('9:16')"
                :class="[
                  'group relative overflow-hidden rounded-lg border-2 transition-all duration-200',
                  selectedRatios.includes('9:16')
                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                    : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/30',
                ]"
              >
                <div class="p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-foreground">9:16</span>
                    <div
                      :class="[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        selectedRatios.includes('9:16') ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                      ]"
                    >
                      <CheckIcon v-if="selectedRatios.includes('9:16')" class="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div class="flex items-center justify-center py-4">
                    <div
                      class="w-[25px] h-[45px] border-2 border-current rounded-sm"
                      :class="selectedRatios.includes('9:16') ? 'text-primary' : 'text-muted-foreground/50'"
                    ></div>
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-medium text-muted-foreground">Portrait</p>
                    <p class="text-[10px] text-muted-foreground/70">TikTok, Instagram Reels</p>
                  </div>
                </div>
              </button>

              <!-- 1:1 Square -->
              <button
                @click="toggleRatio('1:1')"
                :class="[
                  'group relative overflow-hidden rounded-lg border-2 transition-all duration-200',
                  selectedRatios.includes('1:1')
                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                    : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/30',
                ]"
              >
                <div class="p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-foreground">1:1</span>
                    <div
                      :class="[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        selectedRatios.includes('1:1') ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                      ]"
                    >
                      <CheckIcon v-if="selectedRatios.includes('1:1')" class="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div class="flex items-center justify-center py-4">
                    <div
                      class="w-[45px] h-[45px] border-2 border-current rounded-sm"
                      :class="selectedRatios.includes('1:1') ? 'text-primary' : 'text-muted-foreground/50'"
                    ></div>
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-medium text-muted-foreground">Square</p>
                    <p class="text-[10px] text-muted-foreground/70">Instagram Feed</p>
                  </div>
                </div>
              </button>

              <!-- 4:5 Portrait -->
              <button
                @click="toggleRatio('4:5')"
                :class="[
                  'group relative overflow-hidden rounded-lg border-2 transition-all duration-200',
                  selectedRatios.includes('4:5')
                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                    : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/30',
                ]"
              >
                <div class="p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-foreground">4:5</span>
                    <div
                      :class="[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        selectedRatios.includes('4:5') ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                      ]"
                    >
                      <CheckIcon v-if="selectedRatios.includes('4:5')" class="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div class="flex items-center justify-center py-4">
                    <div
                      class="w-[36px] h-[45px] border-2 border-current rounded-sm"
                      :class="selectedRatios.includes('4:5') ? 'text-primary' : 'text-muted-foreground/50'"
                    ></div>
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-medium text-muted-foreground">Portrait</p>
                    <p class="text-[10px] text-muted-foreground/70">Instagram Portrait</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Additional Settings Section -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-foreground">Export Settings</h3>

            <!-- Quality Setting -->
            <div class="bg-muted/20 rounded-lg p-4 border border-border/40 space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-foreground">Quality</label>
                <span class="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded capitalize">
                  {{ quality }}
                </span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="quality = 'low'"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    quality === 'low'
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  Low
                </button>
                <button
                  @click="quality = 'medium'"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    quality === 'medium'
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  Medium
                </button>
                <button
                  @click="quality = 'high'"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    quality === 'high'
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  High
                </button>
              </div>
            </div>

            <!-- Frame Rate Setting -->
            <div class="bg-muted/20 rounded-lg p-4 border border-border/40 space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-foreground">Frame Rate</label>
                <span class="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  {{ frameRate }} FPS
                </span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="frameRate = 30"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    frameRate === 30
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  30 FPS
                </button>
                <button
                  @click="frameRate = 60"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    frameRate === 60
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  60 FPS
                </button>
              </div>
            </div>

            <!-- Output Format -->
            <div class="bg-muted/20 rounded-lg p-4 border border-border/40 space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-foreground">Output Format</label>
                <span class="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded uppercase">
                  {{ outputFormat }}
                </span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="outputFormat = 'mp4'"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    outputFormat === 'mp4'
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  MP4
                </button>
                <button
                  @click="outputFormat = 'mov'"
                  :class="[
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    outputFormat === 'mov'
                      ? 'bg-primary text-primary-foreground border border-primary'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40',
                  ]"
                >
                  MOV
                </button>
              </div>
            </div>
          </div>

          <!-- Include Subtitles Toggle -->
          <div class="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/40">
            <div>
              <h4 class="text-sm font-medium text-foreground">Include Subtitles</h4>
              <p class="text-xs text-muted-foreground mt-0.5">Burn subtitles into the video</p>
            </div>
            <button
              @click="includeSubtitles = !includeSubtitles"
              type="button"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                includeSubtitles ? 'bg-primary' : 'bg-muted-foreground/30',
              ]"
            >
              <span
                :class="[
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                  includeSubtitles ? 'translate-x-[22px]' : 'translate-x-0.5',
                ]"
              ></span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            @click="close"
            class="px-4 py-2.5 text-sm font-medium text-foreground bg-muted/50 hover:bg-muted border border-border rounded-md transition-all"
          >
            Cancel
          </button>
          <button
            @click="confirmBuild"
            :disabled="selectedRatios.length === 0"
            :class="[
              'flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-all',
              selectedRatios.length === 0
                ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
            ]"
          >
            <WrenchIcon class="h-4 w-4" />
            <span>Build {{ selectedRatios.length > 1 ? `${selectedRatios.length} Clips` : 'Clip' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { WrenchIcon, CheckIcon } from 'lucide-vue-next';
  import type { ClipWithVersion } from '@/services/database';

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
  }

  // State
  const selectedRatios = ref<string[]>(['16:9']);
  const includeSubtitles = ref(true);
  const quality = ref<'low' | 'medium' | 'high'>('high');
  const frameRate = ref<30 | 60>(30);
  const outputFormat = ref<'mp4' | 'mov'>('mp4');

  // Computed
  const clipDuration = computed(() => {
    if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
      return 0;
    }
    return props.clip.current_version_end_time - props.clip.current_version_start_time;
  });

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
