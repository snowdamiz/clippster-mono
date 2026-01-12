<template>
  <div class="update-screen">
    <!-- Subtle background effects -->
    <div class="update-screen__bg-glow"></div>
    <div class="update-screen__bg-glow update-screen__bg-glow--secondary"></div>

    <div class="update-content">
      <!-- Logo with pulse animation -->
      <div class="logo-container">
        <div class="logo-glow"></div>
        <img src="/logo.svg" alt="Clippster" class="logo" />
      </div>

      <!-- Checking for updates -->
      <template v-if="state.status === 'checking'">
        <div class="loading-bar">
          <div class="loading-bar__track">
            <div class="loading-bar__fill"></div>
          </div>
        </div>
        <div class="status-text">
          <span class="status-text__label">Checking for updates</span>
          <span class="status-text__dots">
            <span class="status-text__dot">.</span>
            <span class="status-text__dot">.</span>
            <span class="status-text__dot">.</span>
          </span>
        </div>
      </template>

      <!-- Update available -->
      <template v-else-if="state.status === 'available'">
        <div class="update-info">
          <h2 class="update-title">Update Available</h2>
          <p class="update-version">Version {{ state.updateInfo?.version }}</p>
        </div>

        <!-- Release notes -->
        <div v-if="state.updateInfo?.body" class="release-notes-container">
          <p class="release-notes-label">What's New</p>
          <div class="release-notes" v-html="formatReleaseNotes(state.updateInfo.body)"></div>
        </div>

        <!-- Required notice -->
        <div class="required-notice">
          <AlertCircle class="required-notice__icon" />
          <p class="required-notice__text">This update is required to continue</p>
        </div>

        <!-- Update button -->
        <button class="update-button" @click="handleUpdate">
          <Download class="update-button__icon" />
          <span>Update Now</span>
        </button>
      </template>

      <!-- Downloading -->
      <template v-else-if="state.status === 'downloading'">
        <div class="progress-bar">
          <div class="progress-bar__track">
            <div class="progress-bar__fill" :style="{ width: `${state.progress.percent}%` }"></div>
          </div>
        </div>
        <div class="download-info">
          <span class="download-info__label">Downloading update</span>
          <span class="download-info__progress">
            {{ formatBytes(state.progress.downloaded) }} / {{ formatBytes(state.progress.total) }}
          </span>
        </div>
        <div class="download-percent">{{ state.progress.percent }}%</div>
      </template>

      <!-- Installing -->
      <template v-else-if="state.status === 'installing'">
        <div class="loading-bar">
          <div class="loading-bar__track">
            <div class="loading-bar__fill loading-bar__fill--installing"></div>
          </div>
        </div>
        <div class="status-text">
          <span class="status-text__label">Installing update</span>
          <span class="status-text__dots">
            <span class="status-text__dot">.</span>
            <span class="status-text__dot">.</span>
            <span class="status-text__dot">.</span>
          </span>
        </div>
        <p class="status-subtitle">The app will restart automatically</p>
      </template>

      <!-- Error -->
      <template v-else-if="state.status === 'error'">
        <div class="error-info">
          <div class="error-icon-container">
            <AlertCircle class="error-icon" />
          </div>
          <h2 class="error-title">Update Failed</h2>
          <p class="error-message">{{ state.error }}</p>
        </div>
        <button class="retry-button" @click="handleRetry">
          <RefreshCw class="retry-button__icon" />
          <span>Try Again</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Download, AlertCircle, RefreshCw } from 'lucide-vue-next';
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
  .update-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #09090b;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    overflow: hidden;
  }

  /* Background glow effects */
  .update-screen__bg-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: pulse-glow 4s ease-in-out infinite;
  }

  .update-screen__bg-glow--secondary {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(8, 145, 178, 0.1) 0%, transparent 70%);
    animation: pulse-glow 4s ease-in-out infinite 1s;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .update-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    z-index: 1;
    max-width: 320px;
    width: 100%;
    padding: 0 1rem;
  }

  /* Logo container */
  .logo-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .logo-glow {
    position: absolute;
    width: 140px;
    height: 140px;
    background: radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%);
    border-radius: 50%;
    animation: logo-pulse 2s ease-in-out infinite;
  }

  @keyframes logo-pulse {
    0%,
    100% {
      opacity: 0.4;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.15);
    }
  }

  .logo {
    position: relative;
    height: 48px;
    width: auto;
    filter: drop-shadow(0 4px 24px rgba(6, 182, 212, 0.3));
    animation: logo-float 3s ease-in-out infinite;
  }

  @keyframes logo-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }

  /* Loading bar (indeterminate) */
  .loading-bar {
    width: 180px;
  }

  .loading-bar__track {
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .loading-bar__fill {
    height: 100%;
    width: 40%;
    background: linear-gradient(90deg, #06b6d4, #0891b2, #06b6d4);
    background-size: 200% 100%;
    border-radius: 3px;
    animation: loading-slide 1.5s ease-in-out infinite;
  }

  .loading-bar__fill--installing {
    background: linear-gradient(90deg, #10b981, #059669, #10b981);
  }

  @keyframes loading-slide {
    0% {
      transform: translateX(-100%);
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      transform: translateX(350%);
      background-position: 0% 50%;
    }
  }

  /* Progress bar (determinate) */
  .progress-bar {
    width: 180px;
  }

  .progress-bar__track {
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar__fill {
    height: 100%;
    background: linear-gradient(90deg, #06b6d4, #0891b2);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* Status text with animated dots */
  .status-text {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .status-text__label {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8125rem;
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .status-text__dots {
    display: flex;
  }

  .status-text__dot {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8125rem;
    font-weight: 500;
    animation: dot-bounce 1.4s ease-in-out infinite;
  }

  .status-text__dot:nth-child(1) {
    animation-delay: 0s;
  }

  .status-text__dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .status-text__dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes dot-bounce {
    0%,
    60%,
    100% {
      opacity: 0.3;
    }
    30% {
      opacity: 1;
    }
  }

  .status-subtitle {
    color: rgba(255, 255, 255, 0.35);
    font-size: 0.75rem;
    margin-top: -0.5rem;
  }

  /* Update info section */
  .update-info {
    text-align: center;
  }

  .update-title {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 0.25rem;
  }

  .update-version {
    color: #06b6d4;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  /* Release notes */
  .release-notes-container {
    width: 100%;
    max-height: 120px;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .release-notes-label {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
  }

  .release-notes {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .release-notes :deep(strong) {
    color: rgba(255, 255, 255, 0.8);
    display: block;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .release-notes :deep(strong:first-child) {
    margin-top: 0;
  }

  /* Required notice */
  .required-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 6px;
  }

  .required-notice__icon {
    width: 14px;
    height: 14px;
    color: #f59e0b;
    flex-shrink: 0;
  }

  .required-notice__text {
    color: rgba(245, 158, 11, 0.9);
    font-size: 0.75rem;
    font-weight: 500;
  }

  /* Update button */
  .update-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 20px rgba(6, 182, 212, 0.25);
  }

  .update-button:hover {
    background: linear-gradient(135deg, #22d3ee, #06b6d4);
    box-shadow: 0 4px 24px rgba(6, 182, 212, 0.35);
    transform: translateY(-1px);
  }

  .update-button:active {
    transform: translateY(0);
  }

  .update-button__icon {
    width: 18px;
    height: 18px;
  }

  /* Download info */
  .download-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .download-info__label {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .download-info__progress {
    color: rgba(255, 255, 255, 0.35);
    font-size: 0.75rem;
  }

  .download-percent {
    color: #06b6d4;
    font-size: 1.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Error state */
  .error-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  .error-icon-container {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 12px;
  }

  .error-icon {
    width: 24px;
    height: 24px;
    color: #ef4444;
  }

  .error-title {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1rem;
    font-weight: 600;
  }

  .error-message {
    color: rgba(239, 68, 68, 0.8);
    font-size: 0.75rem;
    max-width: 240px;
  }

  /* Retry button */
  .retry-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .retry-button__icon {
    width: 16px;
    height: 16px;
  }

  /* Custom scrollbar */
  .release-notes-container::-webkit-scrollbar {
    width: 4px;
  }

  .release-notes-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .release-notes-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .release-notes-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
