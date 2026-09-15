import {
  TEMPLATE_ANALYZER_VERSION,
  TEMPLATE_COMPILER_VERSION,
  assignTemplateSlots,
  rationalToMilliseconds,
  type TemplateAssignmentResult,
  type TemplateBinding,
  type TemplateManifest,
  type TemplateSourceRange
} from '@clippster/template-schema'
import type { ClipEffect } from '@clippster/clip-export'

import type { EditorIdFactory } from '../model/ids'
import { buildCaptionPhrases } from '../captions/transcriptAdapter'
import {
  EDITOR_MAX_TICKS,
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type MobileEditProjectV3,
  type OverlayItem,
  type CaptionWord,
  type TimedTextItem,
  type TransitionItem,
  type VideoItem
} from '../model/schema'
import { parseMobileEditProject } from '../model/validation'

export interface MobileTemplateDraft {
  manifest: TemplateManifest
  assignment: TemplateAssignmentResult
  document: MobileEditProjectV3
}

function presentationEffects(manifest: TemplateManifest): ClipEffect[] {
  const effects: ClipEffect[] = []
  const colorEffect = {
    warm: 'warm',
    cool: 'cool',
    vibrant: 'saturation',
    cinematic: 'contrast',
    monochrome: 'grayscale'
  } as const
  if (manifest.presentation.colorTreatment !== 'neutral') {
    effects.push({
      type: colorEffect[manifest.presentation.colorTreatment],
      intensity: manifest.presentation.colorTreatment === 'monochrome' ? 100 : 16
    })
  }
  if (manifest.presentation.effect !== 'none' && manifest.presentation.effectIntensity > 0) {
    effects.push({
      type: manifest.presentation.effect,
      intensity: manifest.presentation.effectIntensity
    })
  }
  return effects
}

function applyTemplateTransitions(input: {
  items: VideoItem[]
  transition: Exclude<TemplateManifest['presentation']['transition'], 'cut' | 'flash'>
  durationTicks: number
  idFactory: EditorIdFactory
}): { items: VideoItem[]; transitions: TransitionItem[] } {
  const items = input.items.map((item) => ({ ...item }))
  const ordered = [...items].sort((left, right) => left.timelineStart - right.timelineStart)
  const transition =
    input.transition === 'crossfade' ? 'fade' : input.transition
  const transitions: TransitionItem[] = []
  for (let index = 1; index < ordered.length; index += 1) {
    const outgoing = ordered[index - 1]
    const incoming = ordered[index]
    if (incoming.timelineStart > outgoing.timelineEnd) continue
    const durationTicks = Math.min(
      input.durationTicks,
      Math.floor((outgoing.timelineEnd - outgoing.timelineStart) / 2),
      Math.floor((incoming.timelineEnd - incoming.timelineStart) / 2)
    )
    if (durationTicks <= 0) continue
    outgoing.timelineEnd = Math.max(outgoing.timelineEnd, incoming.timelineStart + durationTicks)
    outgoing.speed =
      (outgoing.sourceEnd - outgoing.sourceStart) /
      (outgoing.timelineEnd - outgoing.timelineStart)
    transitions.push({
      id: input.idFactory('template_transition'),
      kind: 'transition',
      fromItemId: outgoing.id,
      toItemId: incoming.id,
      transition,
      durationTicks
    })
  }
  return { items, transitions }
}

