<template>
  <Teleport to="body">
    <div v-if="isTourActive" class="app-tour" @keydown="onKeydown">
      <!-- Transparent when cutout exists (dim comes from spotlight shadow); solid when centered -->
      <div
        class="app-tour__backdrop"
        :class="{ 'app-tour__backdrop--cutout': !!spotlightStyle }"
        @click.prevent
      />

      <div v-if="spotlightStyle" class="app-tour__spotlight" :style="spotlightStyle" />

      <div
        v-if="presentedStep"
        ref="tooltipRef"
        class="app-tour__tooltip"
        :class="{
          'app-tour__tooltip--centered': !presentedStep.target,
          'app-tour__tooltip--pending': isLayoutPending,
          [`app-tour__tooltip--${tooltipLayout?.placement}`]: !!tooltipLayout,
        }"
        :style="tooltipStyle"
        role="dialog"
        :aria-label="presentedStep.title"
        :aria-busy="isLayoutPending"
      >
        <span
          v-if="presentedStep.target && tooltipLayout"
          class="app-tour__caret"
          :style="caretStyle"
          aria-hidden="true"
        />
        <div class="app-tour__tooltip-accent" />
        <h3 class="app-tour__tooltip-title">{{ presentedStep.title }}</h3>
        <p class="app-tour__tooltip-body">{{ presentedStep.body }}</p>
        <div class="app-tour__tooltip-footer">
          <span class="app-tour__tooltip-progress"
            >{{ progress.current }} of {{ progress.total }}</span
          >
          <div class="app-tour__tooltip-actions">
            <button type="button" class="app-tour__btn app-tour__btn--ghost" @click="skipTour">
              Skip tour
            </button>
            <button
              type="button"
              class="app-tour__btn app-tour__btn--primary"
              :disabled="isLayoutPending"
              @click="nextStep"
            >
              {{ progress.current >= progress.total ? 'Finish' : 'Next' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    computeTooltipLayout,
    scrollTourTargetIntoView,
    TOOLTIP_WIDTH,
    TOOLTIP_HEIGHT,
    type TourStep,
    type TooltipLayout,
  } from '@clippster/app-tour';
  import { useAppTour } from '@/composables/useAppTour';

  const router = useRouter();
  const { isTourActive, currentStep, progress, nextStep, skipTour } = useAppTour();

  /** Step shown in the tooltip — only advances after highlight/route are ready */
  const presentedStep = ref<TourStep | null>(null);
  const isLayoutPending = ref(false);

  const tooltipRef = ref<HTMLElement | null>(null);
  const highlight = ref<{ top: number; left: number; width: number; height: number } | null>(null);
  const tooltipLayout = ref<TooltipLayout | null>(null);
  let measureGen = 0;
  let activeTargetEl: HTMLElement | null = null;

  const spotlightStyle = computed(() => {
    const h = highlight.value;
    if (!h) return null;
    const pad = 6;
    return {
      top: `${h.top - pad}px`,
      left: `${h.left - pad}px`,
      width: `${h.width + pad * 2}px`,
      height: `${h.height + pad * 2}px`,
    };
  });

  const tooltipStyle = computed(() => {
    if (!presentedStep.value?.target) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    if (!tooltipLayout.value) return { visibility: 'hidden' as const };
    return {
      top: `${tooltipLayout.value.top}px`,
      left: `${tooltipLayout.value.left}px`,
    };
  });

  const caretStyle = computed(() => {
    const layout = tooltipLayout.value;
    if (!layout) return undefined;
    if (layout.placement === 'left' || layout.placement === 'right') {
      return { top: `${layout.caretOffset}px` };
    }
    return { left: `${layout.caretOffset}px` };
  });

  function clearTargetClass() {
    if (activeTargetEl) {
      activeTargetEl.classList.remove('app-tour-target');
      activeTargetEl = null;
    }
  }

  function clearChrome() {
    clearTargetClass();
    highlight.value = null;
    tooltipLayout.value = null;
  }

  function waitFrames(n: number): Promise<void> {
    return new Promise((resolve) => {
      let left = n;
      const tick = () => {
        left -= 1;
        if (left <= 0) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  async function ensureRoute(path: string, gen: number): Promise<boolean> {
    if (router.currentRoute.value.path === path) return true;
    try {
      await router.push(path);
    } catch {
      /* navigation aborted / duplicate */
    }
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (gen !== measureGen) return false;
      if (router.currentRoute.value.path === path) {
        await nextTick();
        await waitFrames(2);
        return true;
      }
      await new Promise((r) => setTimeout(r, 16));
    }
    return router.currentRoute.value.path === path;
  }

  function readTargetRect(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }

  /** True when the rect is usable and not stuck in a stacked route-fade (header near bottom). */
  function isSettledTargetRect(
    el: HTMLElement,
    rect: { top: number; left: number; width: number; height: number }
  ): boolean {
    if (rect.width < 8 || rect.height < 8) return false;
    if (el.closest('.page-header') && rect.top > window.innerHeight * 0.45) return false;
    return true;
  }

  async function waitForTarget(targetId: string, gen: number): Promise<HTMLElement | null> {
    const deadline = Date.now() + 2500;
    let last: { top: number; left: number; width: number; height: number } | null = null;
    let stableFrames = 0;

    while (Date.now() < deadline) {
      if (gen !== measureGen) return null;
      const el = document.querySelector(`[data-tour-id="${targetId}"]`) as HTMLElement | null;
      if (el) {
        const rect = readTargetRect(el);
        if (!isSettledTargetRect(el, rect)) {
          scrollTourTargetIntoView(el);
          last = null;
          stableFrames = 0;
          await waitFrames(1);
          continue;
        }
        if (
          last &&
          Math.abs(last.top - rect.top) < 1 &&
          Math.abs(last.left - rect.left) < 1 &&
          Math.abs(last.width - rect.width) < 1 &&
          Math.abs(last.height - rect.height) < 1
        ) {
          stableFrames += 1;
          if (stableFrames >= 2) return el;
        } else {
          last = rect;
          stableFrames = 0;
        }
      }
      await waitFrames(1);
    }
    return document.querySelector(`[data-tour-id="${targetId}"]`) as HTMLElement | null;
  }

  function applyHighlight(el: HTMLElement, step: TourStep) {
    const rect = readTargetRect(el);
    highlight.value = rect;
    tooltipLayout.value = computeTooltipLayout(
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      step.placement || 'right',
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT
    );
  }

  async function measure() {
    const gen = ++measureGen;
    const step = currentStep.value;

    // Drop previous highlight immediately so we never show new copy on the old tab
    isLayoutPending.value = true;
    clearChrome();

    if (!step || !isTourActive.value) {
      presentedStep.value = null;
      isLayoutPending.value = false;
      return;
    }

    await nextTick();
    if (gen !== measureGen) return;

    if (step.route) {
      const ok = await ensureRoute(step.route, gen);
      if (gen !== measureGen) return;
      if (!ok) {
        presentedStep.value = step;
        isLayoutPending.value = false;
        return;
      }
    }

    if (!step.target) {
      presentedStep.value = step;
      highlight.value = null;
      tooltipLayout.value = null;
      isLayoutPending.value = false;
      return;
    }

    const el = await waitForTarget(step.target, gen);
    if (gen !== measureGen) return;

    if (!el) {
      // Keep trying — editor chrome can mount after the tour starts
      presentedStep.value = step;
      isLayoutPending.value = true;
      window.setTimeout(() => {
        if (gen === measureGen && isTourActive.value) measure();
      }, 250);
      return;
    }

    scrollTourTargetIntoView(el);
    await waitFrames(2);
    if (gen !== measureGen) return;

    el.classList.add('app-tour-target');
    activeTargetEl = el;
    applyHighlight(el, step);

    // Swap tooltip copy only once highlight + position match this step
    presentedStep.value = step;
    isLayoutPending.value = false;

    // Route fade (leave+enter stacked) can finish after the first frames — keep
    // correcting fixed spotlight coords until the rect stops moving.
    void (async () => {
      const deadline = Date.now() + 400;
      while (Date.now() < deadline) {
        if (gen !== measureGen || !isTourActive.value || activeTargetEl !== el) return;
        scrollTourTargetIntoView(el);
        const next = readTargetRect(el);
        if (next.width >= 8 && next.height >= 8) {
          const prev = highlight.value;
          if (
            !prev ||
            Math.abs(prev.top - next.top) > 1 ||
            Math.abs(prev.left - next.left) > 1 ||
            Math.abs(prev.width - next.width) > 1 ||
            Math.abs(prev.height - next.height) > 1
          ) {
            applyHighlight(el, step);
          }
        }
        await waitFrames(2);
      }
    })();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isTourActive.value) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      skipTour();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (isLayoutPending.value) return;
      e.preventDefault();
      nextStep();
    }
  }

  function onResize() {
    measure();
  }

  watch(
    () => [currentStep.value?.id, isTourActive.value] as const,
    () => {
      measure();
    },
    { immediate: true }
  );

  watch(isTourActive, (active) => {
    if (!active) {
      clearChrome();
      presentedStep.value = null;
      isLayoutPending.value = false;
    }
  });

  onMounted(() => {
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeydown);
  });

  onUnmounted(() => {
    clearChrome();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKeydown);
  });
