<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
    @click.self="$emit('close')"
  >
    <div class="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border shadow-xl">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
          <Plus class="w-5 h-5 text-green-500" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-foreground">Create New Clip</h2>
          <p class="text-sm text-muted-foreground">Manually mark a section as a clip</p>
        </div>
      </div>

      <div class="space-y-5">
        <!-- Time Range Display -->
        <div class="bg-muted/30 rounded-lg p-4 border border-border/50">
          <div class="flex items-center justify-between text-sm mb-2">
            <span class="text-muted-foreground">Time Range</span>
            <span class="text-muted-foreground">Duration: {{ formattedDuration }}</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 bg-background/50 rounded px-3 py-2 text-center font-mono text-foreground">
              {{ formattedStartTime }}
            </div>
            <ArrowRight class="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div class="flex-1 bg-background/50 rounded px-3 py-2 text-center font-mono text-foreground">
              {{ formattedEndTime }}
            </div>
          </div>
        </div>

        <!-- Clip Name Input -->
        <div class="space-y-2">
          <label for="clip-name" class="block text-sm font-medium text-foreground">Clip Name</label>
          <input
            id="clip-name"
            ref="nameInput"
            v-model="clipName"
            type="text"
            :placeholder="defaultClipName"
            class="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
            @keydown.enter="handleCreate"
            @keydown.escape="$emit('close')"
          />
          <p class="text-xs text-muted-foreground">Give your clip a descriptive name or leave empty for default</p>
        </div>

        <!-- Description Input (Optional) -->
        <div class="space-y-2">
          <label for="clip-description" class="block text-sm font-medium text-foreground">
            Description
            <span class="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="clip-description"
            v-model="clipDescription"
            rows="2"
            placeholder="Add notes about this clip..."
            class="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all resize-none"
            @keydown.escape="$emit('close')"
          />
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-2">
          <button
            class="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-all"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            class="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            @click="handleCreate"
          >
            <Plus class="w-4 h-4" />
            Create Clip
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import { Plus, ArrowRight } from 'lucide-vue-next';

  interface Props {
    show: boolean;
    startTime: number;
    endTime: number;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'create', data: { name: string; description: string }): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const clipName = ref('');
  const clipDescription = ref('');
  const nameInput = ref<HTMLInputElement | null>(null);

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

  // Focus input when dialog opens
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        // Reset form
        clipName.value = '';
        clipDescription.value = '';
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
</script>
