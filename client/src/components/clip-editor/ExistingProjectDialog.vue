<template>
  <Teleport to="body">
    <Transition 
      enter-active-class="transition-opacity duration-200 ease-out" 
      enter-from-class="opacity-0" 
      leave-active-class="transition-opacity duration-200 ease-in" 
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999]" @click.self="$emit('cancel')">
        <Transition 
          enter-active-class="transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]" 
          enter-from-class="opacity-0 scale-95 translate-y-2" 
          leave-active-class="transition-all duration-150 ease-in" 
          leave-to-class="opacity-0 scale-[0.98]"
          appear
        >
          <div v-if="show" class="bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-xl w-full max-w-[420px] m-4 flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="h-[3px] bg-gradient-to-r from-[var(--sidebar-accent)] to-cyan-500/50 shrink-0"></div>

            <!-- Header -->
            <div class="relative flex flex-col items-center px-6 pt-6 pb-4 text-center">
              <button class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-[var(--sidebar-text-muted)] cursor-pointer transition-all duration-150 ease-in-out hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]" @click="$emit('cancel')" title="Close">
                <X :size="18" />
              </button>
              <div class="flex items-center justify-center w-[52px] h-[52px] rounded-xl bg-cyan-500/15 text-[var(--sidebar-accent)] mb-3.5">
                <FolderOpen :size="24" />
              </div>
              <h2 class="text-xl font-bold text-[var(--sidebar-text)] m-0 tracking-tight">Existing Project Found</h2>
              <p class="text-[0.8125rem] text-[var(--sidebar-text-muted)] mt-1">This clip has been edited before in a video project</p>
            </div>

            <!-- Content -->
            <div class="px-6 pb-5">
              <!-- Existing Project Card -->
              <div v-if="existingProject" class="flex items-start gap-3.5 p-4 bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] rounded-[10px]">
                <div class="flex items-center justify-center shrink-0 w-11 h-11 rounded-[10px] bg-violet-500/15 text-violet-400">
                  <Video :size="20" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-[0.9375rem] font-semibold text-[var(--sidebar-text)] m-0 truncate">{{ existingProject.name }}</h3>
                  <p class="text-[0.75rem] text-[var(--sidebar-text-muted)] mt-1">Last modified: {{ formatDate(existingProject.updated_at) }}</p>
                  <p v-if="existingProject.total_duration > 0" class="text-[0.75rem] text-[var(--sidebar-text-muted)] opacity-70 mt-0.5">
                    Duration: {{ formatDuration(existingProject.total_duration) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex flex-col gap-2.5 px-6 py-5 border-t border-[var(--sidebar-border)]">
              <button class="w-full flex items-center justify-center gap-2 p-3 text-[0.875rem] font-semibold rounded-lg border-none cursor-pointer transition-all duration-150 ease-in-out whitespace-nowrap bg-gradient-to-br from-[var(--sidebar-accent)] to-cyan-600 text-white hover:opacity-90" @click="$emit('open-existing')">
                <FolderOpen :size="16" />
                Open Existing Project
              </button>
              <button class="w-full flex items-center justify-center gap-2 p-3 text-[0.875rem] font-semibold rounded-lg border-none cursor-pointer transition-all duration-150 ease-in-out whitespace-nowrap bg-[var(--sidebar-hover)] text-[var(--sidebar-text)] border border-[var(--sidebar-border)] hover:bg-[var(--sidebar-active)] hover:border-white/10" @click="$emit('create-new')">
                <Plus :size="16" />
                Create New Project
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { X, FolderOpen, Video, Plus } from 'lucide-vue-next';
  import type { VideoEditorProject } from '@/services/database';

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  interface Props {
    show: boolean;
    existingProject: VideoEditorProject | null;
  }

  interface Emits {
    (e: 'open-existing'): void;
    (e: 'create-new'): void;
    (e: 'cancel'): void;
  }

  defineProps<Props>();
  defineEmits<Emits>();
</script>


