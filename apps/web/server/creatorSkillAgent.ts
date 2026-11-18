import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CreatorSkillPackage } from '@clippster/shared-types'
import { AgentTools } from '../../../client/src/ai-video/agent/tools'
import { driveAgentTurns } from '../../../client/src/ai-video/agent/turnLoop'
import { finalAgentDocument } from '../../../client/src/ai-video/agent/finalDocument'
import { linkProjectMedia, readCompositionFiles, writeCompiledDocument } from '../../../client/src/ai-video/runtime/project'
import { aspectFormat } from '../../../client/src/ai-video/director/aspect'
import type { VideoSession } from '../../../client/src/ai-video/types'
import type { Config } from './config'
import { run } from './process'
import { CreatorSkillApi } from './creatorSkillApi'
import { WebHyperframesWorkspace } from './webHyperframesWorkspace'

export interface CreatorSkillAgentResult {
  session: VideoSession
  playbookPackage: CreatorSkillPackage
  researchFetches: number
}

/** Run the existing agent protocol inside a web renderer. The caller persists package updates. */
export async function runCreatorSkillAgent(options: {
  api: CreatorSkillApi
  session: VideoSession
  workspace: WebHyperframesWorkspace
  config: Config
  request: string
  maxCreditsPerClip: number
  signal: AbortSignal
  onPlaybookPackage: (item: CreatorSkillPackage, researchFetches: number) => Promise<void>
}): Promise<CreatorSkillAgentResult> {
  const { api, session, workspace, config, request, maxCreditsPerClip, signal, onPlaybookPackage } = options
  signal.throwIfAborted()
  const policy = await api.policy(signal)
  if (policy.credits.generate > maxCreditsPerClip) throw new Error(`The AI edit price rose to ${policy.credits.generate} credits per clip. Review the new total before starting another run.`)
  // Prepare local rendering before reserving credits.
  const compileContext = await linkProjectMedia(workspace, session.media_items)
  await workspace.ensureBrowser({ signal })
  const snapshotDir = join(dirname(workspace.projectDir), 'snapshots')
  await mkdir(snapshotDir, { recursive: true })
  signal.throwIfAborted()
  // Do not abort the reservation HTTP response: the run id is needed to refund on cancellation.
  let paidRun: Awaited<ReturnType<CreatorSkillApi['startRun']>>
  try {
    paidRun = await api.startRun(session.id, request, maxCreditsPerClip)
  } catch (error) {
    // A response can disappear after the server reserved credits. This session belongs only to this clip.
    const recovered = await api.session(session.id).catch(() => null)
    if (recovered?.running_run?.kind === 'generate') {
      const refund = await api.fail(recovered.running_run.id, 'Could not confirm run reservation').catch(() => null)
      if (!refund) throw new Error('Could not confirm the AI edit or its credit refund. Check Billing before retrying.')
    } else if (!recovered) {
      throw new Error('Could not confirm whether the AI edit reserved credits. Check Billing before retrying.')
    }
    throw error
  }
  try {
    signal.throwIfAborted()
    const tools = new AgentTools({
      workspace,
      compileContext,
      media: session.media_items,
      sourceSegments: {},
      speechSegments: Object.fromEntries(session.media_items.map(item => [item.id, session.speech_index?.[item.contentHash] ?? []])),
      maxSeconds: policy.max_output_seconds,
      exampleKeyframes: [],
      snapshotDir,
      encodeImage: async path => {
        const output = join(snapshotDir, `agent-image-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
        await run(config.ffmpeg, ['-v', 'error', '-i', path, '-vf', 'scale=768:768:force_original_aspect_ratio=decrease', '-frames:v', '1', '-q:v', '5', '-y', output], signal)
        return (await readFile(output)).toString('base64')
      },
      signal,
    }, null)
    let researchFetches = 0
    await driveAgentTurns(
      await api.turn(paidRun.id, { brief: { format: aspectFormat(session.aspect_ratio === '16:9' ? '16:9' : '9:16'), music: null } }, signal),
      tools,
      results => api.turn(paidRun.id, { results }, signal),
      { onPlaybookPackage: async (item, fetches) => {
        researchFetches = fetches
        await onPlaybookPackage(item, fetches)
      } },
      signal,
    )
    if (!tools.document) throw new Error('The AI editor did not produce an edit.')
    if (!tools.playbookPackage) throw new Error('The AI editor did not submit the required playbook package.')
    const files = await readCompositionFiles(workspace)
    const document = finalAgentDocument(tools.document, files, session.media_items, policy.max_output_seconds)
    await writeCompiledDocument(workspace, document, compileContext)
    const completed = await api.complete(paidRun.id, document, files)
    return { session: completed.session, playbookPackage: tools.playbookPackage, researchFetches }
  } catch (error) {
    const refund = await api.fail(paidRun.id, signal.aborted ? 'Cancelled' : error instanceof Error ? error.message : 'The edit failed.').catch(() => null)
    if (!refund) throw new Error('The AI edit failed and its credit refund could not be confirmed. Check Billing before retrying.')
    throw error
  }
}
