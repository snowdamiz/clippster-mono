import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMobileEditProject } from '../model/createProject'
import { secondsToTicks } from '../model/schema'
import { framedExportDocument } from './framedExportDocument'

describe('manual framing export document', () => {
  it('replaces the source montage while retaining captions, music and overlays', () => {
    const document = createMobileEditProject({
      kind: 'clip',
      targetId: 'clip',
      projectId: 'project',
      source: {
        uri: 'file:///source.mp4',
        fingerprint: 'source',
        durationSeconds: 30,
        sourceKind: 'vod',
        width: 1920,
        height: 1080,
        hasAudio: true
      },
      ranges: [{ startSeconds: 5, endSeconds: 15 }],
      now: 1,
      idFactory: (prefix) => prefix
    })
    const before = JSON.stringify(document)
    const prepared = framedExportDocument(document, 'file:///framed.mp4', secondsToTicks(10))
    assert.equal(JSON.stringify(document), before)
    assert.equal(prepared.canvas.activeRatio, '9:16')
    assert.equal(prepared.tracks.find((track) => track.kind === 'video')?.items[0].sourceStart, 0)
    for (const track of document.tracks.filter((track) => track.kind !== 'video'))
      assert.equal(
        prepared.tracks.find((next) => next.id === track.id),
        track
      )
    assert.equal(prepared.captionDocument, document.captionDocument)
    const asset = prepared.assets[document.id + '__framed_asset']
    assert.equal(asset.width, 1080)
    assert.equal(asset.height, 1920)
    assert.equal(asset.hasAudio, true)
  })
})
