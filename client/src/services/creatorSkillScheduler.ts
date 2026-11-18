/** Keep independent clip edits moving without opening an unbounded number of AI runs. */
export async function runCreatorSkillBatch<T>(items: readonly T[], work: (item: T) => Promise<void>, concurrency = 2): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

function makeSlot(limit: number) {
  let active = 0;
  const waiters: Array<() => void> = [];
  return async <T>(work: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>(resolve => waiters.push(resolve));
    else active++;
    try {
      return await work();
    } finally {
      const next = waiters.shift();
      if (next) next();
      else active--;
    }
  };
}

export const withCreatorSkillEditSlot = makeSlot(2);
// Rendering uses the local browser and video encoder, so serialize only that step.
export const withCreatorSkillRenderSlot = makeSlot(1);
