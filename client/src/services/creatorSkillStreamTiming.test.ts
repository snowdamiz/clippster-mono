import { expect, it } from 'vitest';
import { auditCreatorSkillStreamTiming } from './creatorSkillStreamTiming';

it('flags mux stream starts and lengths beyond the 20 ms review threshold', () => {
  expect(auditCreatorSkillStreamTiming(true, 19.9, 20)).toEqual([]);
  expect(auditCreatorSkillStreamTiming(true, 24, 31)).toEqual([
    'Export audio and video stream lengths differ by 24 ms; inspect synchronization.',
    'Export audio and video stream start times differ by 31 ms; inspect synchronization against the source.',
  ]);
});

it('distinguishes missing stream metadata from a silent clip', () => {
  expect(auditCreatorSkillStreamTiming(false, null, null)).toEqual([]);
  expect(auditCreatorSkillStreamTiming(true, null, null)).toHaveLength(2);
});
