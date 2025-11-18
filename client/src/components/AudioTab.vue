<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="h-full flex items-center justify-center px-4">
      <div class="text-center text-muted-foreground max-w-xs">
        <div class="mb-6 flex flex-col items-center">
          <div
            class="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg flex items-center justify-center mb-5 border border-blue-500/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-9 w-9 text-blue-400/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <h4 class="text-base font-semibold text-foreground mb-2">Audio Tab</h4>
          <p class="text-sm text-muted-foreground leading-relaxed">Audio functionality will be implemented here</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  // Props
  interface AudioTabProps {
    projectId: string | null;
  }

  withDefaults(defineProps<AudioTabProps>(), {
    projectId: null,
  });
</script>
