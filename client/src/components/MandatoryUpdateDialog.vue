<template>
  <div class="update-overlay">
    <div class="update-container">
      <!-- Logo -->
      <div class="logo-container">
        <img src="/app-icon.png" alt="Clippster" class="logo" />
      </div>

      <!-- Checking for updates -->
      <template v-if="state.status === 'checking'">
        <div class="spinner"></div>
        <h2 class="title">Checking for updates...</h2>
        <p class="description">Please wait while we check for the latest version.</p>
      </template>

      <!-- Update available -->
      <template v-else-if="state.status === 'available'">
        <div class="update-badge">
          <Download class="badge-icon" />
          <span>Update Available</span>
        </div>

        <h2 class="title">New Version Available</h2>
        <p class="version">Version {{ state.updateInfo?.version }}</p>

        <div v-if="state.updateInfo?.body" class="release-notes">
          <h3 class="release-notes-title">What's New</h3>
          <div class="release-notes-content" v-html="formatReleaseNotes(state.updateInfo.body)"></div>
        </div>

        <p class="description required-notice">This update is required to continue using Clippster.</p>

        <button class="update-button" @click="handleUpdate">
          <Download class="button-icon" />
          Update Now
        </button>
      </template>

      <!-- Downloading -->
      <template v-else-if="state.status === 'downloading'">
        <div class="progress-container">
          <div class="progress-ring">
            <svg class="progress-svg" viewBox="0 0 100 100">
              <circle class="progress-bg" cx="50" cy="50" r="45" />
              <circle class="progress-fill" cx="50" cy="50" r="45" :style="{ strokeDashoffset: progressOffset }" />
            </svg>
            <span class="progress-text">{{ state.progress.percent }}%</span>
          </div>
        </div>

        <h2 class="title">Downloading Update...</h2>
        <p class="description">
          {{ formatBytes(state.progress.downloaded) }} / {{ formatBytes(state.progress.total) }}
        </p>

        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${state.progress.percent}%` }"></div>
        </div>
      </template>

      <!-- Installing -->
      <template v-else-if="state.status === 'installing'">
        <div class="spinner"></div>
        <h2 class="title">Installing Update...</h2>
        <p class="description">The app will restart automatically.</p>
      </template>

      <!-- Error -->
      <template v-else-if="state.status === 'error'">
        <div class="error-icon-container">
          <AlertCircle class="error-icon" />
        </div>

        <h2 class="title error-title">Update Failed</h2>
        <p class="description error-message">{{ state.error }}</p>

        <button class="retry-button" @click="handleRetry">
          <RefreshCw class="button-icon" />
          Try Again
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Download, AlertCircle, RefreshCw } from 'lucide-vue-next';
  import { useAppUpdater } from '@/composables/useAppUpdater';

  const { state, downloadAndInstall, checkForUpdates, resetState } = useAppUpdater();

  // Calculate SVG progress ring offset
  const progressOffset = computed(() => {
    const circumference = 2 * Math.PI * 45;
    return circumference - (state.progress.percent / 100) * circumference;
  });

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
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
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
  .update-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  }

  .update-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    max-width: 480px;
    padding: 3rem;
    text-align: center;
  }

  .logo-container {
    margin-bottom: 1rem;
  }

  .logo {
    width: 100px;
    height: 100px;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid #333;
    border-top: 3px solid #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .title {
    color: #ffffff;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .version {
    color: #6366f1;
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }

  .description {
    color: #9ca3af;
    font-size: 1rem;
    line-height: 1.5;
    margin: 0;
  }

  .required-notice {
    color: #f59e0b;
    font-weight: 500;
    background: rgba(245, 158, 11, 0.1);
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .update-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }

  .badge-icon {
    width: 16px;
    height: 16px;
  }

  .release-notes {
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    text-align: left;
  }

  .release-notes-title {
    color: #e5e7eb;
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .release-notes-content {
    color: #9ca3af;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .release-notes-content :deep(ul) {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
  }

  .release-notes-content :deep(li) {
    margin: 0.25rem 0;
  }

  .release-notes-content :deep(h3),
  .release-notes-content :deep(h4) {
    color: #e5e7eb;
    margin: 0.75rem 0 0.5rem 0;
  }

  .update-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
    min-width: 200px;
  }

  .update-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
  }

  .update-button:active {
    transform: translateY(0);
  }

  .button-icon {
    width: 20px;
    height: 20px;
  }

  /* Progress Ring */
  .progress-container {
    margin-bottom: 0.5rem;
  }

  .progress-ring {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .progress-svg {
    transform: rotate(-90deg);
    width: 100%;
    height: 100%;
  }

  .progress-bg {
    fill: none;
    stroke: #1f2937;
    stroke-width: 8;
  }

  .progress-fill {
    fill: none;
    stroke: url(#gradient);
    stroke-width: 8;
    stroke-linecap: round;
    stroke-dasharray: 283;
    transition: stroke-dashoffset 0.3s ease;
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #ffffff;
    font-size: 1.5rem;
    font-weight: 700;
  }

  /* Progress Bar */
  .progress-bar-container {
    width: 100%;
    height: 8px;
    background: #1f2937;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Error State */
  .error-icon-container {
    background: rgba(239, 68, 68, 0.1);
    padding: 1.25rem;
    border-radius: 50%;
  }

  .error-icon {
    width: 48px;
    height: 48px;
    color: #ef4444;
  }

  .error-title {
    color: #ef4444;
  }

  .error-message {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    max-width: 100%;
    word-break: break-word;
  }

  .retry-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: transparent;
    color: #9ca3af;
    border: 1px solid #374151;
    padding: 0.875rem 1.75rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: #6366f1;
    color: #ffffff;
  }

  /* Custom scrollbar for release notes */
  .release-notes::-webkit-scrollbar {
    width: 6px;
  }

  .release-notes::-webkit-scrollbar-track {
    background: transparent;
  }

  .release-notes::-webkit-scrollbar-thumb {
    background: #374151;
    border-radius: 3px;
  }

  .release-notes::-webkit-scrollbar-thumb:hover {
    background: #4b5563;
  }
</style>
