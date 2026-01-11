<template>
  <div class="loading-screen">
    <!-- Subtle background effects -->
    <div class="loading-screen__bg-glow"></div>
    <div class="loading-screen__bg-glow loading-screen__bg-glow--secondary"></div>

    <div class="loading-content">
      <!-- Logo with pulse animation -->
      <div class="logo-container">
        <div class="logo-glow"></div>
        <img src="/logo.svg" alt="Clippster" class="logo" />
      </div>

      <!-- Animated loading bar -->
      <div class="loading-bar">
        <div class="loading-bar__track">
          <div class="loading-bar__fill"></div>
        </div>
      </div>

      <!-- Loading status text -->
      <div class="loading-text">
        <span class="loading-text__label">Loading</span>
        <span class="loading-text__dots">
          <span class="loading-text__dot">.</span>
          <span class="loading-text__dot">.</span>
          <span class="loading-text__dot">.</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  // No props needed for this component
</script>

<style scoped>
  .loading-screen {
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
  .loading-screen__bg-glow {
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

  .loading-screen__bg-glow--secondary {
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

  .loading-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    z-index: 1;
  }

  /* Logo container */
  .logo-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
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

  /* Loading bar */
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

  /* Loading text */
  .loading-text {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .loading-text__label {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8125rem;
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .loading-text__dots {
    display: flex;
  }

  .loading-text__dot {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8125rem;
    font-weight: 500;
    animation: dot-bounce 1.4s ease-in-out infinite;
  }

  .loading-text__dot:nth-child(1) {
    animation-delay: 0s;
  }

  .loading-text__dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-text__dot:nth-child(3) {
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
</style>
