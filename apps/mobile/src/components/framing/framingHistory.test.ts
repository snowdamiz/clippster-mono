import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createDefaultManualFramingConfig,
  createDefaultManualRegion
} from '@clippster/shared-types'
import {
  commitFraming,
  redoFraming,
  undoFraming,
  validateLayoutTiming,
  type FramingHistory
} from './framingHistory'
import { getActiveFramingRegions, getFramingPreviewRegions } from './framingRegions'

describe('mobile framing history and timing', () => {
  it('groups a property edit into one undo step and restores redo', () => {
    const initial = createDefaultManualFramingConfig()
    let history: FramingHistory = { present: initial, past: [], future: [] }
    history = commitFraming(history, { ...initial, blurAmount: 10 })
    history = commitFraming(history, { ...history.present, blurAmount: 20 }, true)
    assert.equal(history.past.length, 1)
    const undone = undoFraming(history)
    assert.deepEqual(undone.present, initial)
    assert.equal(redoFraming(undone).present.blurAmount, 20)
    assert.equal(commitFraming(undone, { ...initial, blurAmount: 5 }).future.length, 0)
  })
  it('rejects invalid and overlapping layouts but permits adjacent ranges', () => {
    const config = {
      ...createDefaultManualFramingConfig(),
      segmentConfigs: [{ segmentId: 'one', startTime: 5, endTime: 10, regions: [] }]
    }
    assert.ok(validateLayoutTiming(config, null, 8, 12, 20))
    assert.ok(validateLayoutTiming(config, null, 10, 25, 20))
    assert.ok(validateLayoutTiming(config, null, NaN, 5, 20))
    assert.equal(validateLayoutTiming(config, null, 10, 12, 20), null)
    assert.equal(validateLayoutTiming(config, 'one', 6, 10, 20), null)
  })
  it('switches adjacent layouts at the exact boundary and uses clip-relative B-roll offsets', () => {
    const region = createDefaultManualRegion(0)
    const config = {
      ...createDefaultManualFramingConfig(),
      regions: [],
      segmentConfigs: [
        { segmentId: 'one', startTime: 0, endTime: 5, regions: [region] },
        { segmentId: 'two', startTime: 5, endTime: 10, regions: [] }
      ],
      brollConfigs: [
        {
          brollId: 'broll',
          startTime: 5,
          endTime: 8,
          region: {
            ...region,
            mediaAssetId: 'file:///broll.mp4',
            mediaType: 'video' as const,
            mediaSourceOffset: 1
          }
        }
      ]
    }
    assert.equal(getActiveFramingRegions(config, 5).segmentIndex, 1)
    assert.equal(getFramingPreviewRegions(config, 6)[0].mediaSourceOffset, -4)
    assert.equal(getFramingPreviewRegions(config, 8).length, 0)
  })
})
