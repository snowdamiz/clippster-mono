import { afterAll, expect, it, vi } from 'vitest'
import { runCreatorSkillAgent } from '../server/creatorSkillAgent'
import type { CreatorSkillApi } from '../server/creatorSkillApi'
import type { WebHyperframesWorkspace } from '../server/webHyperframesWorkspace'
import type { VideoSession } from '../../../client/src/ai-video/types'
import { readConfig } from '../server/config'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'

const session = { id: 7, media_items: [], speech_index: {}, aspect_ratio: '9:16' } as unknown as VideoSession
const workspace = {
  projectDir: join(tmpdir(), 'clippster-skill-agent-test', 'workspace'), gsapSrc: '', fonts: [],
  linkMedia: vi.fn(async () => ({ linked: [] })),
  ensureBrowser: vi.fn(async () => ({ path: '/browser' })),
} as unknown as WebHyperframesWorkspace
const config = readConfig({ ...process.env, WEB_DATA_DIR: join(tmpdir(), 'clippster-skill-agent-test') })
afterAll(() => rm(config.dataDir, { recursive: true, force: true }))

it('refunds the reserved run when the first AI turn fails', async () => {
  const api = {
    policy: vi.fn(async () => ({ credits: { generate: 10, revise: 5, reference: 2 }, max_output_seconds: 3600 })),
    startRun: vi.fn(async () => ({ id: 23 })),
    turn: vi.fn(async () => { throw new Error('Provider failed') }),
    fail: vi.fn(async () => ({ run: { id: 23, refunded: true } })),
  } as unknown as CreatorSkillApi
  await expect(runCreatorSkillAgent({ api, session, workspace, config, request: 'Edit clip', maxCreditsPerClip: 10, signal: new AbortController().signal, onPlaybookPackage: async () => {} })).rejects.toThrow('Provider failed')
  expect(api.fail).toHaveBeenCalledWith(23, 'Provider failed')
  expect(api.startRun).toHaveBeenCalledOnce()
})

it('recovers the run id and requests a refund when the reservation response is lost', async () => {
  const api = {
    policy: vi.fn(async () => ({ credits: { generate: 10, revise: 5, reference: 2 }, max_output_seconds: 3600 })),
    startRun: vi.fn(async () => { throw new Error('Connection lost') }),
    session: vi.fn(async () => ({ running_run: { id: 31, kind: 'generate' } })),
    fail: vi.fn(async () => ({ run: { id: 31, refunded: true } })),
  } as unknown as CreatorSkillApi
  await expect(runCreatorSkillAgent({ api, session, workspace, config, request: 'Edit clip', maxCreditsPerClip: 10, signal: new AbortController().signal, onPlaybookPackage: async () => {} })).rejects.toThrow('Connection lost')
  expect(api.fail).toHaveBeenCalledWith(31, 'Could not confirm run reservation')
})

it('does not reserve credits when the current edit price exceeds approval', async () => {
  const api = {
    policy: vi.fn(async () => ({ credits: { generate: 12 } })),
    startRun: vi.fn(),
  } as unknown as CreatorSkillApi
  await expect(runCreatorSkillAgent({ api, session, workspace, config, request: 'Edit clip', maxCreditsPerClip: 10, signal: new AbortController().signal, onPlaybookPackage: async () => {} })).rejects.toThrow('price rose')
  expect(api.startRun).not.toHaveBeenCalled()
})
