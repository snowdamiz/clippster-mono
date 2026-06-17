<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="bug-dialog__overlay" @click.self="$emit('cancel')">
        <Transition name="dialog" appear>
          <div v-if="show" class="bug-dialog" role="dialog" aria-modal="true">
            <div class="bug-dialog__accent"></div>

            <div class="bug-dialog__header">
              <button
                class="bug-dialog__close"
                @click="$emit('cancel')"
                title="Close"
              >
                <X :size="18" />
              </button>
              <div class="bug-dialog__icon">
                <img src="/x.svg" alt="X" style="width: 24px; height: 24px" />
              </div>
              <h2 class="bug-dialog__title">Add X Live Broadcast</h2>
              <p class="bug-dialog__subtitle">This monitor is for one live session only</p>
            </div>

            <div class="bug-dialog__content">
              <p class="x-broadcast-dialog__text">
                X does not provide a reusable channel URL like Twitch or Kick. Each time a creator goes live,
                they get a <strong>new broadcast link</strong> (for example
                <code class="x-broadcast-dialog__code">x.com/i/broadcasts/…</code> or
                <code class="x-broadcast-dialog__code">x.com/i/spaces/…</code>).
              </p>
              <ul class="x-broadcast-dialog__list">
                <li>This card tracks <strong>only this broadcast URL</strong>, not the creator’s profile.</li>
                <li>When the stream ends and temporary recordings are cleaned up, this card is <strong>removed automatically</strong>.</li>
                <li>Next time they go live, paste the <strong>new</strong> broadcast URL from X.</li>
              </ul>
            </div>

            <div class="bug-dialog__footer">
              <button
                type="button"
                class="bug-dialog__btn bug-dialog__btn--secondary"
                @click="$emit('cancel')"
              >
                Cancel
              </button>
              <button
                type="button"
                class="bug-dialog__btn bug-dialog__btn--primary"
                @click="$emit('confirm')"
              >
                I understand, add broadcast
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { X } from 'lucide-vue-next';

  defineProps<{
    show: boolean;
  }>();

  defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
  }>();
</script>

<style scoped>
  .bug-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .bug-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .bug-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .bug-dialog__header {
    position: relative;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .bug-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bug-dialog__close:hover {
    color: var(--sidebar-text);
    background: var(--sidebar-hover);
  }

  .bug-dialog__icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--sidebar-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 0.75rem;
  }

  .bug-dialog__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .bug-dialog__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .bug-dialog__content {
    padding: 1.25rem 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .x-broadcast-dialog__text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0 0 1rem;
  }

  .x-broadcast-dialog__code {
    font-size: 0.75rem;
    background: var(--sidebar-hover);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .x-broadcast-dialog__list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
  }

  .x-broadcast-dialog__list li {
    margin-bottom: 0.5rem;
  }

  .bug-dialog__footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem 1.25rem;
    border-top: 1px solid var(--sidebar-border);
    justify-content: flex-end;
  }

  .bug-dialog__btn {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
  }

  .bug-dialog__btn--secondary {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .bug-dialog__btn--secondary:hover {
    background: var(--sidebar-border);
  }

  .bug-dialog__btn--primary {
    background: var(--sidebar-accent);
    color: #fff;
  }

  .bug-dialog__btn--primary:hover {
    opacity: 0.9;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active,
  .dialog-leave-active {
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .dialog-enter-from,
  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
</style>
