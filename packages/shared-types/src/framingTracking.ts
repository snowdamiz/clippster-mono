/** Crop positions use source-normalized coordinates and clip-relative seconds. */
export interface FramingKeyframe {
  time: number
  x: number
  y: number
  /** Jump at this point (a shot cut), rather than panning across it. */
  cut?: boolean
}

export interface AutoFramingInfo {
  version: 1
  reviewed: boolean
  sourceKey: string
  sourceIdentity?: { path: string; ranges: { start: number; end: number }[] }
  warnings: string[]
}

export function trackingPosition(
  points: FramingKeyframe[],
  time: number
): { x: number; y: number } {
  if (!points.length) throw new Error('A tracking path needs at least one point')
  let previous = points[0]
  for (const point of points) {
    if (time < point.time) {
      if (point.cut || point.time <= previous.time) return { x: previous.x, y: previous.y }
      const t = Math.max(0, (time - previous.time) / (point.time - previous.time))
      const eased = t * t * (3 - 2 * t)
      return {
        x: previous.x + (point.x - previous.x) * eased,
        y: previous.y + (point.y - previous.y) * eased
      }
    }
    previous = point
  }
  return { x: previous.x, y: previous.y }
}

export function trackedRegionAtTime<
  T extends { source: { x: number; y: number }; sourceKeyframes?: FramingKeyframe[] }
>(region: T, time: number): T {
  return region.sourceKeyframes?.length
    ? { ...region, source: { ...region.source, ...trackingPosition(region.sourceKeyframes, time) } }
    : region
}

/** Same smoothstep interpolation as the desktop FFmpeg renderer. */
export function trackingExpression(points: FramingKeyframe[], axis: 'x' | 'y'): string {
  if (!points.length) throw new Error('A tracking path needs at least one point')
  if (
    points.length > 5000 ||
    points.some(
      (p, i) =>
        !Number.isFinite(p.time) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1 ||
        (i > 0 && p.time <= points[i - 1].time)
    )
  )
    throw new Error('Invalid Auto framing tracking point')
  const terms = [points[0][axis].toFixed(6)]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    const delta = b[axis] - a[axis]
    if (Math.abs(delta) < 0.000001) continue
    const u = `clip((t-(${a.time.toFixed(6)}))/${(b.time - a.time).toFixed(6)},0,1)`
    terms.push(
      `(${delta.toFixed(6)})*${b.cut ? `gte(t,${b.time.toFixed(6)})` : `(${u}*${u}*(3-2*${u}))`}`
    )
  }
  const sum = (parts: string[]): string => {
    if (parts.length === 1) return parts[0]
    const middle = Math.floor(parts.length / 2)
    return `(${sum(parts.slice(0, middle))}+${sum(parts.slice(middle))})`
  }
  return sum(terms)
}
