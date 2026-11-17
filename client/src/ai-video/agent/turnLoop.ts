import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { TurnResponse, ToolResult } from '../types';
import type { AgentTools, AgentProgress } from './tools';

type TurnTools = Pick<AgentTools, 'run' | 'playbookPackage' | 'progress'>;

/** Relay provider tool calls to either desktop or web workspace, saving the package before the next turn. */
export async function driveAgentTurns(
  response: TurnResponse,
  tools: TurnTools,
  nextTurn: (results: ToolResult[]) => Promise<TurnResponse>,
  callbacks: {
    onNote?: (text: string) => void;
    onProgress?: (progress: AgentProgress) => void;
    onPlaybookPackage?: (item: CreatorSkillPackage, researchFetches: number) => Promise<void> | void;
  } = {},
  signal?: AbortSignal,
): Promise<TurnResponse> {
  let savedPackage: CreatorSkillPackage | null = null;
  while (response.type === 'tools') {
    signal?.throwIfAborted();
    if (response.text.trim()) callbacks.onNote?.(response.text.trim());
    const results = await tools.run(response.calls);
    if (tools.playbookPackage && tools.playbookPackage !== savedPackage) {
      await callbacks.onPlaybookPackage?.(tools.playbookPackage, response.research_fetches ?? 0);
      savedPackage = tools.playbookPackage;
    }
    callbacks.onProgress?.({ ...tools.progress });
    signal?.throwIfAborted();
    response = await nextTurn(results);
  }
  return response;
}
