<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999]">
    <div
      class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
    >
      <!-- Decorative top accent - indigo/purple for updates -->
      <div class="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

      <div class="p-5 sm:p-6 lg:p-8">
        <!-- Checking for updates -->
        <template v-if="state.status === 'checking'">
          <div class="text-center">
            <div
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 mb-4"
            >
              <div class="loading-spinner"></div>
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight mb-2">Checking for Updates</h2>
            <p class="text-zinc-400 text-sm">Please wait while we check for the latest version.</p>
          </div>
        </template>

        <!-- Update available -->
        <template v-else-if="state.status === 'available'">
          <div class="text-center mb-6">
            <div
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 mb-4"
            >
              <Download class="h-7 w-7 text-indigo-400" />
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight">Update Available</h2>
            <p class="text-indigo-400 font-semibold mt-1">Version {{ state.updateInfo?.version }}</p>
          </div>

          <!-- Release notes -->
          <div
            v-if="state.updateInfo?.body"
            class="mb-5 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 max-h-40 overflow-y-auto"
          >
            <p class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">What's New</p>
            <div class="text-zinc-300 text-sm release-notes" v-html="formatReleaseNotes(state.updateInfo.body)"></div>
          </div>

          <!-- Required notice -->
          <div class="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div class="flex items-center gap-2">
              <AlertCircle class="h-4 w-4 text-amber-400 flex-shrink-0" />
              <p class="text-amber-400 text-sm font-medium">This update is required to continue using Clippster.</p>
            </div>
          </div>

          <!-- Update button -->
          <button
            class="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group"
            @click="handleUpdate"
          >
            <div
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            />
            <span class="relative flex items-center justify-center gap-2">
              <Download class="h-5 w-5" />
              Update Now
            </span>
          </button>
        </template>

        <!-- Downloading -->
        <template v-else-if="state.status === 'downloading'">
          <div class="text-center mb-6">
            <div
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 mb-4"
            >
              <Loader2 class="h-7 w-7 text-indigo-400 animate-spin" />
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight">Downloading Update</h2>
            <p class="text-zinc-400 text-sm mt-1">
              {{ formatBytes(state.progress.downloaded) }} / {{ formatBytes(state.progress.total) }}
            </p>
          </div>

          <!-- Progress bar -->
          <div class="space-y-2">
            <div class="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                :style="{ width: `${state.progress.percent}%` }"
              ></div>
            </div>
            <p class="text-center text-zinc-500 text-sm font-medium">{{ state.progress.percent }}%</p>
          </div>
        </template>

        <!-- Installing -->
        <template v-else-if="state.status === 'installing'">
          <div class="text-center">
            <div
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-4"
            >
              <Loader2 class="h-7 w-7 text-green-400 animate-spin" />
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight mb-2">Installing Update</h2>
            <p class="text-zinc-400 text-sm">The app will restart automatically.</p>
          </div>
        </template>

        <!-- Error -->
        <template v-else-if="state.status === 'error'">
          <div class="text-center mb-6">
            <div
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 mb-4"
            >
              <AlertCircle class="h-7 w-7 text-red-400" />
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight">Update Failed</h2>
          </div>

          <!-- Error message -->
          <div class="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p class="text-red-400 text-sm">{{ state.error }}</p>
          </div>

          <!-- Retry button -->
          <button
            class="w-full px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600"
            @click="handleRetry"
          >
            <span class="flex items-center justify-center gap-2">
              <RefreshCw class="h-5 w-5" />
              Try Again
            </span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Download, AlertCircle, RefreshCw, Loader2 } from 'lucide-vue-next';
  import { useAppUpdater } from '@/composables/useAppUpdater';

  const { state, downloadAndInstall, checkForUpdates, resetState } = useAppUpdater();

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format release notes (simple markdown-like parsing)
  function formatReleaseNotes(body: string): string {
    return body
      .replace(/^### (.+)$/gm, '<strong class="text-zinc-200">$1</strong>')
      .replace(/^## (.+)$/gm, '<strong class="text-zinc-200">$1</strong>')
      .replace(/^# (.+)$/gm, '<strong class="text-zinc-200">$1</strong>')
      .replace(/^\* (.+)$/gm, '• $1')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  async function handleUpdate() {
    try {
      await downloadAndInstall();
    } catch (error) {
      console.error('[MandatoryUpdateDialog] Update failed:', error);
    }
  }

  async function handleRetry() {
    resetState();
    await checkForUpdates();
  }
</script>

<style scoped>
  .loading-spinner {
    width: 1.75rem;
    height: 1.75rem;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: rgb(99, 102, 241);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .release-notes :deep(strong) {
    display: block;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .release-notes :deep(strong:first-child) {
    margin-top: 0;
  }

  /* Custom scrollbar for release notes */
  .overflow-y-auto::-webkit-scrollbar {
    width: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgb(63, 63, 70);
    border-radius: 2px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgb(82, 82, 91);
  }
</style>
