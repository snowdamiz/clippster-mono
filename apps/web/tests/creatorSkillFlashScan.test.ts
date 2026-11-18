import { describe, expect, it } from 'vitest'
import { detectCreatorSkillFlashes } from '../server/creatorSkillFlashScan'

describe('creator skill flash scan', () => {
  it('flags a brief bright pulse but not a lasting scene change', () => {
    const luma = [40, 42, 95, 94, 43, 44, 100, 101, 102, 100]
    const frames = luma.map((value, index) => ({ time: index / 30, luma: value }))
    expect(detectCreatorSkillFlashes(frames)).toEqual([2 / 30])
  })

  it('ignores normal brightness variation', () => {
    expect(detectCreatorSkillFlashes([30, 42, 28, 45].map((luma, index) => ({ time: index / 30, luma })))).toEqual([])
  })
})
