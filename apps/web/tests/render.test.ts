import { it, expect } from 'vitest'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { renderClip, probe } from '../server/media'
import { readConfig } from '../server/config'
import { buildSubtitleAssContent } from '@clippster/clip-export'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
import type { WebProject, WebClip } from '@clippster/shared-types'
it('renders both segments of a silent landscape clip and uses the actual caption canvas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'clippster-silent-'))
  const work = join(directory, 'work')
  await mkdir(work)
  const config = readConfig({ ...process.env, WEB_DATA_DIR: directory })
  const signal = AbortSignal.timeout(60_000)
  try {
    execFileSync(config.ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x240:rate=24:duration=4',
      '-c:v',
      'libx264',
      '-y',
      join(directory, 'source.mp4')
    ])
    const segments = [
      { start_time: 0, end_time: 1, duration: 1, transcript: null },
      { start_time: 2, end_time: 3, duration: 1, transcript: null }
    ]
    const clip: WebClip = {
      id: 'silent',
      name: 'Silent clip',
      segments,
      aspectRatio: '16:9',
      captions: false,
      revision: 1,
      builtRevision: null
    }
    const project: WebProject = {
      id: 'test',
      name: 'Silent source',
      sourceUrl: null,
      status: 'ready',
      duration: 4,
      width: 320,
      height: 240,
      hasAudio: false,
      clips: [clip],
      words: [],
      error: null,
      createdAt: 0,
      updatedAt: 0
    }
    await renderClip(project, clip, directory, work, config, signal)
    const metadata = await probe(join(directory, 'silent.mp4'), config, signal)
    expect(metadata.duration).toBeCloseTo(2, 0)
    expect(metadata.hasAudio).toBe(false)
    expect(metadata.width).toBe(1920)
    expect(metadata.height).toBe(1080)
    const ass = buildSubtitleAssContent({
      settings: createDefaultSubtitleSettings(),
      targetRatio: '16:9',
      clipDuration: 2,
      words: [],
      outputPath: ''
    })
    expect(ass).toContain('PlayResX: 1920')
    expect(ass).toContain('PlayResY: 1080')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
