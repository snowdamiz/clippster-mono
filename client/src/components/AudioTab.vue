<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="h-full flex items-center justify-center px-4">
      <div class="text-center text-muted-foreground max-w-xs">
        <div class="mb-6 flex flex-col items-center">
          <div
            class="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg flex items-center justify-center mb-5 border border-blue-500/20"
          >
            <Music class="h-9 w-9 text-blue-400/70" />
          </div>
          <h4 class="text-base font-semibold text-foreground mb-2">Audio Tab</h4>
          <p class="text-sm text-muted-foreground leading-relaxed">Audio functionality will be implemented here</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Music } from 'lucide-vue-next';

  // Props
  interface AudioTabProps {
    projectId: string | null;
  }

  withDefaults(defineProps<AudioTabProps>(), {
    projectId: null,
  });
</script>
