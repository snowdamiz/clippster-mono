<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="ftl-overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div class="ftl-dialog">
            <div class="ftl-accent"></div>

            <button class="ftl-close" @click="$emit('close')">
              <X :size="18" />
            </button>

            <div class="ftl-content">
              <div class="ftl-icon-wrap">
                <Lock :size="28" />
              </div>

              <h2 class="ftl-title">{{ title }}</h2>
              <p class="ftl-desc">{{ description }}</p>

              <div v-if="limitInfo" class="ftl-limit-info">
                <span class="ftl-limit-used">{{ limitInfo.used }}/{{ limitInfo.limit }}</span>
                <span class="ftl-limit-label">{{ limitInfo.label }} used today</span>
              </div>

              <div class="ftl-actions">
                <button class="ftl-btn ftl-btn--primary" @click="handleUpgrade">
                  <Crown :size="16" />
                  <span>Upgrade Plan</span>
                </button>
                <button class="ftl-btn ftl-btn--secondary" @click="$emit('close')">
                  Maybe Later
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
  import { X, Lock, Crown } from 'lucide-vue-next';
  import { useRouter } from 'vue-router';

  interface Props {
    show: boolean;
    title?: string;
    description?: string;
    limitInfo?: {
      used: number;
      limit: number;
      label: string;
    } | null;
  }

  withDefaults(defineProps<Props>(), {
    title: 'Daily Limit Reached',
    description: 'Upgrade to a paid plan for unlimited access.',
    limitInfo: null,
  });

  defineEmits<{
    (e: 'close'): void;
  }>();

  const router = useRouter();

  function handleUpgrade() {
    router.push('/billing');
  }
</script>

<style scoped>
  .ftl-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .ftl-dialog {
    position: relative;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 380px;
    margin: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .ftl-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), #a855f7);
  }

  .ftl-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .ftl-close:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--sidebar-text);
  }

  .ftl-content {
    padding: 2rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
  }

  .ftl-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a855f7;
    margin-bottom: 0.25rem;
  }

  .ftl-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .ftl-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .ftl-limit-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    margin: 0.25rem 0;
  }

  .ftl-limit-used {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f59e0b;
  }

  .ftl-limit-label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .ftl-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .ftl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    width: 100%;
  }

  .ftl-btn--primary {
    background: var(--sidebar-accent);
    color: white;
  }

  .ftl-btn--primary:hover {
    filter: brightness(1.1);
  }

  .ftl-btn--secondary {
    background: transparent;
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .ftl-btn--secondary:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--sidebar-text);
  }

  /* Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .dialog-leave-active {
    transition: all 0.15s ease-in;
  }
  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
