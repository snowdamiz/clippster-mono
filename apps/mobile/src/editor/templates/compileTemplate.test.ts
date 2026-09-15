import assert from 'node:assert/strict'
import test from 'node:test'

import { BUILT_IN_VIDEO_TEMPLATES } from '@clippster/template-schema'

import { createMobileEditProject } from '../model/createProject'
import { createDeterministicEditorIdFactory } from '../model/ids'
import { secondsToTicks } from '../model/schema'
import { validateMobileEditProject } from '../model/validation'
import { ApplyTemplateCommand } from './ApplyTemplateCommand'
import { compileMobileTemplate } from './compileTemplate'
import {
  ReplaceMediaAssetCommand,
  ReplaceTemplateSlotMediaCommand
} from '../commands/trackCommands'

function sourceProject() {
  return createMobileEditProject({
    kind: 'clip',
    targetId: 'clip-1',
    projectId: 'project-1',
    linkedClipId: 'clip-1',
    source: {
      uri: 'file:///source.mp4',
      fingerprint: 'source-hash',
      durationSeconds: 60,
      sourceKind: 'clip',
      sourceId: 'clip-1',
      width: 1080,
      height: 1920,
      hasAudio: true
    },
    ranges: [{ startSeconds: 0, endSeconds: 60 }],
    idFactory: createDeterministicEditorIdFactory('source'),
    now: 100
  })
}

test('all 14 built-ins compile into valid editable Android documents', () => {
  for (const manifest of BUILT_IN_VIDEO_TEMPLATES) {
    const draft = compileMobileTemplate({
      document: sourceProject(),
      manifest,
      idFactory: createDeterministicEditorIdFactory(manifest.id),
      seed: 7,
      now: 200
    })
    assert.equal(validateMobileEditProject(draft.document).valid, true, manifest.id)
    assert.equal(draft.document.templateInstance?.templateId, manifest.id)
    const items = draft.document.tracks.flatMap((track) => track.items)
    assert.ok(items.length > 0)
    assert.ok(
      draft.document.tracks
        .filter((track) => track.kind === 'video' || track.kind === 'overlay')
        .flatMap((track) => track.items)
        .every((item) => item.templateSlotId)
    )
    assert.ok(draft.document.tracks.some((track) => track.kind === 'text' && track.items.length > 0))
    const compiledVideo = draft.document.tracks.find((track) => track.kind === 'video')!
    assert.ok(compiledVideo.items.every((item) => item.effectStack.length > 0))
    assert.ok(compiledVideo.items.every((item) => item.volume === 1))
    if (compiledVideo.items.length > 1 && manifest.presentation.transition !== 'cut') {
      assert.equal(compiledVideo.transitions.length, compiledVideo.items.length - 1)
      for (const transition of compiledVideo.transitions) {
        const outgoing = compiledVideo.items.find((item) => item.id === transition.fromItemId)!
        const incoming = compiledVideo.items.find((item) => item.id === transition.toItemId)!
        assert.ok(outgoing.timelineEnd > incoming.timelineStart)
      }
    }
    assert.ok(items.every((item) => item.timelineEnd > item.timelineStart))
  }
})

test('mobile compilation is deterministic and one command restores the prior graph', () => {
  const before = sourceProject()
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'gaming-hype')!
  const create = () =>
    compileMobileTemplate({
      document: before,
      manifest,
      idFactory: createDeterministicEditorIdFactory('deterministic'),
      seed: 42,
      now: 200
    }).document
  assert.deepEqual(create(), create())
  const command = new ApplyTemplateCommand(create())
  const after = command.apply(before)
  const restored = command.invert(before).apply(after)
  assert.deepEqual(restored, before)
})

test('Android export graph keeps source ranges in asset bounds', () => {
  const before = sourceProject()
  for (const manifest of BUILT_IN_VIDEO_TEMPLATES) {
    const document = compileMobileTemplate({
      document: before,
      manifest,
      idFactory: createDeterministicEditorIdFactory(`bounds-${manifest.id}`),
      seed: 4
    }).document
    for (const track of document.tracks) {
      if (track.kind === 'text') continue
      for (const item of track.items) {
        const asset = document.assets[item.assetId]
        assert.ok(item.sourceStart >= 0)
        assert.ok(item.sourceEnd <= asset.durationTicks)
      }
    }
  }
})

