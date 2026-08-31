export interface Point {
  x: number;
  y: number;
}

export type ArrowOrigin = 'top-left' | 'mid-left' | 'bottom-left';

/** Deterministic pseudo-random in [-1, 1] from a string seed + index */
function seededNoise(seed: string, i: number): number {
  let h = 2166136261;
  for (let c = 0; c < seed.length; c++) {
    h ^= seed.charCodeAt(c);
    h = Math.imul(h, 16777619);
  }
  h ^= i * 2654435761;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return ((h >>> 0) % 2000) / 1000 - 1;
}

export interface HandDrawnArrow {
  /** Shaft path `d` (ends at the base of the arrowhead) */
  path: string;
  /** Filled triangular head path `d` */
  arrowHead: string;
  mid: Point;
  styleIndex: number;
  origin: ArrowOrigin;
}

type ArrowKind = 'rise-from-below' | 'high-swoop' | 'gentle-arc' | 'loop-rise';

interface ArrowStyle {
  origin: ArrowOrigin;
  kind: ArrowKind;
  /** Extra px to push the tooltip down so the path has room to climb */
  tooltipNudgeY: number;
}

/** Rotate through these — includes bottom-left → up variants */
const ARROW_STYLES: readonly ArrowStyle[] = [
  { origin: 'bottom-left', kind: 'rise-from-below', tooltipNudgeY: 96 },
  { origin: 'top-left', kind: 'high-swoop', tooltipNudgeY: 64 },
  { origin: 'bottom-left', kind: 'loop-rise', tooltipNudgeY: 110 },
  { origin: 'mid-left', kind: 'gentle-arc', tooltipNudgeY: 80 },
] as const;

export const ARROW_STYLE_COUNT = ARROW_STYLES.length;

export function resolveArrowStyleIndex(stepOrdinal: number): number {
  const n = ARROW_STYLES.length;
  return ((stepOrdinal % n) + n) % n;
}

export function getArrowStyle(styleIndex: number): ArrowStyle {
  return ARROW_STYLES[resolveArrowStyleIndex(styleIndex)]!;
}

/** Gap from tooltip edge so the stroke never kisses the card */
export const ARROW_ENDPOINT_GAP = 28;

/** Tip sits on the bottom edge of the tab (bottom-middle) */
export const ARROW_TAB_BOTTOM_GAP = -2;

export function arrowStartFromTooltip(
  tip: { left: number; top: number; width: number; height: number },
  origin: ArrowOrigin,
  gap = ARROW_ENDPOINT_GAP
): Point {
  const x = tip.left - gap;
  if (origin === 'top-left') return { x, y: tip.top + 32 };
  if (origin === 'bottom-left') return { x, y: tip.top + tip.height - 36 };
  return { x, y: tip.top + tip.height * 0.45 };
}

/** Aim at the bottom-middle of the highlighted tab (slightly inside the bottom edge) */
export function arrowEndAtHotspot(
  hot: { left: number; top: number; width: number; height: number },
  gap = ARROW_TAB_BOTTOM_GAP
): Point {
  return {
    x: hot.left + hot.width * 0.5,
    y: hot.top + hot.height + gap,
  };
}

function controlPoints(
  from: Point,
  to: Point,
  kind: ArrowKind,
  seed: string,
  jitter: number
): { c1: Point; c2: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const n = (i: number, scale = jitter) => seededNoise(seed, i) * scale;

  // Always approach from below so the tip locks onto the tab’s bottom-middle
  if (kind === 'rise-from-below') {
    return {
      c1: {
        x: from.x + dx * 0.3 + n(1),
        y: from.y + 20 + n(2, 5),
      },
      c2: {
        x: to.x + n(3, 3),
        y: to.y + 48 + n(4, 4),
      },
    };
  }

  if (kind === 'loop-rise') {
    return {
      c1: {
        x: from.x + dx * 0.22 + n(1),
        y: from.y + 44 + n(2, 5),
      },
      c2: {
        x: to.x + n(3, 3),
        y: to.y + 64 + n(4, 4),
      },
    };
  }

  if (kind === 'high-swoop') {
    return {
      c1: {
        x: from.x + dx * 0.25 + n(1),
        y: from.y - 28 + n(2, 5),
      },
      c2: {
        x: to.x + 10 + n(3, 3),
        y: to.y + 52 + n(4, 4),
      },
    };
  }

  return {
    c1: {
      x: from.x + dx * 0.4 + n(1),
      y: from.y + dy * 0.35 + 8 + n(2, 5),
    },
    c2: {
      x: to.x + 12 + n(3, 3),
      y: to.y + 44 + n(4, 4),
    },
  };
}

/**
 * Hand-drawn cubic Bézier from tooltip toward the bottom-middle of the tab.
 * Solid triangular head (not a scribbly chevron).
 */
export function buildHandDrawnArrowPath(
  from: Point,
  to: Point,
  seed: string,
  styleIndex?: number,
  jitter = 8
): HandDrawnArrow {
  const idx =
    styleIndex !== undefined
      ? resolveArrowStyleIndex(styleIndex)
      : Math.abs(Math.floor(seededNoise(seed, 99) * 1000)) % ARROW_STYLES.length;
  const style = ARROW_STYLES[idx]!;
  const { c1, c2 } = controlPoints(from, to, style.kind, seed, jitter);

  const tip: Point = {
    x: to.x,
    y: to.y,
  };

  // Head always points up into the tab (destination is bottom-middle)
  const ux = 0;
  const uy = -1;
  const px = 1;
  const py = 0;

  const headLen = 12;
  const headWidth = 9;
  const base: Point = {
    x: tip.x - ux * headLen,
    y: tip.y - uy * headLen,
  };
  const left: Point = {
    x: base.x + px * headWidth,
    y: base.y + py * headWidth,
  };
  const right: Point = {
    x: base.x - px * headWidth,
    y: base.y - py * headWidth,
  };

  // Shaft ends at head base; slight curve noise only on controls, not the tip
  const path = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${base.x.toFixed(1)} ${base.y.toFixed(1)}`;

  const arrowHead = `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)} Z`;

  return {
    path,
    arrowHead,
    mid: { x: (from.x + tip.x) / 2, y: (from.y + tip.y) / 2 },
    styleIndex: idx,
    origin: style.origin,
  };
}

export function filterVisibleSteps(
  steps: import('./types').TourStep[],
  ctx: import('./types').TourContext
): import('./types').TourStep[] {
  return steps.filter((s) => (s.visible ? s.visible(ctx) : true));
}
