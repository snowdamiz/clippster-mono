import type { TourPlacement, TourStep, TourContext } from './types';

export interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TooltipLayout {
  top: number;
  left: number;
  placement: TourPlacement;
  /** Offset of caret center along the pointing edge (px from top for left/right, from left for top/bottom) */
  caretOffset: number;
}

export const TOOLTIP_GAP = 14;
export const TOOLTIP_WIDTH = 320;
export const TOOLTIP_HEIGHT = 180;
export const CARET_SIZE = 10;

/**
 * Place the tooltip adjacent to the hotspot with a small gap.
 * Falls back to the opposite side when the preferred side doesn't fit.
 */
export function computeTooltipLayout(
  hot: RectBox,
  preferred: TourPlacement = 'right',
  tipW = TOOLTIP_WIDTH,
  tipH = TOOLTIP_HEIGHT,
  gap = TOOLTIP_GAP,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1280,
  vh = typeof window !== 'undefined' ? window.innerHeight : 800
): TooltipLayout {
  const pad = 12;
  const order = placementFallbacks(preferred);

  for (const placement of order) {
    const pos = rawPosition(hot, placement, tipW, tipH, gap);
    const fitsX = pos.left >= pad && pos.left + tipW <= vw - pad;
    const fitsY = pos.top >= pad && pos.top + tipH <= vh - pad;
    if (fitsX && fitsY) {
      return finalize(hot, pos.left, pos.top, placement, tipW, tipH, pad, vw, vh);
    }
  }

  // Last resort: clamp preferred placement into the viewport
  const fallback = rawPosition(hot, preferred, tipW, tipH, gap);
  return finalize(hot, fallback.left, fallback.top, preferred, tipW, tipH, pad, vw, vh);
}

function placementFallbacks(preferred: TourPlacement): TourPlacement[] {
  switch (preferred) {
    case 'left':
      return ['left', 'right', 'bottom', 'top'];
    case 'bottom':
      return ['bottom', 'top', 'right', 'left'];
    case 'top':
      return ['top', 'bottom', 'right', 'left'];
    case 'right':
    default:
      return ['right', 'left', 'bottom', 'top'];
  }
}

function rawPosition(
  hot: RectBox,
  placement: TourPlacement,
  tipW: number,
  tipH: number,
  gap: number
): { top: number; left: number } {
  const hotCx = hot.left + hot.width / 2;
  const hotCy = hot.top + hot.height / 2;

  switch (placement) {
    case 'left':
      return { left: hot.left - tipW - gap, top: hotCy - tipH / 2 };
    case 'bottom':
      return { left: hotCx - tipW / 2, top: hot.top + hot.height + gap };
    case 'top':
      return { left: hotCx - tipW / 2, top: hot.top - tipH - gap };
    case 'right':
    default:
      return { left: hot.left + hot.width + gap, top: hotCy - tipH / 2 };
  }
}

function finalize(
  hot: RectBox,
  left: number,
  top: number,
  placement: TourPlacement,
  tipW: number,
  tipH: number,
  pad: number,
  vw: number,
  vh: number
): TooltipLayout {
  const clampedLeft = Math.max(pad, Math.min(left, vw - tipW - pad));
  const clampedTop = Math.max(pad, Math.min(top, vh - tipH - pad));
  const caretOffset = computeCaretOffset(hot, clampedLeft, clampedTop, placement, tipW, tipH);
  return { top: clampedTop, left: clampedLeft, placement, caretOffset };
}

/** Align the caret toward the hotspot center, clamped inside the tooltip edge. */
function computeCaretOffset(
  hot: RectBox,
  tipLeft: number,
  tipTop: number,
  placement: TourPlacement,
  tipW: number,
  tipH: number
): number {
  const hotCx = hot.left + hot.width / 2;
  const hotCy = hot.top + hot.height / 2;
  const edgePad = CARET_SIZE + 8;

  if (placement === 'left' || placement === 'right') {
    const raw = hotCy - tipTop;
    return Math.max(edgePad, Math.min(raw, tipH - edgePad));
  }
  const raw = hotCx - tipLeft;
  return Math.max(edgePad, Math.min(raw, tipW - edgePad));
}

/**
 * Scroll a tour target into view when needed, but never shift horizontal scroll.
 * Horizontal nudging clips full-screen editor toolbars; tour positioning uses viewport rects.
 *
 * Page-header targets also reset the nearest vertical scrollport. During DashboardLayout's
 * fade transition (no out-in), the entering page stacks below the leaving one — without
 * this reset, scrollIntoView({ block: 'nearest' }) pins the new header to the bottom edge
 * and the spotlight keeps those stale coordinates.
 */
export function scrollTourTargetIntoView(el: HTMLElement): void {
  const winX = window.scrollX;
  const ancestors: { node: Element; scrollLeft: number }[] = [];
  let parent = el.parentElement;
  while (parent) {
    ancestors.push({ node: parent, scrollLeft: parent.scrollLeft });
    parent = parent.parentElement;
  }

  const inPageHeader = !!el.closest('.page-header');
  if (inPageHeader) {
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent) {
      const style = getComputedStyle(scrollParent);
      const oy = style.overflowY;
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        scrollParent.scrollHeight > scrollParent.clientHeight + 1
      ) {
        scrollParent.scrollTop = 0;
        break;
      }
      scrollParent = scrollParent.parentElement;
    }
  }

  el.scrollIntoView({
    block: inPageHeader ? 'nearest' : 'center',
    inline: 'nearest',
  });

  window.scrollTo(winX, window.scrollY);
  for (const { node, scrollLeft } of ancestors) {
    node.scrollLeft = scrollLeft;
  }
}

export function filterVisibleSteps(steps: TourStep[], ctx: TourContext): TourStep[] {
  return steps.filter((s) => (s.visible ? s.visible(ctx) : true));
}
