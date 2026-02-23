<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="currentAnnouncement"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="dismiss"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
          >
            <!-- Decorative top accent bar (color by type) -->
            <div class="h-1 w-full" :class="accentGradient" />

            <div class="p-5 sm:p-6 lg:p-8">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl border mb-3 sm:mb-4"
                  :class="iconBg"
                >
                  <component :is="typeIcon" class="h-5 w-5 sm:h-6 sm:w-6" :class="iconColor" />
                </div>

                <!-- Type badge -->
                <div class="flex items-center justify-center gap-2 mb-2">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                    :class="badgeClass"
                  >
                    <component :is="typeIcon" class="h-2.5 w-2.5" />
                    {{ typeLabel }}
                  </span>
                  <span v-if="queueLength > 1" class="text-xs text-zinc-500">
                    {{ currentIndex + 1 }} of {{ queueLength }}
                  </span>
                </div>

                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                  {{ currentAnnouncement.title }}
                </h2>
              </div>

              <!-- Body (rich HTML content) -->
              <div
                class="announcement-body mb-5 sm:mb-6 text-sm text-zinc-300 leading-relaxed"
                v-html="currentAnnouncement.body"
              />

              <!-- Actions -->
              <div class="flex items-center gap-3">
                <button
                  @click="dismiss"
                  class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm sm:text-base"
                  :class="ctaClass"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative flex items-center justify-center gap-2">
                    <Check class="h-4 w-4" />
                    Got it
                  </span>
                </button>

                <button
                  v-if="queueLength > 1"
                  @click="dismiss"
                  class="px-4 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Info, AlertTriangle, Sparkles, Megaphone, Check } from 'lucide-vue-next';
  import { useAnnouncements } from '@/composables/useAnnouncements';

  const { currentAnnouncement, queueLength, dismissCurrent } = useAnnouncements();

  const currentIndex = computed(() => 0);

  const typeIcon = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return AlertTriangle;
      case 'feature': return Sparkles;
      case 'campaign': return Megaphone;
      default: return Info;
    }
  });

  const typeLabel = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return 'Warning';
      case 'feature': return 'New Feature';
      case 'campaign': return 'Campaign';
      default: return 'Info';
    }
  });

  const accentGradient = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500';
      case 'feature': return 'bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500';
      case 'campaign': return 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500';
      default: return 'bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500';
    }
  });

  const iconBg = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return 'bg-amber-500/20 border-amber-500/30';
      case 'feature': return 'bg-violet-500/20 border-violet-500/30';
      case 'campaign': return 'bg-green-500/20 border-green-500/30';
      default: return 'bg-blue-500/20 border-blue-500/30';
    }
  });

  const iconColor = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return 'text-amber-400';
      case 'feature': return 'text-violet-400';
      case 'campaign': return 'text-green-400';
      default: return 'text-blue-400';
    }
  });

  const badgeClass = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'feature': return 'bg-violet-500/10 border-violet-500/30 text-violet-400';
      case 'campaign': return 'bg-green-500/10 border-green-500/30 text-green-400';
      default: return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  });

  const ctaClass = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning': return 'bg-gradient-to-r from-amber-600 to-orange-600';
      case 'feature': return 'bg-gradient-to-r from-violet-600 to-purple-600';
      case 'campaign': return 'bg-gradient-to-r from-green-600 to-emerald-600';
      default: return 'bg-gradient-to-r from-blue-600 to-sky-600';
    }
  });

  function dismiss() {
    dismissCurrent();
  }
</script>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .dialog-leave-active {
    transition: all 0.15s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.9) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.95);
  }

  /* Rich HTML body styling */
  .announcement-body :deep(p) {
    margin: 0 0 0.75rem;
  }

  .announcement-body :deep(p:last-child) {
    margin-bottom: 0;
  }

  .announcement-body :deep(strong) {
    color: #ffffff;
    font-weight: 600;
  }

  .announcement-body :deep(em) {
    font-style: italic;
  }

  .announcement-body :deep(a) {
    color: #a78bfa;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .announcement-body :deep(a:hover) {
    color: #c4b5fd;
  }

  .announcement-body :deep(ul),
  .announcement-body :deep(ol) {
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
  }

  .announcement-body :deep(li) {
    margin-bottom: 0.25rem;
  }

  .announcement-body :deep(h1),
  .announcement-body :deep(h2),
  .announcement-body :deep(h3) {
    color: #ffffff;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
</style>