test('slot media replacement keeps provenance synchronized through undo', () => {
  const manifest = BUILT_IN_VIDEO_TEMPLATES[0]
  const document = compileMobileTemplate({
    document: sourceProject(),
    manifest,
    idFactory: createDeterministicEditorIdFactory('replace'),
    seed: 1
  }).document
  const asset = Object.values(document.assets)[0]
  const replacement = {
    ...asset,
    sourceUri: 'file:///replacement.mp4',
    sourceFingerprint: 'replacement-hash'
  }
  const command = new ReplaceMediaAssetCommand(asset.id, replacement, 300)
  const replaced = command.apply(document)
  assert.ok(
    replaced.templateInstance?.bindings.every(
      (binding) => binding.sourceFingerprint === 'replacement-hash'
    )
  )
  assert.equal(validateMobileEditProject(replaced).valid, true)
  assert.deepEqual(command.invert(document).apply(replaced), { ...document, updatedAt: 300 })
})

test('slot replacement rejects media shorter than assigned source ranges', () => {
  const manifest = BUILT_IN_VIDEO_TEMPLATES[0]
  const document = compileMobileTemplate({
    document: sourceProject(),
    manifest,
    idFactory: createDeterministicEditorIdFactory('short-replacement'),
    seed: 1
  }).document
  const asset = Object.values(document.assets)[0]
  const replacement = {
    ...asset,
    sourceUri: 'file:///too-short.mp4',
    sourceFingerprint: 'too-short',
    durationTicks: 1
  }
  assert.throws(
    () => new ReplaceMediaAssetCommand(asset.id, replacement, 300).apply(document),
    /shorter than the source ranges/
  )
})

test('template shot replacement changes one reused slot without replacing sibling shots', () => {
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'best-moments')!
  const document = compileMobileTemplate({
    document: sourceProject(),
    manifest,
    idFactory: createDeterministicEditorIdFactory('slot-only'),
    seed: 1
  }).document
  const track = document.tracks.find((candidate) => candidate.kind === 'video')!
  const item = track.items[0]
  const originalAsset = document.assets[item.assetId]
  const replacement = {
    ...originalAsset,
    id: 'replacement-asset',
    sourceUri: 'file:///replacement.mp4',
    sourceFingerprint: 'replacement-only'
  }
  const command = new ReplaceTemplateSlotMediaCommand(
    item.id,
    item.templateSlotId!,
    replacement,
    301
  )
  const replaced = command.apply(document)
  const replacedTrack = replaced.tracks.find((candidate) => candidate.kind === 'video')!
  assert.equal(replacedTrack.items[0].assetId, replacement.id)
  assert.ok(replacedTrack.items.slice(1).every((sibling) => sibling.assetId === originalAsset.id))
  assert.equal(
    replaced.templateInstance!.bindings.find(
      (binding) => binding.slotId === item.templateSlotId
    )!.assetId,
    replacement.id
  )
  assert.deepEqual(command.invert(document).apply(replaced), document)
})

test('style templates preserve the existing editorial cut graph', () => {
  const before = sourceProject()
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'clean-podcast')!
  const after = compileMobileTemplate({
    document: before,
    manifest,
    idFactory: createDeterministicEditorIdFactory('style'),
    seed: 2
  }).document
  const beforeVideo = before.tracks.find((track) => track.kind === 'video')!
  const afterVideo = after.tracks.find((track) => track.kind === 'video')!
  assert.deepEqual(
    afterVideo.items.map((item) => item.id),
    beforeVideo.items.map((item) => item.id)
  )
  assert.equal(afterVideo.items[0].templateSlotId, manifest.slots[0].id)
})

test('style compilation keeps short source playback at natural speed', () => {
  const source = sourceProject()
  const asset = Object.values(source.assets)[0]
  const document = {
    ...source,
    assets: {
      [asset.id]: {
        ...asset,
        durationTicks: 5 * 60_000
      }
    },
    tracks: source.tracks.map((track) =>
      track.kind === 'video' ? { ...track, items: [], transitions: [] } : { ...track, items: [] }
    )
  }
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'clean-podcast')!
  const compiled = compileMobileTemplate({
    document,
    manifest,
    idFactory: createDeterministicEditorIdFactory('short-style'),
    seed: 1
  }).document
  const videoTrack = compiled.tracks.find((track) => track.kind === 'video')!
  assert.equal(videoTrack.items.length, 1)
  assert.equal(videoTrack.items[0].timelineEnd - videoTrack.items[0].timelineStart, 5 * 60_000)
  assert.equal(videoTrack.items[0].speed, 1)
})

