import { expect, it } from 'vitest'
import { creatorSkillPreviewVideoKbps } from '../server/creatorSkillPhonePreview'

it('budgets video bitrate below the 30 MB phone preview cap', () => {
  expect(creatorSkillPreviewVideoKbps(60)).toBeGreaterThan(3_000)
  expect(creatorSkillPreviewVideoKbps(60)).toBeLessThan(4_000)
  expect(creatorSkillPreviewVideoKbps(10)).toBe(7_000)
  expect(() => creatorSkillPreviewVideoKbps(0)).toThrow()
  expect(creatorSkillPreviewVideoKbps(60, 10)).toBeLessThan(creatorSkillPreviewVideoKbps(60, 30))
  expect(creatorSkillPreviewVideoKbps(60, 100)).toBeGreaterThan(creatorSkillPreviewVideoKbps(60, 10))
})