export function mobileTemplateCandidates(
  document: MobileEditProjectV3,
  manifest: TemplateManifest
): TemplateSourceRange[] {
  const preferredMs = Math.max(
    500,
    Math.round(
      manifest.slots.reduce(
        (total, slot) => total + rationalToMilliseconds(slot.targetDuration),
        0
      ) / manifest.slots.length
    )
  )
  const selectedRanges = new Map<string, Array<{ startMs: number; endMs: number }>>()
  if (document.kind === 'clip') {
    for (const track of document.tracks) {
      if (track.kind !== 'video') continue
      for (const item of track.items) {
        const ranges = selectedRanges.get(item.assetId) ?? []
        ranges.push({
          startMs: (item.sourceStart / 60_000) * 1000,
          endMs: (item.sourceEnd / 60_000) * 1000
        })
        selectedRanges.set(item.assetId, ranges)
      }
    }
  }
  return Object.values(document.assets).flatMap((asset) => {
    if (asset.kind === 'audio') return []
    const durationMs = (asset.durationTicks / 60_000) * 1000
    if (asset.kind === 'image') {
      return [
        {
          assetId: asset.id,
          sourceFingerprint: asset.sourceFingerprint,
          type: 'image' as const,
          mimeType: 'image/*',
          startMs: 0,
          endMs: preferredMs,
          durationMs: preferredMs,
          width: asset.width,
          height: asset.height,
          score: 0.6,
          tags: ['detail']
        }
      ]
    }
    const allowedRanges = selectedRanges.get(asset.id) ?? [{ startMs: 0, endMs: durationMs }]
    const ranges: TemplateSourceRange[] = []
    for (const allowed of allowedRanges) {
      const allowedDurationMs = allowed.endMs - allowed.startMs
      const windowMs = Math.min(allowedDurationMs, Math.max(preferredMs * 1.5, 2_000))
      const stepMs = Math.max(preferredMs, windowMs * 0.75)
      for (let startMs = allowed.startMs; startMs < allowed.endMs; startMs += stepMs) {
        const endMs = Math.min(allowed.endMs, startMs + windowMs)
        if (endMs - startMs < 500) break
        ranges.push({
          assetId: asset.id,
          sourceFingerprint: asset.sourceFingerprint,
          type: 'video',
          mimeType: 'video/*',
          startMs,
          endMs,
          durationMs: endMs - startMs,
          width: asset.width,
          height: asset.height,
          hasAudio: asset.hasAudio,
          score: 0.5 + Math.min(0.4, ranges.length * 0.01),
          tags: ranges.length === 0 ? ['hook', 'establishing'] : []
        })
      }
    }
    return ranges
  })
}

function rebaseCaptions(
  source: MobileEditProjectV3,
  videos: VideoItem[],
  idFactory: EditorIdFactory
): MobileEditProjectV3['captionDocument'] {
  const captionDocument = source.captionDocument
  if (!captionDocument || captionDocument.words.length === 0) return captionDocument
  const sourceWords = new Map<string, Array<{ word: string; start: number; end: number; confidence?: number }>>()
  for (const track of source.tracks) {
    if (track.kind !== 'video') continue
    for (const item of track.items) {
      const mapped = sourceWords.get(item.assetId) ?? []
      for (const word of captionDocument.words) {
        if (word.end <= item.timelineStart || word.start >= item.timelineEnd) continue
        const timelineStart = Math.max(word.start, item.timelineStart)
        const timelineEnd = Math.min(word.end, item.timelineEnd)
        mapped.push({
          word: word.word,
          start: item.sourceStart + Math.round((timelineStart - item.timelineStart) * item.speed),
          end: item.sourceStart + Math.round((timelineEnd - item.timelineStart) * item.speed),
          confidence: word.confidence
        })
      }
      sourceWords.set(item.assetId, mapped)
    }
  }
  const words: CaptionWord[] = []
  for (const item of videos) {
    for (const word of sourceWords.get(item.assetId) ?? []) {
      if (word.end <= item.sourceStart || word.start >= item.sourceEnd) continue
      const clippedStart = Math.max(word.start, item.sourceStart)
      const clippedEnd = Math.min(word.end, item.sourceEnd)
      const start = item.timelineStart + Math.round((clippedStart - item.sourceStart) / item.speed)
      const end = Math.min(
        item.timelineEnd,
        item.timelineStart + Math.round((clippedEnd - item.sourceStart) / item.speed)
      )
      if (end <= start) continue
      words.push({
        id: idFactory('template_caption_word'),
        word: word.word,
        start,
        end,
        confidence: word.confidence
      })
    }
  }
  words.sort((left, right) => left.start - right.start)
  return {
    ...captionDocument,
    words,
    phrases: buildCaptionPhrases(words, idFactory)
  }
}

