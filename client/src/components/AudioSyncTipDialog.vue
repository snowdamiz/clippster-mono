<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-md" @click="handleDismiss" />
      <Transition name="dialog" appear>
        <div
          class="relative flex flex-col w-full max-w-lg mx-4 overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30"
              >
                <Volume2 class="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">Audio Sync Tips</h2>
                <p class="text-xs text-muted-foreground">First time recording {{ creatorName }}</p>
              </div>
            </div>
            <button
              @click="handleDismiss"
              class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-5">
            <!-- Main message -->
            <div class="flex gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Info class="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div class="space-y-2">
                <p class="text-sm text-emerald-100 font-medium">
                  We recommend doing a 1-minute test recording first
                </p>
                <p class="text-xs text-emerald-200/70 leading-relaxed">
                  Watch the test clip to see if the audio is synced with the video. If lips don't match the words, 
                  you can adjust the audio offset in the creator's profile settings.
                </p>
              </div>
            </div>

            <!-- Why audio gets out of sync -->
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-white">Why does audio get out of sync?</h3>
              <p class="text-xs text-muted-foreground leading-relaxed">
                Different streaming setups introduce varying amounts of audio delay. 
                The default setting (215ms) works for most streamers, but some may need adjustment:
              </p>
              
              <div class="grid grid-cols-2 gap-2">
                <div class="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
                      <Monitor class="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <span class="text-xs font-medium text-violet-300">OBS Studio</span>
                  </div>
                  <p class="text-[10px] text-muted-foreground">
                    Multiple audio sources (mic, desktop, guests) each have different latencies
                  </p>
                </div>

                <div class="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                      <Radio class="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span class="text-xs font-medium text-blue-300">LiveU / IRL</span>
                  </div>
                  <p class="text-[10px] text-muted-foreground">
                    Cellular bonding and encoding add extra processing time
                  </p>
                </div>

                <div class="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-6 h-6 rounded-md bg-pink-500/20 flex items-center justify-center">
                      <Layers class="w-3.5 h-3.5 text-pink-400" />
                    </div>
                    <span class="text-xs font-medium text-pink-300">Multi-Guest</span>
                  </div>
                  <p class="text-[10px] text-muted-foreground">
                    Guest audio comes from different sources with varying delays
                  </p>
                </div>

                <div class="p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center">
                      <Globe class="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span class="text-xs font-medium text-amber-300">Browser/WebRTC</span>
                  </div>
                  <p class="text-[10px] text-muted-foreground">
                    Usually has minimal delay, may need lower offset value
                  </p>
                </div>
              </div>
            </div>

            <!-- How to fix -->
            <div class="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-xl space-y-2">
              <h4 class="text-xs font-semibold text-white flex items-center gap-2">
                <Settings class="w-4 h-4 text-muted-foreground" />
                How to adjust audio sync
              </h4>
              <ol class="text-xs text-muted-foreground space-y-1.5 ml-6 list-decimal">
                <li>Record a short 1-minute test clip</li>
                <li>Play it back and check if the audio matches the video</li>
                <li>If audio is <span class="text-amber-400">behind</span> (late), <span class="text-emerald-400">increase</span> the offset</li>
                <li>If audio is <span class="text-amber-400">ahead</span> (early), <span class="text-emerald-400">decrease</span> the offset</li>
                <li>Edit the creator profile and adjust the Audio Sync slider</li>
              </ol>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="dontShowAgain"
                class="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50"
              />
              <span class="text-xs text-muted-foreground">Don't show this again for {{ creatorName }}</span>
            </label>
            <button
              @click="handleContinue"
              class="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group"
            >
              <div
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
              />
              <span class="relative flex items-center gap-2">
                Start Recording
                <ChevronRight class="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  X,
  Volume2,
  Info,
  Monitor,
  Radio,
  Layers,
  Globe,
  Settings,
  ChevronRight,
} from 'lucide-vue-next';

interface Props {
  show: boolean;
  creatorName: string;
  creatorId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'continue', dontShowAgain: boolean): void;
}>();

const dontShowAgain = ref(false);

function handleDismiss() {
  emit('close');
}

function handleContinue() {
  emit('continue', dontShowAgain.value);
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
</style>

