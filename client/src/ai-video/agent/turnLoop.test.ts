import { describe, expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { TurnResponse } from '../types';
import { driveAgentTurns } from './turnLoop';

describe('shared AI edit turn loop', () => {
  it('persists a submitted playbook before requesting another potentially paid turn', async () => {
    const order: string[] = [];
    const playbook: CreatorSkillPackage = { funnel: { stage: 'trust', reason: 'Evidence led clip', metric: 'saves' }, claims: [], sources: [], sponsors: [], thumbnailConcepts: [], thumbnailHeadlines: [], platformCopy: [], reviewItems: [] };
    const tools = {
      playbookPackage: null as CreatorSkillPackage | null,
      progress: {},
      async run() {
        order.push('tool');
        tools.playbookPackage = playbook;
        return [{ id: 'package', content: 'Saved' }];
      },
    } as unknown as Parameters<typeof driveAgentTurns>[1];
    const initial = { type: 'tools', calls: [{ id: 'package', name: 'submit_playbook_package', arguments: {} }], text: '', research_fetches: 2 } as TurnResponse;
    await driveAgentTurns(initial, tools, async () => {
      order.push('next turn');
      return { type: 'finish', message: 'Done' };
    }, { onPlaybookPackage: async (_item, fetches) => { order.push(`save ${fetches}`); } });
    expect(order).toEqual(['tool', 'save 2', 'next turn']);
  });
});
