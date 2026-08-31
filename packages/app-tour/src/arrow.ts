export interface Point {
  x: number;
  y: number;
}

/** Where the shaft leaves the tooltip card */
export type ArrowOrigin = 'top-left' | 'mid-left' | 'bottom-left';

/**
 * Where the tip locks onto the highlighted `data-tour-id` target.
 * Tip is inset into the rect so it never sits on an adjacent nav row.
 */
export type TargetAnchor =
  | 'bottom-middle'
  | 'top-right'
  | 'center-right'
  | 'top-middle';

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
  targetAnchor: TargetAnchor;
}

/**
 * Curve personalities — consecutive steps rotate through these so swoops
 * never look identical. Kind + anchor + origin are paired intentionally.
 */
type ArrowKind = 'rise-from-below' | 'high-swoop' | 'side-arc' | 'loop-rise';

export interface ArrowStyle {
  origin: ArrowOrigin;
  targetAnchor: TargetAnchor;
  kind: ArrowKind;
  /** Extra px to push the tooltip down so the path has room to swoop */
  tooltipNudgeY: number;
  /** Horizontal gap between tooltip and target (longer = bigger swoop) */
  tooltipGapX: number;
}

/**
 * Shared coach-mark presets (Notion / Linear / Loom–style variety).
 *
 * Index | Origin      | Target         | Personality
 * ----- | ----------- | -------------- | -----------
 * 0     | bottom-left | bottom-middle  | rise-from-below
 * 1     | top-left    | top-right      | high-swoop
 * 2     | mid-left    | center-right   | side-arc
 * 3     | bottom-left | top-middle     | loop-rise
 *
 * Sidebar tour steps may set `arrowStyle` explicitly; otherwise the
 * step ordinal rotates through this table.
 */
const ARROW_STYLES: readonly ArrowStyle[] = [
  {
    origin: 'bottom-left',
    targetAnchor: 'bottom-middle',
    kind: 'rise-from-below',
    tooltipNudgeY: 88,
    tooltipGapX: 148,
  },
  {
    origin: 'top-left',
    targetAnchor: 'top-right',
    kind: 'high-swoop',
    tooltipNudgeY: 28,
    tooltipGapX: 156,
  },
  {
    origin: 'mid-left',
    targetAnchor: 'center-right',
    kind: 'side-arc',
    tooltipNudgeY: 12,
    tooltipGapX: 140,
  },
  {
    origin: 'bottom-left',
    targetAnchor: 'top-middle',
    kind: 'loop-rise',
    tooltipNudgeY: 100,
    tooltipGapX: 152,
  },
] as const;

export const ARROW_STYLE_COUNT = ARROW_STYLES.length;

export function resolveArrowStyleIndex(stepOrdinal: number): number {
  const n = ARROW_STYLES.length;
  return ((stepOrdinal % n) + n) % n;
}

export function getArrowStyle(styleIndex: number): ArrowStyle {
  return ARROW_STYLES[resolveArrowStyleIndex(styleIndex)]!;
}

/**
 * Resolve which preset to use for a step.
 * Prefers explicit `arrowStyle` on the step; falls back to ordinal rotation.
 */
export function resolveStepArrowStyleIndex(
  step: { arrowStyle?: number } | null | undefined,
  stepOrdinal: number
): number {
  if (step?.arrowStyle !== undefined) {
    return resolveArrowStyleIndex(step.arrowStyle);
  }
  return resolveArrowStyleIndex(stepOrdinal);
}

/** Gap from tooltip edge so the stroke never kisses the card */
export const ARROW_ENDPOINT_GAP = 28;

/** Tip inset into the hotspot so it reads clearly on the highlighted tab */
export const ARROW_TARGET_INSET = 7;

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

/**
 * Aim the tip at a specific anchor on the highlighted target.
 * Always inset into the rect — never on the boundary between nav rows.
 */
