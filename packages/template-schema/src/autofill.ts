import {
  TEMPLATE_ANALYZER_VERSION,
  type TemplateAssignmentResult,
  type TemplateBinding,
  type TemplateManifest,
  type TemplateSlot,
  type TemplateSourceRange
} from './types'
import { rationalToMilliseconds } from './validation'

function seededNoise(seed: number, key: string): number {
  let hash = seed | 0
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 0x45d9f3b)
    hash ^= hash >>> 16
  }
  return (hash >>> 0) / 0xffffffff
}

function orientation(range: TemplateSourceRange): 'portrait' | 'landscape' | 'square' | 'any' {
  if (!range.width || !range.height) return 'any'
  const ratio = range.width / range.height
  if (ratio > 1.1) return 'landscape'
  if (ratio < 0.9) return 'portrait'
  return 'square'
}

function accepts(slot: TemplateSlot, range: TemplateSourceRange): boolean {
  if (
    !range.assetId ||
    !range.sourceFingerprint ||
    !Number.isFinite(range.startMs) ||
    !Number.isFinite(range.endMs) ||
    !Number.isFinite(range.durationMs) ||
    range.startMs < 0 ||
    range.endMs <= range.startMs ||
    range.durationMs <= 0 ||
    range.endMs - range.startMs > range.durationMs + 1
  )
    return false
  if (slot.type === 'video' && range.type !== 'video') return false
  if (slot.type === 'image' && range.type !== 'image') return false
  if (slot.type === 'audio' && range.type !== 'audio') return false
  if (slot.type === 'media' && range.type === 'audio') return false
  const mimeType =
    range.mimeType ??
    (range.type === 'video'
      ? 'video/*'
      : range.type === 'image'
        ? 'image/*'
        : 'audio/*')
  if (
    slot.acceptedMimeTypes.length > 0 &&
    !slot.acceptedMimeTypes.some(
      (accepted) =>
        accepted === mimeType ||
        (accepted.endsWith('/*') && mimeType.startsWith(accepted.slice(0, -1))) ||
        (mimeType.endsWith('/*') && accepted.startsWith(mimeType.slice(0, -1)))
    )
  )
    return false
  if (
    slot.orientation !== 'any' &&
    orientation(range) !== 'any' &&
    orientation(range) !== slot.orientation
  )
    return false
  return range.durationMs >= slot.sourceDurationMs.min || (range.type === 'image' && slot.allowLoop)
}

function scoreRange(slot: TemplateSlot, range: TemplateSourceRange, seed: number): TemplateBinding {
  const targetMs = rationalToMilliseconds(slot.targetDuration)
  const durationDelta = Math.abs(Math.min(range.durationMs, slot.sourceDurationMs.max) - targetMs)
  const durationScore = Math.max(0, 1 - durationDelta / Math.max(targetMs, 1))
  const tags = new Set((range.tags ?? []).map((tag) => tag.toLowerCase()))
  const semanticScore = tags.has(slot.role) ? 1 : tags.size === 0 ? 0.4 : 0.2
  const technicalScore = Math.max(0, Math.min(1, range.score ?? 0.5))
  const transcriptScore =
    slot.role === 'speech' || slot.role === 'hook' || slot.role === 'payoff'
      ? range.transcriptText?.trim()
        ? 0.9
        : 0.2
      : 0.5
  const tieBreaker = seededNoise(seed, `${slot.id}:${range.assetId}:${range.startMs}`) * 0.0001
  const score =
    durationScore * 0.3 +
    semanticScore * 0.35 +
    technicalScore * 0.25 +
    transcriptScore * 0.1 +
    tieBreaker
  const availableMs = Math.min(range.durationMs, slot.sourceDurationMs.max)
  const selectedMs = Math.min(Math.max(targetMs, slot.sourceDurationMs.min), availableMs)
  const maxStart = Math.max(range.startMs, range.endMs - selectedMs)
  const sourceStartMs = Math.min(Math.max(range.startMs, range.startMs), maxStart)
  const reasonCodes = [
    semanticScore >= 0.9 ? 'semantic-role-match' : 'semantic-fallback',
    durationScore >= 0.8 ? 'preferred-duration' : 'duration-adjusted',
    technicalScore >= 0.7 ? 'high-technical-score' : 'usable-technical-score'
  ]
  if (transcriptScore >= 0.9) reasonCodes.push('speech-evidence')
  return {
    slotId: slot.id,
    assetId: range.assetId,
    sourceFingerprint: range.sourceFingerprint,
    sourceStartMs,
    sourceEndMs: sourceStartMs + selectedMs,
    score,
    reasonCodes,
    locked: false
  }
}

