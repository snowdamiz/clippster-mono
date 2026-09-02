<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="tour-welcome__overlay" @click.self="onSkip">
        <Transition name="dialog" appear>
          <div class="tour-welcome" role="dialog" aria-labelledby="tour-welcome-title">
            <div class="tour-welcome__accent" />
            <div class="tour-welcome__brand">
              <img :src="logoIconSrc" alt="" class="tour-welcome__logo-icon" />
              <img :src="logoWordSrc" alt="Clippster" class="tour-welcome__logo-word" />
            </div>
            <h2 id="tour-welcome-title" class="tour-welcome__title">Welcome to Clippster</h2>
            <p class="tour-welcome__subtitle">
              Let us show you around — we'll walk through the main sidebar so you know where to
              download, clip, edit, and publish.
            </p>
            <div class="tour-welcome__choices">
              <button type="button" class="tour-welcome__card tour-welcome__card--primary" @click="onTake">
                <span class="tour-welcome__card-title">Take the tour</span>
                <span class="tour-welcome__card-body"
                  >We'll guide you through Browse, Library, Design Studio, Studio, and Manage.</span
                >
              </button>
              <button type="button" class="tour-welcome__card" @click="onSkip">
                <span class="tour-welcome__card-title">Explore on my own</span>
                <span class="tour-welcome__card-body"
                  >I'll explore the app on my own and get familiar with the sidebar sections.</span
                >
              </button>
            </div>
            <p class="tour-welcome__footnote">You can restart the tour anytime from Account Settings.</p>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  defineProps<{ show: boolean }>();
  const emit = defineEmits<{ take: []; skip: [] }>();

  // Public assets — bound as strings so Vite doesn't try to resolve them as modules
  const logoIconSrc = '/logo-icon.svg';
  const logoWordSrc = '/logo.svg';

  function onTake() {
    emit('take');
  }
  function onSkip() {
    emit('skip');
  }
</script>

<style scoped>
  .tour-welcome__overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    padding: 1.5rem;
  }

  .tour-welcome {
    position: relative;
    width: min(560px, 100%);
    background: #141416;
    border: 1px solid #1f1f23;
    border-radius: 12px;
    padding: 1.75rem 1.75rem 1.25rem;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  }

  .tour-welcome__accent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
    background: #0ea5e9;
  }

  .tour-welcome__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    margin-bottom: 1rem;
  }

  .tour-welcome__logo-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
  }

  .tour-welcome__logo-word {
    height: 18px;
  }

  .tour-welcome__title {
    margin: 0;
    text-align: center;
    font-size: 1.5rem;
    font-weight: 700;
    color: #fafafa;
  }

  .tour-welcome__subtitle {
    margin: 0.5rem 0 1.25rem;
    text-align: center;
    font-size: 0.9rem;
    line-height: 1.45;
    color: #a1a1aa;
  }

  .tour-welcome__choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .tour-welcome__card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    text-align: left;
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid #27272a;
    background: #0a0a0b;
    color: inherit;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .tour-welcome__card:hover {
    border-color: #3f3f46;
    background: #121214;
  }

  .tour-welcome__card--primary {
    border-color: rgba(14, 165, 233, 0.55);
    box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.2);
  }

  .tour-welcome__card-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #fafafa;
  }

  .tour-welcome__card-body {
    font-size: 0.8rem;
    line-height: 1.4;
    color: #71717a;
  }

  .tour-welcome__footnote {
    margin: 1rem 0 0;
    text-align: center;
    font-size: 0.75rem;
    color: #52525b;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  .dialog-enter-active {
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }
  .dialog-enter-from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }

  @media (max-width: 560px) {
    .tour-welcome__choices {
      grid-template-columns: 1fr;
    }
  }
</style>