test('Android rejects presentation capabilities it cannot render instead of flattening them', () => {
  const source = BUILT_IN_VIDEO_TEMPLATES[0]
  const unsupported = {
    ...source,
    presentation: { ...source.presentation, transition: 'flash' as const }
  }
  assert.throws(
    () =>
      compileMobileTemplate({
        document: sourceProject(),
        manifest: unsupported,
        idFactory: createDeterministicEditorIdFactory('unsupported')
      }),
    /Android cannot render/
  )
})

test('compiled video slots never extend past asset durationTicks', () => {
  const source = sourceProject()
  const assetId = Object.keys(source.assets)[0]!
  const asset = source.assets[assetId]!
  // Long enough for montage windows, short enough that tick rounding could overshoot without a clamp.
  const shortAsset = {
    ...asset,
    durationTicks: secondsToTicks(8)
  }
  const truncated = {
    ...source,
    assets: { ...source.assets, [assetId]: shortAsset },
    tracks: source.tracks.map((track) =>
      track.kind === 'video'
        ? {
            ...track,
            items: track.items.map((item) =>
              item.assetId === assetId
                ? {
                    ...item,
                    sourceStart: 0,
                    sourceEnd: shortAsset.durationTicks
                  }
                : item
            )
          }
        : track
    )
  }
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'best-moments')!
  const compiled = compileMobileTemplate({
    document: truncated,
    manifest,
    idFactory: createDeterministicEditorIdFactory('clamp-source'),
    seed: 1
  }).document
  for (const track of compiled.tracks) {
    if (track.kind !== 'video') continue
    for (const item of track.items) {
      assert.ok(item.sourceEnd <= shortAsset.durationTicks)
      assert.ok(item.sourceStart < item.sourceEnd)
    }
  }
})

test('clip Instant Edit never assigns footage outside selected source segments', () => {
  const source = createMobileEditProject({
    kind: 'clip',
    targetId: 'bounded-clip',
    source: {
      uri: 'file:///parent-vod.mp4',
      fingerprint: 'parent-vod',
      durationSeconds: 90,
      sourceKind: 'vod',
      width: 1080,
      height: 1920,
      hasAudio: true
    },
    ranges: [
      { startSeconds: 20, endSeconds: 30 },
      { startSeconds: 50, endSeconds: 62 }
    ],
    idFactory: createDeterministicEditorIdFactory('bounded-source')
  })
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'best-moments')!
  const compiled = compileMobileTemplate({
    document: source,
    manifest,
    idFactory: createDeterministicEditorIdFactory('bounded-template'),
    seed: 3
  }).document
  for (const binding of compiled.templateInstance!.bindings) {
    const inFirstSegment = binding.sourceStartMs >= 20_000 && binding.sourceEndMs <= 30_000
    const inSecondSegment = binding.sourceStartMs >= 50_000 && binding.sourceEndMs <= 62_000
    assert.equal(inFirstSegment || inSecondSegment, true)
  }
})

test('montage application rebases structured captions onto assigned ranges', () => {
  const source = sourceProject()
  const captionDocument = source.captionDocument!
  const words = Array.from({ length: 30 }, (_, index) => ({
    id: `source-word-${index}`,
    word: `word-${index}`,
    start: index * 120_000,
    end: index * 120_000 + 30_000
  }))
  const withCaptions = {
    ...source,
    captionDocument: {
      ...captionDocument,
      words,
      phrases: []
    }
  }
  const manifest = BUILT_IN_VIDEO_TEMPLATES.find((template) => template.id === 'best-moments')!
  const compiled = compileMobileTemplate({
    document: withCaptions,
    manifest,
    idFactory: createDeterministicEditorIdFactory('caption-rebase'),
    seed: 2
  }).document
  assert.ok(compiled.captionDocument!.words.length > 0)
  assert.ok(
    compiled.captionDocument!.words.every(
      (word) =>
        !word.id.startsWith('source-word-') &&
        compiled.tracks
          .find((track) => track.kind === 'video')!
          .items.some(
            (item) => word.start >= item.timelineStart && word.end <= item.timelineEnd
          )
    )
  )
  assert.ok(compiled.captionDocument!.phrases.length > 0)
})
