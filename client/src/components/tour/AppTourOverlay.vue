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
        <h3 class="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-fg">{{ presentedStep.title }}</h3>
        <p class="mt-1 text-sm text-fg-muted">{{ presentedStep.body }}</p>
        <div class="mt-4 flex items-center justify-between gap-3">
          <span class="tabular whitespace-nowrap text-xs text-fg-subtle">
            {{ progress.current }} of {{ progress.total }}
          </span>
          <div class="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" @click="skipTour">Skip tour</Button>
            <Button variant="primary" size="sm" :disabled="isLayoutPending" @click="nextStep">
              {{ progress.current >= progress.total ? 'Finish' : 'Next' }}
            </Button>
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
  import { Button } from '@/components/ui/button';
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
      top: `${tooltipLayout.value.top + titlebarShift.value}px`,
      left: `${tooltipLayout.value.left}px`,
    };
  });

  /**
   * The shared layout only keeps a 12px viewport margin, so a tooltip next to
   * a top sidebar item can slide under the window title bar. Nudge it down
   * (and the caret up by the same amount, so it still points at the target).
   */
  const TITLEBAR_CLEARANCE = 44;
  const titlebarShift = computed(() => {
    const layout = tooltipLayout.value;
    if (!layout || (layout.placement !== 'left' && layout.placement !== 'right')) return 0;
    return Math.max(0, TITLEBAR_CLEARANCE - layout.top);
  });

  const caretStyle = computed(() => {
    const layout = tooltipLayout.value;
    if (!layout) return undefined;
    if (layout.placement === 'left' || layout.placement === 'right') {
      return { top: `${Math.max(12, layout.caretOffset - titlebarShift.value)}px` };
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
    background: var(--overlay);
    pointer-events: auto;
    z-index: 0;
  }

  .app-tour__backdrop--cutout {
    background: transparent;
  }

  /* The cutout: a transparent box whose huge spread shadow dims everything else. */
  .app-tour__spotlight {
    position: fixed;
    border-radius: 10px;
    border: 1.5px solid var(--brand);
    box-shadow:
      0 0 0 4px var(--brand-soft),
      0 0 0 9999px var(--overlay);
    background: transparent;
    pointer-events: none;
    z-index: 1;
  }

  .app-tour__tooltip {
    position: fixed;
    z-index: 3;
    width: min(320px, calc(100vw - 24px));
    padding: 1rem 1rem 0.875rem;
    border-radius: var(--radius-card);
    background: var(--surface-raised);
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
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
    background: var(--surface-raised);
    border: 1px solid var(--line);
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
</style>
