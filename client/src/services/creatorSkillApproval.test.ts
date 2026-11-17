import { beforeEach, expect, it, vi } from 'vitest';

const { getEdits, approve } = vi.hoisted(() => ({ getEdits: vi.fn(), approve: vi.fn() }));
vi.mock('@/services/database/creator-skill-edits', () => ({ getCreatorSkillEditsForSession: getEdits }));
vi.mock('@/services/creator-skill-worker', () => ({ approveCreatorSkillSession: approve }));

import { confirmCreatorSkillEdits } from './creatorSkillApproval';

beforeEach(() => {
  vi.clearAllMocks();
  getEdits.mockImplementation(async (sessionId: string) => sessionId === 'a'
    ? [{ status: 'awaiting_approval' }, { status: 'awaiting_approval' }]
    : [{ status: 'needs_review' }]);
  approve.mockResolvedValue(undefined);
});

it('starts every prepaid edit without another credit approval', async () => {
  const count = await confirmCreatorSkillEdits(['a', 'b', 'a'], 'parent', vi.fn());
  expect(count).toBe(2);
  expect(approve).toHaveBeenCalledExactlyOnceWith('a', 'parent');
});

it('does not start edits for sessions without opted-in clips', async () => {
  expect(await confirmCreatorSkillEdits(['b'], null, vi.fn())).toBe(0);
  expect(approve).not.toHaveBeenCalled();
});
