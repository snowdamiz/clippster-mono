import { it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig } from '../server/config'
import { extractCreatorSkillSource } from '../server/creatorSkillSource'

it('extracts discontiguous VOD ranges with audio without changing the source', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'clippster-skill-source-'))
  const work = join(directory, 'work')
  await mkdir(work)
  const config = readConfig({ ...process.env, WEB_DATA_DIR: directory })
  const source = join(directory, 'source.mp4')
  try {
    execFileSync(config.ffmpeg, [
      '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=5',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-c:v', 'libx264', '-c:a', 'aac', '-shortest', '-y', source,
    ])
    const result = await extractCreatorSkillSource({
      id: 'example',
      segments: [
        { start_time: 0.5, end_time: 1.5, duration: 1, transcript: null },
        { start_time: 2.5, end_time: 3.5, duration: 1, transcript: null },
      ],
    }, directory, work, config, AbortSignal.timeout(30_000))
    expect(result.duration).toBeCloseTo(2, 0)
    expect(result.hasAudio).toBe(true)
    expect(result.width).toBe(320)
    expect(result.height).toBe(180)
    expect(result.path).not.toBe(source)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