export function arrowEndAtHotspot(
  hot: { left: number; top: number; width: number; height: number },
  anchor: TargetAnchor = 'bottom-middle',
  inset = ARROW_TARGET_INSET
): Point {
  const { left, top, width, height } = hot;
  const cx = left + width * 0.5;
  const cy = top + height * 0.5;
  const insetX = Math.min(inset, Math.max(2, width * 0.35));
  const insetY = Math.min(inset, Math.max(2, height * 0.35));

  switch (anchor) {
    case 'top-right':
      return { x: left + width - insetX, y: top + insetY };
    case 'center-right':
      return { x: left + width - insetX, y: cy };
    case 'top-middle':
      return { x: cx, y: top + insetY };
    case 'bottom-middle':
    default:
      return { x: cx, y: top + height - insetY };
  }
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

  if (kind === 'rise-from-below') {
    // Drop slightly then climb into the bottom edge
    return {
      c1: {
        x: from.x + dx * 0.28 + n(1),
        y: from.y + 36 + n(2, 6),
      },
      c2: {
        x: to.x + n(3, 4),
        y: to.y + 42 + n(4, 5),
      },
    };
  }

  if (kind === 'high-swoop') {
    // Arc up then settle into the top-right corner
    return {
      c1: {
        x: from.x + dx * 0.22 + n(1),
        y: from.y - 48 + n(2, 6),
      },
      c2: {
        x: to.x + 28 + n(3, 4),
        y: to.y - 10 + n(4, 4),
      },
    };
  }

  if (kind === 'side-arc') {
    // Long horizontal swoop into the mid-right edge
    return {
      c1: {
        x: from.x + dx * 0.35 + n(1),
        y: from.y + dy * 0.15 + n(2, 6),
      },
      c2: {
        x: to.x + 36 + n(3, 4),
        y: to.y + n(4, 5),
      },
    };
  }

  // loop-rise: dip, then climb into the top edge
  return {
    c1: {
      x: from.x + dx * 0.2 + n(1),
      y: from.y + 56 + n(2, 6),
    },
    c2: {
      x: to.x - 8 + n(3, 4),
      y: to.y - 36 + n(4, 5),
    },
  };
}

function normalize(x: number, y: number): Point {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/**
 * Hand-drawn cubic Bézier from tooltip toward a varied target anchor.
 * Solid triangular head follows the approach tangent (readable, still sketchy).
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

  const tip: Point = { x: to.x, y: to.y };

  // End tangent of the cubic ≈ tip − c2 → head points along the approach
  const dir = normalize(tip.x - c2.x, tip.y - c2.y);
  // Slight seeded wobble so the head feels hand-inked, not CAD-perfect
  const wobble = seededNoise(seed, 40) * 0.08;
  const ux = dir.x * Math.cos(wobble) - dir.y * Math.sin(wobble);
  const uy = dir.x * Math.sin(wobble) + dir.y * Math.cos(wobble);
  const px = -uy;
  const py = ux;

  const headLen = 13;
  const headWidth = 8.5;
  const base: Point = {
    x: tip.x - ux * headLen,
    y: tip.y - uy * headLen,
  };
  const left: Point = {
    x: base.x + px * headWidth + seededNoise(seed, 41) * 0.6,
    y: base.y + py * headWidth + seededNoise(seed, 42) * 0.6,
  };
  const right: Point = {
    x: base.x - px * headWidth + seededNoise(seed, 43) * 0.6,
    y: base.y - py * headWidth + seededNoise(seed, 44) * 0.6,
  };

  const path = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${base.x.toFixed(1)} ${base.y.toFixed(1)}`;
  const arrowHead = `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)} Z`;

  return {
    path,
    arrowHead,
    mid: { x: (from.x + tip.x) / 2, y: (from.y + tip.y) / 2 },
    styleIndex: idx,
    origin: style.origin,
    targetAnchor: style.targetAnchor,
  };
}

export function filterVisibleSteps(
  steps: import('./types').TourStep[],
  ctx: import('./types').TourContext
): import('./types').TourStep[] {
  return steps.filter((s) => (s.visible ? s.visible(ctx) : true));
}
