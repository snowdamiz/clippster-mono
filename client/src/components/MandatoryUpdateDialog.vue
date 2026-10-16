<template>
  <!-- Full-screen blocker shown while a required update is checked, downloaded or installed (mirrors LoadingScreen). -->
  <div class="update-screen fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-canvas px-5 py-8">
    <div class="flex w-full max-w-[360px] flex-col items-center gap-6">
      <div class="flex items-center gap-3">
        <img src="/logo-titlebar.svg" alt="" class="size-9 rounded-[10px]" />
        <img src="/logo.svg" alt="Clippster" class="h-7 w-auto brightness-0 invert" />
      </div>

      <!-- Keyed by status so each step eases in instead of popping -->
      <div :key="state.status" class="flex w-full animate-enter flex-col items-center">
        <!-- Checking for updates -->
        <div v-if="state.status === 'checking'" class="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div class="h-[3px] w-40 overflow-hidden rounded-full bg-surface-active">
            <div class="update-indeterminate h-full w-1/3 rounded-full bg-brand"></div>
          </div>
          <p class="text-xs text-fg-muted">Checking for updates…</p>
        </div>

        <!-- Update available -->
        <section
          v-else-if="state.status === 'available'"
          class="w-full overflow-hidden rounded-xl border border-line-subtle bg-surface"
        >
          <header class="flex items-start gap-3 px-5 pt-5">
            <IconTile :icon="Download" tone="brand" size="md" class="mt-0.5" />
            <div class="min-w-0">
              <h2 class="text-[15px] font-semibold leading-6 text-fg">Update available</h2>
              <p class="text-sm text-fg-muted">
                Version <span class="tabular text-fg">{{ state.updateInfo?.version }}</span> is required to continue.
              </p>
            </div>
          </header>

          <div v-if="state.updateInfo?.body" class="px-5 pt-4">
            <p class="eyebrow mb-1.5">What's new</p>
            <div
              class="release-notes max-h-[140px] overflow-y-auto text-xs leading-relaxed text-fg-muted"
              v-html="formatReleaseNotes(state.updateInfo.body)"
            ></div>
          </div>

          <div class="px-5 pt-4 pb-5">
            <Button variant="primary" size="lg" block @click="handleUpdate">
              <Download />
              Update now
            </Button>
          </div>
        </section>

        <!-- Downloading -->
        <div
          v-else-if="state.status === 'downloading'"
          class="flex w-full flex-col gap-2.5"
          role="status"
          aria-live="polite"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm font-medium text-fg">Downloading update</span>
            <span class="tabular text-sm font-semibold text-brand">{{ state.progress.percent }}%</span>
          </div>
          <div class="h-1 w-full overflow-hidden rounded-full bg-surface-active">
            <div
              class="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              :style="{ width: `${state.progress.percent}%` }"
            ></div>
          </div>
          <span class="tabular text-xs text-fg-subtle">
            {{ formatBytes(state.progress.downloaded) }} / {{ formatBytes(state.progress.total) }}
          </span>
        </div>

        <!-- Installing -->
        <div
          v-else-if="state.status === 'installing'"
          class="flex flex-col items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div class="h-[3px] w-40 overflow-hidden rounded-full bg-surface-active">
            <div class="update-indeterminate h-full w-1/3 rounded-full bg-success"></div>
          </div>
          <div class="text-center">
            <p class="text-sm font-medium text-fg">Installing update…</p>
            <p class="mt-0.5 text-xs text-fg-subtle">The app will restart automatically.</p>
          </div>
        </div>

        <!-- Error -->
        <section
          v-else-if="state.status === 'error'"
          class="w-full overflow-hidden rounded-xl border border-line-subtle bg-surface"
          role="alert"
        >
          <header class="flex items-start gap-3 px-5 pt-5">
            <IconTile :icon="AlertCircle" tone="danger" size="md" class="mt-0.5" />
            <div class="min-w-0">
              <h2 class="text-[15px] font-semibold leading-6 text-fg">Update failed</h2>
              <p class="text-sm text-fg-muted">{{ state.error }}</p>
            </div>
          </header>
          <div class="flex justify-end px-5 pt-4 pb-5">
            <Button variant="secondary" @click="handleRetry">
              <RefreshCw />
              Try again
            </Button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Download, AlertCircle, RefreshCw } from 'lucide-vue-next';
  import { useAppUpdater } from '@/composables/useAppUpdater';
  import { Button } from '@/components/ui/button';
  import { IconTile } from '@/components/ui/icon-tile';

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
      .replace(/^### (.+)$/gm, '<strong>$1</strong>')
      .replace(/^## (.+)$/gm, '<strong>$1</strong>')
      .replace(/^# (.+)$/gm, '<strong>$1</strong>')
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
  .update-indeterminate {
    animation: update-slide 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }

  @keyframes update-slide {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(310%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .update-indeterminate {
      animation: none;
      width: 100%;
      opacity: 0.6;
    }
  }

  /* Release notes are rendered from markdown-ish text via v-html. */
  .release-notes :deep(strong) {
    color: var(--fg);
    font-weight: 600;
  }
</style>