export function compileMobileTemplate(input: {
  document: MobileEditProjectV3
  manifest: TemplateManifest
  idFactory: EditorIdFactory
  seed?: number
  lockedBindings?: TemplateBinding[]
  now?: number
}): MobileTemplateDraft {
  if (!input.manifest.compatibility.android) {
    throw new Error(`${input.manifest.name} is not compatible with Android`)
  }
  const presentationTransition = input.manifest.presentation.transition
  if (presentationTransition === 'flash') {
    throw new Error(`${input.manifest.name} uses a flash transition that Android cannot render`)
  }
  const assignment = assignTemplateSlots({
    manifest: input.manifest,
    candidates: mobileTemplateCandidates(input.document, input.manifest),
    seed: input.seed,
    lockedBindings: input.lockedBindings
  })
  const requiredMissing = assignment.warnings.find((warning) => warning.startsWith('Required'))
  if (requiredMissing) throw new Error(requiredMissing)
  const slotById = new Map(input.manifest.slots.map((slot) => [slot.id, slot]))
  const hasReplacementAudio = assignment.bindings.some(
    (binding) => slotById.get(binding.slotId)?.type === 'audio'
  )
  const videos: VideoItem[] = []
  const overlays: OverlayItem[] = []
  const effects = presentationEffects(input.manifest)
  let styleCursorTicks = 0
  assignment.bindings.forEach((binding) => {
    const slot = slotById.get(binding.slotId)
    const asset = input.document.assets[binding.assetId]
    if (!slot || !asset) throw new Error(`Missing media for slot ${binding.slotId}`)
    let sourceStart = secondsToTicks(binding.sourceStartMs / 1000)
    let sourceEnd = secondsToTicks(binding.sourceEndMs / 1000)
    let durationTicks =
      input.manifest.kind === 'style'
        ? Math.max(1, sourceEnd - sourceStart)
        : secondsToTicks(rationalToMilliseconds(slot.targetDuration) / 1000)
    if (asset.kind === 'image') {
      sourceStart = 0
      sourceEnd = Math.max(1, asset.durationTicks)
    } else {
      const maxEnd = Math.max(1, asset.durationTicks)
      sourceStart = Math.max(0, Math.min(sourceStart, maxEnd - 1))
      sourceEnd = Math.max(sourceStart + 1, Math.min(maxEnd, sourceEnd))
      let requestedSpeed = (sourceEnd - sourceStart) / durationTicks
      if (requestedSpeed < 0.25) {
        throw new Error(`Slot "${slot.label}" requires media long enough to avoid unsupported speed`)
      }
      if (requestedSpeed > 4) {
        sourceEnd = Math.min(maxEnd, sourceStart + durationTicks * 4)
        requestedSpeed = (sourceEnd - sourceStart) / durationTicks
        if (requestedSpeed > 4) {
          throw new Error(`Slot "${slot.label}" requires a longer source range for Android speed limits`)
        }
      }
    }
    const timelineStart =
      input.manifest.kind === 'style'
        ? styleCursorTicks
        : secondsToTicks(rationalToMilliseconds(slot.targetStart) / 1000)
    const timelineEnd = timelineStart + durationTicks
    if (input.manifest.kind === 'style') styleCursorTicks = timelineEnd
    if (timelineEnd > EDITOR_MAX_TICKS)
      throw new Error('Template exceeds Android editor duration policy')
    const common = {
      id: input.idFactory(asset.kind === 'image' ? 'template_image' : 'template_video'),
      assetId: asset.id,
      timelineStart,
      timelineEnd,
      sourceStart,
      sourceEnd,
      speed: asset.kind === 'image' ? 1 : (sourceEnd - sourceStart) / durationTicks,
      volume:
        hasReplacementAudio &&
        (slot.sourceAudioPolicy === 'mute' || slot.sourceAudioPolicy === 'replace')
          ? 0
          : hasReplacementAudio && slot.sourceAudioPolicy === 'duck'
            ? 0.3
            : 1,
      transform: createDefaultRatioAwareTransform({
        positionX: 0.5,
        positionY: 0.5,
        scaleX: 1,
        scaleY: 1,
        rotationDeg: 0,
        anchorX: 0.5,
        anchorY: 0.5,
        fit: slot.fit
      }),
      effectStack: effects.map((effect) => ({ ...effect })),
      templateSlotId: slot.id
    }
    if (asset.kind === 'image') {
      overlays.push({
        ...common,
        kind: 'overlay',
        opacity: 1,
        crop: { x: 0, y: 0, width: 1, height: 1 }
      })
    } else {
      videos.push({
        ...common,
        kind: 'video',
        pitchPolicy: 'preserve',
        label: slot.label
      })
    }
  })
  const now = input.now ?? Date.now()
  const existingStyleItems = input.document.tracks
    .filter((track) => track.kind === 'video' || track.kind === 'overlay')
    .reduce((count, track) => count + track.items.length, 0)
  const preserveStyleGraph =
    input.manifest.kind === 'style' && existingStyleItems >= input.manifest.slots.length
  const transitionKind =
    presentationTransition === 'crossfade'
      ? 'fade'
      : presentationTransition
  const transitionDuration = secondsToTicks(
    rationalToMilliseconds(input.manifest.presentation.transitionDuration) / 1000
  )
  const generatedTransitionPlan =
    transitionKind === 'cut'
      ? { items: videos, transitions: [] as TransitionItem[] }
      : applyTemplateTransitions({
          items: videos,
          transition: presentationTransition as Exclude<
            TemplateManifest['presentation']['transition'],
            'cut' | 'flash'
          >,
          durationTicks: transitionDuration,
          idFactory: input.idFactory
        })
  const transitionedVideos = generatedTransitionPlan.items
  const transitions = generatedTransitionPlan.transitions
  const titleDuration = Math.min(
    Math.max(0, ...[...videos, ...overlays].map((item) => item.timelineEnd)),
    secondsToTicks(rationalToMilliseconds(input.manifest.presentation.title.duration) / 1000)
  )
  const title: TimedTextItem = {
    id: input.idFactory('template_title'),
    kind: 'text',
    content: input.manifest.presentation.title.text,
    timelineStart: 0,
    timelineEnd: Math.max(1, titleDuration),
    style: {
      fontFamily: 'Inter',
      fontSize: input.manifest.presentation.title.style === 'bold' ? 72 : 58,
      color: '#ffffff',
      outlineColor: '#000000',
      outlineWidth: 3,
      backgroundColor:
        input.manifest.presentation.title.style === 'label'
          ? input.manifest.presentation.accentColor
          : undefined,
      alignment: 'center'
    },
    transform: createDefaultRatioAwareTransform({
      positionX: 0.5,
      positionY:
        input.manifest.presentation.title.position === 'top'
          ? 0.18
          : input.manifest.presentation.title.position === 'bottom'
            ? 0.82
            : 0.5,
      scaleX: 1,
      scaleY: 1,
      rotationDeg: 0,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'contain'
    }),
    animationIn: input.manifest.presentation.motion === 'none' ? undefined : 'pop',
    animationOut: 'fade',
    templateDecorationId: 'title'
  }
  let styleItemIndex = 0
  const tracks = input.document.tracks.map((track) => {
    if (preserveStyleGraph) {
      if (track.kind === 'video') {
        const items = track.items.map((item) => {
            const slot = input.manifest.slots[styleItemIndex % input.manifest.slots.length]
            const templateSlotId = slot.id
            styleItemIndex += 1
            return {
              ...item,
              templateSlotId,
              effectStack: effects.map((effect) => ({ ...effect })),
              volume:
                hasReplacementAudio &&
                (slot.sourceAudioPolicy === 'mute' ||
                  slot.sourceAudioPolicy === 'replace')
                  ? 0
                  : hasReplacementAudio && slot.sourceAudioPolicy === 'duck'
                    ? 0.3
                    : item.volume
            }
          })
        const styleTransitionPlan =
          transitionKind === 'cut'
            ? { items, transitions: [] as TransitionItem[] }
            : applyTemplateTransitions({
                items,
                transition: presentationTransition as Exclude<
                  TemplateManifest['presentation']['transition'],
                  'cut' | 'flash'
                >,
                durationTicks: transitionDuration,
                idFactory: input.idFactory
              })
        return {
          ...track,
          items: styleTransitionPlan.items,
          transitions: styleTransitionPlan.transitions
        }
      }
      if (track.kind === 'overlay') {
        return {
          ...track,
          items: track.items.map((item) => {
            const templateSlotId =
              input.manifest.slots[styleItemIndex % input.manifest.slots.length].id
            styleItemIndex += 1
            return {
              ...item,
              templateSlotId,
              effectStack: effects.map((effect) => ({ ...effect }))
            }
          })
        }
      }
      if (track.kind === 'text')
        return {
          ...track,
          items: [...track.items.filter((item) => item.templateDecorationId !== 'title'), title]
        }
      return track
    }
    if (track.kind === 'video') return { ...track, items: transitionedVideos, transitions }
    if (track.kind === 'overlay') return { ...track, items: overlays }
    if (track.kind === 'text') return { ...track, items: [title] }
    if (track.kind === 'audio') return { ...track, items: [] }
    return track
  })
  const document = parseMobileEditProject({
    ...input.document,
    tracks,
    captionDocument: preserveStyleGraph
      ? input.document.captionDocument
      : rebaseCaptions(input.document, transitionedVideos, input.idFactory),
    templateInstance: {
      templateId: input.manifest.id,
      templateVersionId: input.manifest.versionId,
      compilerVersion: TEMPLATE_COMPILER_VERSION,
      analyzerVersion: TEMPLATE_ANALYZER_VERSION,
      seed: assignment.seed,
      sourceLineage: Array.from(
        new Map(
          assignment.bindings.map((binding) => [
            binding.sourceFingerprint,
            { assetId: binding.assetId, sourceFingerprint: binding.sourceFingerprint }
          ])
        ).values()
      ),
      bindings: assignment.bindings,
      createdAt: new Date(now).toISOString()
    },
    updatedAt: now
  })
  return { manifest: input.manifest, assignment, document }
}
