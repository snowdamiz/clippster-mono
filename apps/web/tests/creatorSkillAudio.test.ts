import { expect, it } from 'vitest'
import { parseCreatorSkillAudioMeasure } from '../server/creatorSkillAudio'

it('reads the final integrated loudness and true peak summary', () => {
  const log = 'I: -20.0 LUFS\nSummary:\nIntegrated loudness:\n  I: -14.2 LUFS\nTrue peak:\n  Peak: -1.5 dBFS\n'
  expect(parseCreatorSkillAudioMeasure(log)).toEqual({ lufs: -14.2, truePeak: -1.5 })
  expect(parseCreatorSkillAudioMeasure('no measurement')).toEqual({ lufs: null, truePeak: null })
})
