<template>
  <div class="loading-screen">
    <div class="loading-content">
      <div class="logo-container">
        <img src="/app-icon.png" alt="Clippster" class="logo" />
      </div>
      <div class="spinner"></div>
      <div class="loading-text">Clippster</div>
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
    background: #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }

  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo {
    width: 120px;
    height: 120px;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s ease;
  }

  .logo:hover {
    transform: scale(1.05);
  }

  .spinner {
    width: 40px;
    height: 40px;
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

  .loading-text {
    color: #ffffff;
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    opacity: 0.9;
  }
</style>