</script>

<style scoped>
  .app-tour {
    position: fixed;
    inset: 0;
    z-index: 99990;
    pointer-events: none;
  }

  .app-tour__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    pointer-events: auto;
    z-index: 0;
  }

  .app-tour__backdrop--cutout {
    background: transparent;
  }

  .app-tour__spotlight {
    position: fixed;
    border-radius: 10px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.72);
    border: 2px solid rgba(14, 165, 233, 0.9);
    background: transparent;
    pointer-events: none;
    z-index: 1;
    animation: app-tour-pulse 1.8s ease-in-out infinite;
  }

  @keyframes app-tour-pulse {
    0%,
    100% {
      box-shadow:
        0 0 0 9999px rgba(0, 0, 0, 0.72),
        0 0 0 0 rgba(14, 165, 233, 0);
    }
    50% {
      box-shadow:
        0 0 0 9999px rgba(0, 0, 0, 0.72),
        0 0 0 6px rgba(14, 165, 233, 0.28);
    }
  }

  .app-tour__tooltip {
    position: fixed;
    z-index: 3;
    width: min(320px, calc(100vw - 24px));
    background: #141416;
    border: 1px solid #1f1f23;
    border-radius: 10px;
    padding: 1rem 1rem 0.85rem;
    pointer-events: auto;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    transition: opacity 0.12s ease;
  }

  .app-tour__tooltip--pending {
    opacity: 0;
    pointer-events: none;
  }

  .app-tour__tooltip--centered {
    width: min(400px, calc(100vw - 24px));
  }

  .app-tour__caret {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #141416;
    border: 1px solid #1f1f23;
    transform: translate(-50%, -50%) rotate(45deg);
    pointer-events: none;
    z-index: 1;
  }

  .app-tour__tooltip--right .app-tour__caret {
    left: 0;
    border-right: none;
    border-top: none;
  }

  .app-tour__tooltip--left .app-tour__caret {
    left: 100%;
    border-left: none;
    border-bottom: none;
  }

  .app-tour__tooltip--bottom .app-tour__caret {
    top: 0;
    border-right: none;
    border-bottom: none;
  }

  .app-tour__tooltip--top .app-tour__caret {
    top: 100%;
    border-left: none;
    border-top: none;
  }

  .app-tour__tooltip-accent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 10px 10px 0 0;
    background: #0ea5e9;
  }

  .app-tour__tooltip-title {
    margin: 0.25rem 0 0.4rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0ea5e9;
  }

  .app-tour__tooltip-body {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.45;
    color: #e4e4e7;
  }

  .app-tour__tooltip-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.9rem;
  }

  .app-tour__tooltip-progress {
    font-size: 0.75rem;
    color: #71717a;
    white-space: nowrap;
  }

  .app-tour__tooltip-actions {
    display: flex;
    gap: 0.4rem;
  }

  .app-tour__btn {
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .app-tour__btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .app-tour__btn--ghost {
    background: transparent;
    border-color: #3f3f46;
    color: #a1a1aa;
  }

  .app-tour__btn--ghost:hover:not(:disabled) {
    color: #fafafa;
    border-color: #52525b;
  }

  .app-tour__btn--primary {
    background: #0ea5e9;
    color: #0a0a0b;
    border-color: #0ea5e9;
  }

  .app-tour__btn--primary:hover:not(:disabled) {
    background: #38bdf8;
  }
</style>

<style>
  .app-tour-target {
    border-radius: 8px !important;
    outline: 2px solid rgba(14, 165, 233, 0.95) !important;
    outline-offset: 2px;
  }
</style>
