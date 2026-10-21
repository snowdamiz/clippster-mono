#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { copyFile, constants, chmod } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { loadSettings, createHttp, loadState, writeJson, withLock } from './core.mjs'
import { Providers, discover } from './discovery.mjs'
import { Clippster, processCampaign, resetFailedLead, bindCampaign } from './clippster.mjs'
import { writeReport } from './report.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const help = `Clippster streamer outreach — Node 24+, no npm dependencies

  node scripts/streamer-outreach/cli.mjs init
  node scripts/streamer-outreach/cli.mjs doctor
  node scripts/streamer-outreach/cli.mjs discover
  node scripts/streamer-outreach/cli.mjs clips
  node scripts/streamer-outreach/cli.mjs run
  node scripts/streamer-outreach/cli.mjs report
  node scripts/streamer-outreach/cli.mjs retry --lead twitch:channel

init       Create .env and config.json without overwriting existing files.
doctor     Verify configured API credentials and Clippster access (no AI jobs).
discover   Find low-viewer channels and X posts; save evidence and review files.
clips      Import selected recordings, detect/build 1–3 clips, prepare drafts.
run        Discover + clips. Re-running resumes the same campaign.
report     Rebuild the local review page and drafts without API access.
retry      After checking the workspace, reset failed/uncertain work for one lead.

Options: --config PATH  --env PATH  --lead PLATFORM:CHANNEL  --help
Secrets: scripts/streamer-outreach/.env (X_BEARER_TOKEN is the X search credential).
Defaults: 150 streamers, 5–100 current viewers, English, 3 clips, last 60 days on X.
Email, X messages and posts are always local drafts; this tool never sends them.
`

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      env: { type: 'string' },
      lead: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  })
  const command = positionals[0] || 'help'
  if (values.help || command === 'help') {
    console.log(help)
    return
  }
  if (positionals.length > 1 || !['init', 'doctor', 'discover', 'clips', 'run', 'report', 'retry'].includes(command))
    throw new Error(help)
  if (command === 'init') {
    for (const name of ['.env', 'config.json']) {
      try {
        await copyFile(resolve(directory, `${name}.example`), resolve(directory, name), constants.COPYFILE_EXCL)
        await chmod(resolve(directory, name), 0o600)
        console.log(`Created scripts/streamer-outreach/${name}`)
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
        console.log(`Kept existing scripts/streamer-outreach/${name}`)
      }
    }
    return
  }
  const { config, env } = await loadSettings(directory, values.config, values.env)
  const http = createHttp({
    secrets: Object.entries(env)
      .filter(([key]) => /TOKEN|SECRET|PASSWORD|KEY/.test(key))
      .map(([, value]) => value)
  })
  const providers = new Providers(env, http)
  const client = new Clippster(env, http)
  if (command === 'doctor') {
    let errors = 0
    for (const source of config.sources) {
      try {
        if (source === 'x') {
          const end = Date.now() - 30000
          await providers.get('x', `/tweets/search/${config.xDays > 7 ? 'all' : 'recent'}`, [
            ['query', config.xQuery],
            ['start_time', new Date(end - Math.min(config.xDays, 60) * 86400000 + 60000).toISOString()],
            ['end_time', new Date(end).toISOString()],
            ['max_results', '10']
          ])
        } else
          await providers.get(source, source === 'twitch' ? '/streams' : '/v2/livestreams', [
            [source === 'twitch' ? 'first' : 'limit', '1']
          ])
        console.log(`${source}: access OK`)
      } catch (error) {
        errors++
        console.error(`${source}: ${http.redact(error.message)}`)
      }
    }
    try {
      await client.login()
      const result = await client.web('/projects')
      console.log(`Clippster: signed in; ${result.projects.length}/20 workspace project slots used.`)
    } catch (error) {
      errors++
      console.error(http.redact(error.message))
    }
    if (errors) process.exitCode = 1
    return
  }
  await withLock(config.outputDir, async () => {
    const state = await loadState(config.outputDir, config)
    const save = () => writeJson(resolve(config.outputDir, 'state.json'), state)
    const context = { config, env, state, providers, client, http, save, log: console.log }
    await save()
    try {
      if (command === 'discover' || command === 'run') await discover(context)
      if (command === 'clips' || command === 'run') {
        if (!state.selected?.length)
          throw new Error('No selected channels. Run discover and check review.html for access errors.')
        await processCampaign(context)
      }
      if (command === 'retry') {
        if (!values.lead) throw new Error('retry requires --lead twitch:channel or --lead kick:channel.')
        await bindCampaign(context)
        await resetFailedLead(context, values.lead)
        console.log(`Reset ${values.lead}. Run clips to continue.`)
      }
    } finally {
      await writeReport(state, config.outputDir)
      console.log(`Review: ${resolve(config.outputDir, 'review.html')}`)
    }
    if (
      Object.values(state.discovery).some((d) => d.error || d.truncated) ||
      (state.selected || []).some((id) => state.leads[id].error) ||
      ((command === 'discover' || command === 'run') && (state.selected?.length || 0) < config.targetStreamers)
    ) {
      console.log(
        'Some work is incomplete or needs attention. See the review page for exact coverage and per-channel results.'
      )
      process.exitCode = 2
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
