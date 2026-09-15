import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_VIDEO_TEMPLATES,
  analyzeBeatEnergy,
  assignTemplateSlots,
  inspectTemplateArchive,
  migrateTemplateManifest,
  templatePreviewLook,
  validateTemplateManifest
} from './index'

describe('built-in video template catalog', () => {
  it('contains 14 immutable, valid, desktop and Android definitions', () => {
    expect(BUILT_IN_VIDEO_TEMPLATES).toHaveLength(14)
    expect(new Set(BUILT_IN_VIDEO_TEMPLATES.map((template) => template.id)).size).toBe(14)
    expect(
      new Set(BUILT_IN_VIDEO_TEMPLATES.map((template) => JSON.stringify(template.presentation)))
        .size
    ).toBeGreaterThanOrEqual(10)
    for (const template of BUILT_IN_VIDEO_TEMPLATES) {
      expect(validateTemplateManifest(template)).toMatchObject({ valid: true, errors: [] })
      expect(template.supportedAspectRatios).toContain('9:16')
      expect(template.compatibility.desktop).toBe(true)
      expect(template.compatibility.android).toBe(true)
      expect(Object.isFrozen(template)).toBe(true)
      expect(Object.isFrozen(template.slots)).toBe(true)
      for (const slot of template.slots) {
        expect(slot.description).not.toMatch(/Choose a [aeiou]|shot shot/i)
      }
      const preview = templatePreviewLook(template)
      expect(preview.name).toBe(template.name)
      expect(preview.actionLabel.length).toBeGreaterThan(8)
      expect(preview.plateCount).toBeGreaterThan(0)
      expect(preview.titleText).toBe(template.presentation.title.text)
    }
  })

  it('rejects unsupported schemas, unsafe paths, and unresolved assets', () => {
    const source = BUILT_IN_VIDEO_TEMPLATES[0]
    expect(validateTemplateManifest({ ...source, schemaVersion: 999 }).errors).toContain(
      'unsupported template schema version 999'
    )
    expect(
      validateTemplateManifest({
        ...source,
        assets: [{ ...source.assets[0], path: 'C:\\private\\cover.png' }, source.assets[1]]
      }).errors
    ).toContain('assets[0].path must be a safe relative path')
    expect(validateTemplateManifest({ ...source, coverAssetId: 'missing' }).errors).toContain(
      'coverAssetId does not reference an asset'
    )
  })

  it('returns actionable errors instead of throwing for hostile malformed objects', () => {
    const malformed = {
      schemaVersion: 1,
      slots: [null, { id: 12, bindings: [null] }],
      anchors: [null, { id: [], confidence: 4 }],
      assets: [null, { id: 3, path: 4 }],
      accessibility: { description: 5 },
      compatibility: {}
    }
    expect(() => validateTemplateManifest(malformed)).not.toThrow()
    const result = validateTemplateManifest(malformed)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('slots[0] must be an object')
    expect(result.errors).toContain('anchors[0] must be an object')
    expect(result.errors).toContain('assets[0] must be an object')
  })

  it('migrates from a clone without mutating the definition', () => {
    const source = BUILT_IN_VIDEO_TEMPLATES[0]
    const result = migrateTemplateManifest(source)
    expect(result.manifest).not.toBe(source)
    expect(result.manifest).toEqual(source)
    expect(result.migrated).toBe(false)
  })

  it('fills every built-in with two materially different media sets', () => {
    const longVod = [
      {
        assetId: 'vod',
        sourceFingerprint: 'vod-hash',
        type: 'video' as const,
        startMs: 0,
        endMs: 60_000,
        durationMs: 60_000,
        width: 1920,
        height: 1080,
        hasAudio: true,
        transcriptText: 'A spoken hook with a clear payoff',
        score: 0.8,
        tags: ['hook', 'speech', 'action', 'detail', 'payoff', 'outro']
      }
    ]
    const mixed = Array.from({ length: 12 }, (_, index) => ({
      assetId: `mixed-${index}`,
      sourceFingerprint: `mixed-hash-${index}`,
      type: 'video' as const,
      startMs: index * 1_000,
      endMs: index * 1_000 + 8_000,
      durationMs: 8_000,
      width: 1080,
      height: 1920,
      hasAudio: index % 2 === 0,
      transcriptText: index % 3 === 0 ? 'spoken moment' : undefined,
      score: 0.5 + index / 30,
      tags: [index === 0 ? 'hook' : index === 11 ? 'payoff' : 'action']
    }))
    for (const manifest of BUILT_IN_VIDEO_TEMPLATES) {
      for (const candidates of [longVod, mixed]) {
        const result = assignTemplateSlots({ manifest, candidates, seed: 9 })
        expect(result.bindings.length, manifest.id).toBe(manifest.slots.length)
        expect(
          result.warnings.filter((warning) => warning.startsWith('Required')),
          manifest.id
        ).toEqual([])
      }
    }
  })
})

