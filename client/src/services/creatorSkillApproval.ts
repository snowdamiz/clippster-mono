import { getCreatorSkillEditsForSession } from '@/services/database/creator-skill-edits';
import { approveCreatorSkillSession } from '@/services/creator-skill-worker';

/** The detection confirmation already covers all requested edits and retries. */
export async function confirmCreatorSkillEdits(
  sessionIds: readonly string[],
  parentProjectId: string | null | undefined,
  onError: (error: unknown) => void,
): Promise<number> {
  const sessions = [...new Set(sessionIds.filter(Boolean))];
  if (!sessions.length) return 0;
  const counts = await Promise.all(sessions.map(async sessionId =>
    (await getCreatorSkillEditsForSession(sessionId)).filter(edit => edit.status === 'awaiting_approval').length));
  const count = counts.reduce((sum, value) => sum + value, 0);
  if (!count) return 0;
  sessions.forEach((sessionId, index) => {
    if (counts[index] > 0) void approveCreatorSkillSession(sessionId, parentProjectId).catch(onError);
  });
  return count;
}