function overlapsTooClosely(
  binding: TemplateBinding,
  selected: TemplateBinding[],
  minimumSeparationMs: number
): boolean {
  return selected.some(
    (current) =>
      current.sourceFingerprint === binding.sourceFingerprint &&
      binding.sourceStartMs < current.sourceEndMs + minimumSeparationMs &&
      binding.sourceEndMs > current.sourceStartMs - minimumSeparationMs
  )
}

function conflictsWithSelected(
  slot: TemplateSlot,
  binding: TemplateBinding,
  selected: TemplateBinding[]
): boolean {
  if (
    !slot.allowSourceReuse &&
    selected.some((current) => current.sourceFingerprint === binding.sourceFingerprint)
  )
    return true
  return overlapsTooClosely(binding, selected, slot.minimumSeparationMs ?? 0)
}

function lockedBindingIsValid(
  slot: TemplateSlot,
  binding: TemplateBinding,
  candidates: TemplateSourceRange[],
  selected: TemplateBinding[]
): boolean {
  const source = candidates.find(
    (candidate) =>
      candidate.assetId === binding.assetId &&
      candidate.sourceFingerprint === binding.sourceFingerprint &&
      binding.sourceStartMs >= candidate.startMs &&
      binding.sourceEndMs <= candidate.endMs &&
      binding.sourceEndMs > binding.sourceStartMs
  )
  return Boolean(source && accepts(slot, source) && !conflictsWithSelected(slot, binding, selected))
}

export function assignTemplateSlots(input: {
  manifest: TemplateManifest
  candidates: TemplateSourceRange[]
  seed?: number
  lockedBindings?: TemplateBinding[]
}): TemplateAssignmentResult {
  const seed = input.seed ?? 1
  const locked = new Map((input.lockedBindings ?? []).map((binding) => [binding.slotId, binding]))
  const bindings: TemplateBinding[] = []
  const alternatives: Record<string, TemplateBinding[]> = {}
  const warnings: string[] = []

  for (const slot of input.manifest.slots) {
    const lockedBinding = locked.get(slot.id)
    if (lockedBinding) {
      if (lockedBindingIsValid(slot, lockedBinding, input.candidates, bindings)) {
        bindings.push({ ...lockedBinding, locked: true })
        alternatives[slot.id] = []
        continue
      }
      warnings.push(
        `${slot.required ? 'Required' : 'Optional'} locked slot "${slot.label}" is no longer compatible`
      )
    }
    const ranked = input.candidates
      .filter((candidate) => accepts(slot, candidate))
      .map((candidate) => scoreRange(slot, candidate, seed))
      .sort((left, right) => right.score - left.score || left.assetId.localeCompare(right.assetId))
    const separated = ranked.find(
      (candidate) => !conflictsWithSelected(slot, candidate, bindings)
    )
    const selected =
      separated ?? (slot.allowSourceReuse && slot.fallback === 'reuse' ? ranked[0] : undefined)
    alternatives[slot.id] = ranked
      .filter(
        (candidate) =>
          candidate !== selected &&
          (slot.allowSourceReuse || !conflictsWithSelected(slot, candidate, bindings))
      )
      .slice(0, 3)
    if (selected) bindings.push(selected)
    else if (slot.required) warnings.push(`Required slot "${slot.label}" has no compatible source`)
    else warnings.push(`Optional slot "${slot.label}" was omitted`)
  }
  return { bindings, alternatives, warnings, analyzerVersion: TEMPLATE_ANALYZER_VERSION, seed }
}
