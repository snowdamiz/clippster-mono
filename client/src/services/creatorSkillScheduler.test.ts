import { expect, it } from 'vitest';
import { runCreatorSkillBatch, withCreatorSkillEditSlot, withCreatorSkillRenderSlot } from './creatorSkillScheduler';

it('runs at most two clip edits together', async () => {
  let active = 0;
  let peak = 0;
  const seen: number[] = [];
  await runCreatorSkillBatch([1, 2, 3, 4], async item => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    seen.push(item);
    active--;
  });
  expect(peak).toBe(2);
  expect(seen.sort()).toEqual([1, 2, 3, 4]);
});

it('allows only one local render at a time', async () => {
  let active = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 3 }, () => withCreatorSkillRenderSlot(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
  })));
  expect(peak).toBe(1);
});

it('limits edits across separate batches and retries', async () => {
  let active = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 5 }, () => withCreatorSkillEditSlot(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
  })));
  expect(peak).toBe(2);
});
