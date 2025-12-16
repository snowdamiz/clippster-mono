<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Intro & Outro</h3>
      <p class="text-xs text-white/50">Add intro and outro videos to your timeline.</p>
    </div>

    <!-- Upload Buttons -->
    <div class="grid grid-cols-2 gap-3">
      <button
        @click="uploadIntro"
        :disabled="isUploadingIntro"
        class="py-3 border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg text-sm text-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Loader2 v-if="isUploadingIntro" :size="16" class="animate-spin" />
        <Upload v-else :size="16" />
        {{ isUploadingIntro ? 'Uploading...' : 'Upload Intro' }}
      </button>
      <button
        @click="uploadOutro"
        :disabled="isUploadingOutro"
        class="py-3 border-2 border-dashed border-violet-500/30 hover:border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/10 rounded-lg text-sm text-violet-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Loader2 v-if="isUploadingOutro" :size="16" class="animate-spin" />
        <Upload v-else :size="16" />
        {{ isUploadingOutro ? 'Uploading...' : 'Upload Outro' }}
      </button>
    </div>

    <!-- Current Status -->
    <div v-if="currentIntro || currentOutro" class="space-y-2">
      <label class="text-xs font-medium text-white/70">Currently Applied</label>
      <div class="space-y-2">
        <!-- Current Intro -->
        <div
          v-if="currentIntro"
          class="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
        >
          <div class="w-12 h-8 rounded overflow-hidden bg-black/50 flex-shrink-0">
            <img
              v-if="currentIntro.thumbnailUrl"
              :src="currentIntro.thumbnailUrl"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="10" class="text-white/30" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-emerald-300 truncate">{{ currentIntro.name }}</div>
            <div class="text-[10px] text-white/40">Intro • {{ formatDuration(currentIntro.duration || 0) }}</div>
          </div>
          <button
            @click="removeIntro"
            class="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
            title="Remove intro"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- Current Outro -->
        <div
          v-if="currentOutro"
          class="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg"
        >
          <div class="w-12 h-8 rounded overflow-hidden bg-black/50 flex-shrink-0">
            <img
              v-if="currentOutro.thumbnailUrl"
              :src="currentOutro.thumbnailUrl"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="10" class="text-white/30" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-violet-300 truncate">{{ currentOutro.name }}</div>
            <div class="text-[10px] text-white/40">Outro • {{ formatDuration(currentOutro.duration || 0) }}</div>
          </div>
          <button
            @click="removeOutro"
            class="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
            title="Remove outro"
          >
            <X :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div v-if="currentIntro || currentOutro" class="h-px bg-white/10" />

    <!-- Intro Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-medium text-white/70">Available Intros</label>
        <span class="text-[10px] text-white/40">{{ intros.length }} available</span>
      </div>

      <!-- Loading State -->
      <div v-if="loadingAssets" class="flex items-center justify-center py-6">
        <Loader2 :size="20" class="animate-spin text-white/40" />
      </div>

      <!-- Empty State -->
      <div v-else-if="intros.length === 0" class="py-6 text-center">
        <Play :size="24" class="mx-auto text-white/20 mb-2" />
        <p class="text-xs text-white/40">No intros available</p>
        <p class="text-[10px] text-white/30 mt-1">Upload a video above to get started</p>
      </div>

      <!-- Intros Grid -->
      <div v-else class="grid grid-cols-2 gap-2">
        <button
          v-for="intro in intros"
          :key="intro.id"
          @click="addIntro(intro)"
          :disabled="currentIntro?.id === intro.id"
          :class="[
            'group relative p-2 rounded-lg border transition-all text-left',
            currentIntro?.id === intro.id
              ? 'bg-emerald-500/20 border-emerald-500/40 cursor-not-allowed'
              : 'bg-white/5 border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10',
          ]"
        >
          <!-- Thumbnail -->
          <div class="w-full aspect-video rounded overflow-hidden bg-black/50 mb-2">
            <img
              v-if="introThumbnails.get(intro.id)"
              :src="introThumbnails.get(intro.id)!"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="16" class="text-white/30" />
            </div>
          </div>
          <!-- Info -->
          <div class="text-xs font-medium text-white truncate">{{ intro.name }}</div>
          <div class="text-[10px] text-white/40">{{ formatDuration(intro.duration || 0) }}</div>
          <!-- Applied badge -->
          <div
            v-if="currentIntro?.id === intro.id"
            class="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-500/30 text-emerald-300 text-[9px] rounded"
          >
            Applied
          </div>
          <!-- Add overlay -->
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center bg-emerald-500/0 group-hover:bg-emerald-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Plus :size="20" class="text-emerald-400" />
          </div>
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-white/10" />

    <!-- Outro Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-medium text-white/70">Available Outros</label>
        <span class="text-[10px] text-white/40">{{ outros.length }} available</span>
      </div>

      <!-- Loading State -->
      <div v-if="loadingAssets" class="flex items-center justify-center py-6">
        <Loader2 :size="20" class="animate-spin text-white/40" />
      </div>

      <!-- Empty State -->
      <div v-else-if="outros.length === 0" class="py-6 text-center">
        <Play :size="24" class="mx-auto text-white/20 mb-2 rotate-180" />
        <p class="text-xs text-white/40">No outros available</p>
        <p class="text-[10px] text-white/30 mt-1">Upload a video above to get started</p>
      </div>

      <!-- Outros Grid -->
      <div v-else class="grid grid-cols-2 gap-2">
        <button
          v-for="outro in outros"
          :key="outro.id"
          @click="addOutro(outro)"
          :disabled="currentOutro?.id === outro.id"
          :class="[
            'group relative p-2 rounded-lg border transition-all text-left',
            currentOutro?.id === outro.id
              ? 'bg-violet-500/20 border-violet-500/40 cursor-not-allowed'
              : 'bg-white/5 border-white/10 hover:border-violet-500/40 hover:bg-violet-500/10',
          ]"
        >
          <!-- Thumbnail -->
          <div class="w-full aspect-video rounded overflow-hidden bg-black/50 mb-2">
            <img
              v-if="outroThumbnails.get(outro.id)"
              :src="outroThumbnails.get(outro.id)!"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="16" class="text-white/30" />
            </div>
          </div>
          <!-- Info -->
          <div class="text-xs font-medium text-white truncate">{{ outro.name }}</div>
          <div class="text-[10px] text-white/40">{{ formatDuration(outro.duration || 0) }}</div>
          <!-- Applied badge -->
          <div
            v-if="currentOutro?.id === outro.id"
            class="absolute top-1 right-1 px-1.5 py-0.5 bg-violet-500/30 text-violet-300 text-[9px] rounded"
          >
            Applied
          </div>
          <!-- Add overlay -->
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center bg-violet-500/0 group-hover:bg-violet-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Plus :size="20" class="text-violet-400" />
          </div>
        </button>
      </div>
    </div>

    <!-- Info Notice -->
    <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
      <div class="flex items-start gap-2">
        <Info :size="14" class="text-blue-400 mt-0.5 flex-shrink-0" />
        <div class="text-[11px] text-blue-300/80">
          <p class="font-medium mb-1">How it works</p>
          <p class="text-blue-300/60">
            Adding an intro will insert it at the beginning of your timeline and shift all existing content forward.
            Outros are added at the end of your timeline.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { Play, Plus, X, Loader2, Info, Upload } from 'lucide-vue-next';
  import { getAllIntroOutros, createIntroOutro, type IntroOutro } from '@/services/database';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';

  interface AppliedIntroOutro {
    id: string;
    name: string;
    duration: number | null;
    filePath: string;
    thumbnailUrl?: string;
  }

  const props = defineProps<{
    currentIntro?: AppliedIntroOutro | null;
    currentOutro?: AppliedIntroOutro | null;
  }>();

  const emit = defineEmits<{
    (e: 'addIntro', intro: IntroOutro): void;
    (e: 'addOutro', outro: IntroOutro): void;
    (e: 'removeIntro'): void;
    (e: 'removeOutro'): void;
  }>();

  // State
  const intros = ref<IntroOutro[]>([]);
  const outros = ref<IntroOutro[]>([]);
  const loadingAssets = ref(false);
  const introThumbnails = ref<Map<string, string>>(new Map());
  const outroThumbnails = ref<Map<string, string>>(new Map());
  const isUploadingIntro = ref(false);
  const isUploadingOutro = ref(false);

  // Methods
  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      const allAssets = await getAllIntroOutros();
      intros.value = allAssets.filter((a) => a.type === 'intro');
      outros.value = allAssets.filter((a) => a.type === 'outro');

      // Load thumbnails
      for (const item of [...intros.value, ...outros.value]) {
        if (item.thumbnail_path) {
          try {
            const exists = await invoke<boolean>('check_file_exists', { path: item.thumbnail_path });
            if (exists) {
              const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: item.thumbnail_path });
              if (item.type === 'intro') {
                introThumbnails.value.set(item.id, dataUrl);
              } else {
                outroThumbnails.value.set(item.id, dataUrl);
              }
            }
          } catch (err) {
            console.warn('[IntroOutroTab] Failed to load thumbnail:', item.id, err);
          }
        }
      }
    } catch (error) {
      console.error('[IntroOutroTab] Failed to load intros/outros:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  // Video file extensions supported for intro/outro
  const videoExtensions = ['mp4', 'mov', 'webm', 'mkv', 'avi'];

  async function uploadIntro() {
    await uploadVideo('intro');
  }

  async function uploadOutro() {
    await uploadVideo('outro');
  }

  async function uploadVideo(type: 'intro' | 'outro') {
    const isUploading = type === 'intro' ? isUploadingIntro : isUploadingOutro;
    isUploading.value = true;

    try {
      // Open file picker
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Video Files',
            extensions: videoExtensions,
          },
        ],
      });

      if (!selected) {
        isUploading.value = false;
        return;
      }

      const filePath = typeof selected === 'string' ? selected : selected.path;
      if (!filePath) {
        isUploading.value = false;
        return;
      }

      // Extract filename for the name
      const pathParts = filePath.replace(/\\/g, '/').split('/');
      const filename = pathParts[pathParts.length - 1];
      const name = filename.replace(/\.[^/.]+$/, ''); // Remove extension

      // Get video duration using ffprobe
      let duration: number | undefined;
      try {
        const durationResult = await invoke<number>('get_video_duration', { videoPath: filePath });
        duration = durationResult;
      } catch (err) {
        console.warn('[IntroOutroTab] Failed to get video duration:', err);
        // Continue without duration - it can be determined later
      }

      // Generate thumbnail
      let thumbnailPath: string | null = null;
      try {
        thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: filePath,
          timestampSeconds: 1, // 1 second into the video
          outputFilename: `${type}_${Date.now()}`,
        });
      } catch (err) {
        console.warn('[IntroOutroTab] Failed to generate thumbnail:', err);
      }

      // Create the intro/outro record in the database
      await createIntroOutro(type, name, filePath, duration, thumbnailPath, thumbnailPath ? 'completed' : 'pending');

      // Reload the list
      await loadIntroOutros();

      console.log(`[IntroOutroTab] Successfully uploaded ${type}:`, name);
    } catch (error) {
      console.error(`[IntroOutroTab] Failed to upload ${type}:`, error);
    } finally {
      isUploading.value = false;
    }
  }

  function addIntro(intro: IntroOutro) {
    emit('addIntro', intro);
  }

  function addOutro(outro: IntroOutro) {
    emit('addOutro', outro);
  }

  function removeIntro() {
    emit('removeIntro');
  }

  function removeOutro() {
    emit('removeOutro');
  }

  // Lifecycle
  onMounted(() => {
    loadIntroOutros();
  });
</script>
