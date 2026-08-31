<template>
  <Teleport to="body">
    <div v-if="isTourActive" class="app-tour" @keydown="onKeydown">
      <!-- Transparent when cutout exists (dim comes from spotlight shadow); solid when centered -->
      <div
        class="app-tour__backdrop"
        :class="{ 'app-tour__backdrop--cutout': !!spotlightStyle }"
        @click.prevent
      />

      <!-- Cutout ring — z below arrow so its 9999px shadow never covers the path -->
      <div v-if="spotlightStyle" class="app-tour__spotlight" :style="spotlightStyle" />

      <svg v-if="arrowPath" class="app-tour__arrow" width="100%" height="100%">
        <path
          :d="arrowPath.path"
          fill="none"
          stroke="#0ea5e9"
          stroke-width="2.75"
          stroke-linecap="round"
          class="app-tour__arrow-stroke"
        />
        <path
          :d="arrowPath.arrowHead"
          fill="#0ea5e9"
          stroke="#0ea5e9"
          stroke-width="1"
          stroke-linejoin="round"
          class="app-tour__arrow-head"
        />
      </svg>

      <div
        v-if="presentedStep"
        ref="tooltipRef"
        class="app-tour__tooltip"
        :class="{
          'app-tour__tooltip--centered': !presentedStep.target,
          'app-tour__tooltip--pending': isLayoutPending,
        }"
        :style="tooltipStyle"
        role="dialog"
        :aria-label="presentedStep.title"
        :aria-busy="isLayoutPending"
      >
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
    buildHandDrawnArrowPath,
    getArrowStyle,
    resolveStepArrowStyleIndex,
    arrowStartFromTooltip,
    arrowEndAtHotspot,
    type TourStep,
  } from '@clippster/app-tour';
  import { useAppTour } from '@/composables/useAppTour';

  const router = useRouter();
  const { isTourActive, currentStep, progress, nextStep, skipTour } = useAppTour();

  /** Step shown in the tooltip — only advances after highlight/route are ready */
  const presentedStep = ref<TourStep | null>(null);
  const isLayoutPending = ref(false);

  const tooltipRef = ref<HTMLElement | null>(null);
  const highlight = ref<{ top: number; left: number; width: number; height: number } | null>(null);
  const tooltipPos = ref<{ top: number; left: number } | null>(null);
  const arrowPath = ref<ReturnType<typeof buildHandDrawnArrowPath> | null>(null);
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
    if (!tooltipPos.value) return { visibility: 'hidden' as const };
    return {
      top: `${tooltipPos.value.top}px`,
      left: `${tooltipPos.value.left}px`,
    };
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
    arrowPath.value = null;
    tooltipPos.value = null;
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

  async function waitForTarget(targetId: string, gen: number): Promise<HTMLElement | null> {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      if (gen !== measureGen) return null;
      const el = document.querySelector(`[data-tour-id="${targetId}"]`) as HTMLElement | null;
      if (el && el.getClientRects().length > 0) return el;
      await waitFrames(1);
    }
    return document.querySelector(`[data-tour-id="${targetId}"]`) as HTMLElement | null;
  }

  function updateArrow(stepId: string) {
    const pos = tooltipPos.value;
    if (!pos || !presentedStep.value?.target) {
      arrowPath.value = null;
      return;
    }

    // Always re-measure the live target so the tip stays locked to the highlighted tab
    const live = activeTargetEl?.getBoundingClientRect();
    const hot = live
      ? { left: live.left, top: live.top, width: live.width, height: live.height }
      : highlight.value;
    if (!hot) {
      arrowPath.value = null;
      return;
    }

    // Keep spotlight/outline box in sync with the live rect
    highlight.value = {
      top: hot.top,
      left: hot.left,
      width: hot.width,
      height: hot.height,
    };

    const styleIndex = resolveStepArrowStyleIndex(presentedStep.value, progress.value.current - 1);
    const style = getArrowStyle(styleIndex);
    const tip = tooltipRef.value?.getBoundingClientRect();
    const tipBox = tip
      ? { left: tip.left, top: tip.top, width: tip.width, height: tip.height }
      : { left: pos.left, top: pos.top, width: 320, height: 180 };
    const from = arrowStartFromTooltip(tipBox, style.origin);
    const to = arrowEndAtHotspot(hot, style.targetAnchor);
    arrowPath.value = buildHandDrawnArrowPath(from, to, stepId, styleIndex);
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
      tooltipPos.value = null;
      arrowPath.value = null;
      isLayoutPending.value = false;
      return;
    }

    const el = await waitForTarget(step.target, gen);
    if (gen !== measureGen) return;

    if (!el) {
      presentedStep.value = step;
      isLayoutPending.value = false;
      return;
    }

    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await waitFrames(2);
    if (gen !== measureGen) return;

    el.classList.add('app-tour-target');
    activeTargetEl = el;

    const rect = el.getBoundingClientRect();
    highlight.value = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };

    const placement = step.placement || 'right';
    const tipW = 320;
    const tipH = 180;
    const styleIndex = resolveStepArrowStyleIndex(step, progress.value.current - 1);
    const style = getArrowStyle(styleIndex);
    // Sit the card so the chosen swoop has room; gapX drives longer brand paths
    let tipTop = rect.top + style.tooltipNudgeY;
    let tipLeft = rect.left + rect.width + style.tooltipGapX;

    if (placement === 'left') {
      tipLeft = rect.left - tipW - style.tooltipGapX;
      tipTop = rect.top + style.tooltipNudgeY;
    } else if (placement === 'bottom') {
      tipTop = rect.top + rect.height + 72;
      tipLeft = rect.left + Math.max(0, (rect.width - tipW) / 2);
    } else if (placement === 'top') {
      tipTop = rect.top - tipH - 72;
      tipLeft = rect.left + Math.max(0, (rect.width - tipW) / 2);
    }

    tipLeft = Math.max(12, Math.min(tipLeft, window.innerWidth - tipW - 12));
    tipTop = Math.max(12, Math.min(tipTop, window.innerHeight - tipH - 12));
    tooltipPos.value = { top: tipTop, left: tipLeft };

    // Swap tooltip copy only once highlight + position match this step
    presentedStep.value = step;
    isLayoutPending.value = false;

    await nextTick();
    await waitFrames(2);
    if (gen !== measureGen) return;
    updateArrow(step.id);
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
    border: 1.5px solid rgba(14, 165, 233, 0.85);
    background: transparent;
    pointer-events: none;
    z-index: 1;
  }

  .app-tour__arrow {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    overflow: visible;
  }

  .app-tour__arrow-stroke {
    filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.55));
  }

  .app-tour__arrow-head {
    filter: drop-shadow(0 0 3px rgba(14, 165, 233, 0.45));
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
  /* Real-node outline only — no full-screen shadow (that hid the arrow) */
  .app-tour-target {
    border-radius: 8px !important;
    outline: 2px solid rgba(14, 165, 233, 0.95) !important;
    outline-offset: 2px;
  }
</style>
