<template>
  <div class="loading-screen fixed inset-0 z-[9999] grid place-items-center bg-canvas" role="status" aria-live="polite">
    <div class="flex flex-col items-center gap-6">
      <div class="flex items-center gap-3">
        <img src="/logo-titlebar.svg" alt="" class="size-9 rounded-[10px]" />
        <img src="/logo.svg" alt="Clippster" class="h-7 w-auto brightness-0 invert" />
      </div>
      <div class="loading-track h-[3px] w-40 overflow-hidden rounded-full bg-surface-active">
        <div class="loading-fill h-full w-1/3 rounded-full bg-brand"></div>
      </div>
      <span class="sr-only">Loading Clippster</span>
    </div>
  </div>
</template>

<style scoped>
  .loading-fill {
    animation: loading-slide 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }

  @keyframes loading-slide {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(310%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-fill {
      animation: none;
      width: 100%;
      opacity: 0.6;
    }
  }
</style>
