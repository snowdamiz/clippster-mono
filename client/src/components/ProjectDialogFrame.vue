<template>
  <!--
    Dependency-free dialog frame for the "New / Edit project" form, used by the
    browser app (apps/web). It mirrors the desktop <Modal> look with plain
    elements + token utilities because apps/web cannot load reka-ui or the ui
    primitives. The desktop ProjectDialog uses <Modal> directly.
  -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[10040] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]"
        tabindex="-1"
        @click.self="!loading && emit('close')"
        @keydown.esc="!loading && emit('close')"
      >
        <div
          class="relative flex max-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--radius-modal)] bg-surface-raised text-fg shadow-[var(--shadow-lg)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-dialog-title"
        >
          <header class="flex shrink-0 items-start gap-3 px-5 pb-1 pr-12 pt-4">
            <span
              class="mt-0.5 inline-grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-hover text-fg-muted"
            >
              <Pencil v-if="editing" class="size-4" />
              <FolderPlus v-else class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 id="project-dialog-title" class="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-fg">
                {{ editing ? 'Edit project' : 'New project' }}
              </h2>
              <p class="mt-0.5 text-sm text-fg-muted">
                {{ editing ? 'Update project details' : 'Start a new video project' }}
              </p>
            </div>
          </header>
          <button
            type="button"
            class="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:opacity-45"
            :disabled="loading"
            aria-label="Close project dialog"
            @click="emit('close')"
          >
            <X class="size-4" />
          </button>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
            <slot />
          </div>

          <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-line-subtle bg-surface px-5 py-3">
            <button
              type="button"
              :disabled="loading"
              class="inline-flex h-[var(--control-md)] items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="loading"
              class="inline-flex h-[var(--control-md)] items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--primary-bg)] px-3 text-sm font-medium text-[var(--fg-on-light)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--primary-bg-hover)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
              @click="emit('submit')"
            >
              <Loader2 v-if="loading" class="size-4 animate-spin" />
              <!-- Title Case kept on purpose: apps/web e2e tests match these labels exactly. -->
              {{ loading ? 'Saving...' : editing ? 'Update Project' : 'Create Project' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
  import { X, FolderPlus, Pencil, Loader2 } from 'lucide-vue-next';
  defineProps<{ modelValue: boolean; editing?: boolean; loading?: boolean }>();
  const emit = defineEmits<{ close: []; submit: [] }>();
</script>
