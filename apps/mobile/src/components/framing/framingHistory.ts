import type { ManualFramingConfig } from '@clippster/shared-types'

export interface FramingHistory {
  present: ManualFramingConfig
  past: ManualFramingConfig[]
  future: ManualFramingConfig[]
}
export function commitFraming(
  history: FramingHistory,
  next: ManualFramingConfig,
  merge = false
): FramingHistory {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history
  return {
    present: next,
    past: merge ? history.past : [...history.past.slice(-99), history.present],
    future: []
  }
}
export function undoFraming(history: FramingHistory): FramingHistory {
  const previous = history.past.at(-1)
  return previous
    ? {
        present: previous,
        past: history.past.slice(0, -1),
        future: [history.present, ...history.future]
      }
    : history
}
export function redoFraming(history: FramingHistory): FramingHistory {
  const next = history.future[0]
  return next
    ? { present: next, past: [...history.past, history.present], future: history.future.slice(1) }
    : history
}
export function validateLayoutTiming(
  config: ManualFramingConfig,
  segmentId: string | null,
  start: number,
  end: number,
  duration: number
): string | null {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > duration
  )
    return 'Enter a start and end within the clip. End must follow start.'
  if (
    config.segmentConfigs?.some(
      (segment) =>
        segment.segmentId !== segmentId && start < segment.endTime && end > segment.startTime
    )
  )
    return 'Timed layouts cannot overlap. Choose another range.'
  return null
}