describe('deterministic AutoFill', () => {
  const candidates = [
    {
      assetId: 'source-a',
      sourceFingerprint: 'hash-a',
      type: 'video' as const,
      startMs: 0,
      endMs: 30_000,
      durationMs: 30_000,
      width: 1080,
      height: 1920,
      hasAudio: true,
      transcriptText: 'This is the hook and payoff',
      score: 0.9,
      tags: ['hook', 'speech', 'payoff']
    },
    {
      assetId: 'source-b',
      sourceFingerprint: 'hash-b',
      type: 'video' as const,
      startMs: 1_000,
      endMs: 21_000,
      durationMs: 20_000,
      width: 1920,
      height: 1080,
      score: 0.7,
      tags: ['action', 'detail']
    }
  ]

  it('returns stable assignments, alternatives, and reason codes', () => {
    const manifest = BUILT_IN_VIDEO_TEMPLATES.find((item) => item.id === 'best-moments')!
    const first = assignTemplateSlots({ manifest, candidates, seed: 42 })
    const second = assignTemplateSlots({ manifest, candidates, seed: 42 })
    expect(first).toEqual(second)
    expect(first.bindings).toHaveLength(manifest.slots.length)
    expect(first.bindings.every((binding) => binding.reasonCodes.length > 0)).toBe(true)
  })

  it('preserves locked assignments during regeneration', () => {
    const manifest = BUILT_IN_VIDEO_TEMPLATES[1]
    const initial = assignTemplateSlots({ manifest, candidates, seed: 1 })
    const locked = { ...initial.bindings[0], locked: true }
    const regenerated = assignTemplateSlots({
      manifest,
      candidates: [...candidates].reverse(),
      seed: 2,
      lockedBindings: [locked]
    })
    expect(regenerated.bindings.find((binding) => binding.slotId === locked.slotId)).toEqual(locked)
  })

  it('rejects stale locks and enforces source reuse independently of overlap', () => {
    const source = BUILT_IN_VIDEO_TEMPLATES[0]
    const firstSlot = {
      ...source.slots[0],
      id: 'first',
      allowSourceReuse: false,
      fallback: 'error' as const
    }
    const manifest = {
      ...source,
      slots: [
        firstSlot,
        {
          ...firstSlot,
          id: 'second',
          label: 'Second',
          targetStart: { value: 1, timescale: 1 }
        }
      ]
    }
    const sameSource = [
      { ...candidates[0], assetId: 'range-a', startMs: 0, endMs: 8_000, durationMs: 8_000 },
      {
        ...candidates[0],
        assetId: 'range-b',
        startMs: 10_000,
        endMs: 18_000,
        durationMs: 8_000
      }
    ]
    const result = assignTemplateSlots({
      manifest,
      candidates: sameSource,
      lockedBindings: [
        {
          slotId: 'first',
          assetId: 'missing',
          sourceFingerprint: 'missing',
          sourceStartMs: 0,
          sourceEndMs: 1_000,
          score: 1,
          reasonCodes: ['creator-selected'],
          locked: true
        }
      ]
    })
    expect(result.bindings).toHaveLength(1)
    expect(result.warnings.some((warning) => warning.includes('locked slot'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('Second'))).toBe(true)
  })
})

describe('beat analysis and package security', () => {
  it('finds a consistent local onset interval', () => {
    const frames = Array.from({ length: 41 }, (_, index) => ({
      timeMs: index * 100,
      rms: index % 5 === 0 ? 1 : 0.1
    }))
    const result = analyzeBeatEnergy({
      sourceFingerprint: 'audio-hash',
      frames,
      sampleRate: 48_000
    })
    expect(result.bpm).toBe(120)
    expect(result.beats.length).toBeGreaterThan(4)
    expect(result.downbeats.length).toBeGreaterThan(1)
  })

  it('rejects traversal, links, bombs, duplicates, and encrypted entries', () => {
    const result = inspectTemplateArchive([
      { path: '../escape', compressedBytes: 1, uncompressedBytes: 1 },
      { path: 'assets/a', compressedBytes: 1, uncompressedBytes: 1, kind: 'symlink' },
      { path: 'ASSETS/A', compressedBytes: 1, uncompressedBytes: 1, encrypted: true },
      { path: 'huge', compressedBytes: 1, uncompressedBytes: 101 }
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('unsafe'))).toBe(true)
    expect(result.errors.some((error) => error.includes('forbidden kind'))).toBe(true)
    expect(result.errors.some((error) => error.includes('duplicated or confusable'))).toBe(true)
    expect(result.errors.some((error) => error.includes('encrypted'))).toBe(true)
    expect(result.errors.some((error) => error.includes('compression-ratio'))).toBe(true)
  })

  it('rejects malformed archive metadata without throwing', () => {
    const entries = [
      null,
      { path: 4, compressedBytes: -1, uncompressedBytes: Number.POSITIVE_INFINITY }
    ] as never
    expect(() => inspectTemplateArchive(entries)).not.toThrow()
    expect(inspectTemplateArchive(entries).valid).toBe(false)
  })

  it('rejects Windows device names and missing archive entry kinds', () => {
    const result = inspectTemplateArchive([
      { path: 'assets/CON.txt', compressedBytes: 1, uncompressedBytes: 1, kind: 'file' },
      { path: 'manifest.json', compressedBytes: 1, uncompressedBytes: 1 }
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes('unsafe'))).toBe(true)
    expect(result.errors.some((error) => error.includes('kind is required'))).toBe(true)
  })
})
