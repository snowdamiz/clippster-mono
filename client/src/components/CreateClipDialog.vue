<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
    >
      <Transition name="dialog" appear>
        <div
          class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />

          <div class="p-5 sm:p-6 lg:p-8">
            <!-- Header -->
            <div class="mb-4 sm:mb-6 text-center">
              <div
                class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-3 sm:mb-4"
              >
                <Plus class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-emerald-400" />
              </div>
              <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                {{ mode === 'new' ? 'Create New Clip' : 'Add Segment to Clip' }}
              </h2>
              <p class="text-zinc-400 text-xs sm:text-sm mt-1">
                {{ mode === 'new' ? 'Manually mark a section as a clip' : 'Add this section to an existing clip' }}
              </p>
            </div>

            <div class="space-y-4 sm:space-y-5">
              <!-- Time Range Display -->
              <div class="bg-zinc-900/80 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-zinc-800">
                <div class="flex items-center justify-between text-xs sm:text-sm mb-2 sm:mb-3">
                  <span class="text-zinc-400">Time Range</span>
                  <span class="text-emerald-400 font-medium">Duration: {{ formattedDuration }}</span>
                </div>
                <div class="flex items-center gap-2 sm:gap-3">
                  <div
                    class="flex-1 bg-zinc-950 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-center font-mono text-white text-xs sm:text-sm border border-zinc-800"
                  >
                    {{ formattedStartTime }}
                  </div>
                  <ArrowRight class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 flex-shrink-0" />
                  <div
                    class="flex-1 bg-zinc-950 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-center font-mono text-white text-xs sm:text-sm border border-zinc-800"
                  >
                    {{ formattedEndTime }}
                  </div>
                </div>
              </div>

              <!-- Mode Toggle (only show if there are existing clips) -->
              <div v-if="existingClips.length > 0" class="space-y-2 sm:space-y-3">
                <div class="flex rounded-lg sm:rounded-xl bg-zinc-900/50 p-1 border border-zinc-800">
                  <button
                    :class="[
                      'flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all',
                      mode === 'new' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-300',
                    ]"
                    @click="mode = 'new'"
                  >
                    <span class="flex items-center justify-center gap-1.5 sm:gap-2">
                      <Plus class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      New Clip
                    </span>
                  </button>
                  <button
                    :class="[
                      'flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all',
                      mode === 'existing' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-300',
                    ]"
                    @click="mode = 'existing'"
                  >
                    <span class="flex items-center justify-center gap-1.5 sm:gap-2">
                      <Layers class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Add to Existing
                    </span>
                  </button>
                </div>
              </div>

              <!-- New Clip Form -->
              <template v-if="mode === 'new'">
                <!-- Clip Name Input -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="clip-name" class="block text-xs sm:text-sm font-medium text-zinc-300">Clip Name</label>
                  <input
                    id="clip-name"
                    ref="nameInput"
                    v-model="clipName"
                    type="text"
                    :placeholder="defaultClipName"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    @keydown.enter="handleCreate"
                    @keydown.escape="$emit('close')"
                  />
                  <p class="text-[10px] sm:text-xs text-zinc-500">
                    Give your clip a descriptive name or leave empty for default
                  </p>
                </div>

                <!-- Description Input (Optional) -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="clip-description" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Description
                    <span class="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="clip-description"
                    v-model="clipDescription"
                    rows="2"
                    placeholder="Add notes about this clip..."
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                    @keydown.escape="$emit('close')"
                  />
                </div>
              </template>

              <!-- Existing Clip Selection -->
              <template v-else>
                <div class="space-y-1.5 sm:space-y-2">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">Select Clip</label>
                  <div class="relative clip-dropdown-container">
                    <button
                      type="button"
                      @click="showClipDropdown = !showClipDropdown"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-left flex items-center justify-between hover:border-zinc-700 transition-colors text-sm"
                    >
                      <span class="truncate" :class="selectedClipId ? 'text-white' : 'text-zinc-500'">
                        {{
                          selectedClip
                            ? (selectedClip.title || selectedClip.name || 'Untitled Clip') +
                              ` (${selectedClip.segmentCount} segment${selectedClip.segmentCount !== 1 ? 's' : ''})`
                            : 'Choose a clip...'
                        }}
                      </span>
                      <ChevronDown
                        class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 transition-transform flex-shrink-0 ml-2"
                        :class="{ 'rotate-180': showClipDropdown }"
                      />
                    </button>

                    <!-- Dropdown -->
                    <div
                      v-if="showClipDropdown"
                      class="absolute top-full left-0 right-0 mt-1.5 sm:mt-2 bg-zinc-900 border border-zinc-800 rounded-lg sm:rounded-xl overflow-hidden z-10 max-h-48 sm:max-h-60 overflow-y-auto custom-scrollbar"
                    >
                      <button
                        v-for="clip in existingClips"
                        :key="clip.id"
                        type="button"
                        @click="selectClip(clip)"
                        class="block w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-zinc-800/80 transition-colors text-xs sm:text-sm"
                        :class="{ 'bg-blue-500/10 text-blue-400': selectedClipId === clip.id }"
                      >
                        {{ clip.title || clip.name || 'Untitled Clip' }} ({{ clip.segmentCount }} segment{{
                          clip.segmentCount !== 1 ? 's' : ''
                        }})
                      </button>
                    </div>
                  </div>
                  <p class="text-[10px] sm:text-xs text-zinc-500">
                    The selected time range will be added as a new segment to this clip
                  </p>
                </div>

                <!-- Selected clip preview -->
                <div v-if="selectedClip" class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Layers class="w-4 h-4 text-blue-400" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="font-medium text-white text-sm truncate">
                        {{ selectedClip.title || selectedClip.name || 'Untitled Clip' }}
                      </h4>
                      <p class="text-xs text-zinc-400 mt-0.5">
                        Currently has {{ selectedClip.segmentCount }} segment{{
                          selectedClip.segmentCount !== 1 ? 's' : ''
                        }}
                      </p>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Action Buttons -->
              <div class="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
                <button
                  class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                  @click="$emit('close')"
                >
                  Cancel
                </button>
                <button
                  v-if="mode === 'new'"
                  class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm"
                  @click="handleCreate"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative flex items-center justify-center gap-1.5 sm:gap-2">
                    <Plus class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Create Clip
                  </span>
                </button>
                <button
                  v-else
                  :disabled="!selectedClipId"
                  :class="[
                    'flex-1 px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-sm',
                    selectedClipId
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative overflow-hidden group'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
                  ]"
                  @click="handleAddSegment"
                >
                  <div
                    v-if="selectedClipId"
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative flex items-center gap-1.5 sm:gap-2">
                    <Layers class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Add Segment
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
  import { Plus, ArrowRight, Layers, ChevronDown } from 'lucide-vue-next';

  interface ExistingClip {
    id: string;
    title?: string;
    name?: string;
    segmentCount: number;
  }

  interface Props {
    show: boolean;
    startTime: number;
    endTime: number;
    existingClips?: ExistingClip[];
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'create', data: { name: string; description: string }): void;
    (e: 'addSegment', data: { clipId: string }): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    existingClips: () => [],
  });
  const emit = defineEmits<Emits>();

  const mode = ref<'new' | 'existing'>('new');
  const clipName = ref('');
  const clipDescription = ref('');
  const selectedClipId = ref('');
  const nameInput = ref<HTMLInputElement | null>(null);
  const showClipDropdown = ref(false);

  // Close dropdown when clicking outside
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.clip-dropdown-container')) {
      showClipDropdown.value = false;
    }
  }

  function selectClip(clip: ExistingClip) {
    selectedClipId.value = clip.id;
    showClipDropdown.value = false;
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Format time as HH:MM:SS.ms
  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  // Format duration for display
  function formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  }

  const formattedStartTime = computed(() => formatTime(props.startTime));
  const formattedEndTime = computed(() => formatTime(props.endTime));
  const formattedDuration = computed(() => formatDuration(props.endTime - props.startTime));

  const defaultClipName = computed(() => {
    return `Clip at ${formatTime(props.startTime)}`;
  });

  const selectedClip = computed(() => {
    if (!selectedClipId.value) return null;
    return props.existingClips.find((c) => c.id === selectedClipId.value) || null;
  });

  // Focus input when dialog opens
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        // Reset form
        mode.value = 'new';
        clipName.value = '';
        clipDescription.value = '';
        selectedClipId.value = '';
        showClipDropdown.value = false;
        // Focus the input after next tick
        nextTick(() => {
          nameInput.value?.focus();
        });
      }
    }
  );

  function handleCreate() {
    const name = clipName.value.trim() || defaultClipName.value;
    emit('create', {
      name,
      description: clipDescription.value.trim(),
    });
  }

  function handleAddSegment() {
    if (!selectedClipId.value) return;
    emit('addSegment', {
      clipId: selectedClipId.value,
    });
  }
</script>

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
