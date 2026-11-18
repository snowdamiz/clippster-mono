/** Report real elapsed stage time, including failures, without logging media or transcript contents. */
export async function timeCreatorSkillStage<T>(clipId: string, stage: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  console.info('[Clippster Skill timing]', { clipId, stage, event: 'started' });
  try {
    return await work();
  } finally {
    console.info('[Clippster Skill timing]', { clipId, stage, event: 'ended', seconds: Math.round((performance.now() - started) / 100) / 10 });
  }
}
