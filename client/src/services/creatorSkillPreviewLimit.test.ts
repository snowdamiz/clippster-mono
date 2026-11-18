import { expect, it } from 'vitest';
import { creatorSkillPreviewLimitMb } from './creatorSkillPreviewLimit';

it('honors a bounded creator preview limit and defaults invalid settings', () => {
  expect(creatorSkillPreviewLimitMb(10)).toBe(10);
  expect(creatorSkillPreviewLimitMb(undefined)).toBe(30);
  expect(creatorSkillPreviewLimitMb(0)).toBe(30);
  expect(creatorSkillPreviewLimitMb(500)).toBe(30);
});
