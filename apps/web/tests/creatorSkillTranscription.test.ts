import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Config } from '../server/config'
import { transcribeVideoWords } from '../server/clipTranscription'

vi.mock('../server/process', () => ({ run: vi.fn(async (_ffmpeg: string, args: string[]) => {
  await writeFile(args[args.length - 1], Buffer.from('test mp3'))
}) }))

afterEach(() => vi.unstubAllGlobals())

it('uses the existing free single-clip transcription request for the rendered audio', async () => {
  const work = await mkdtemp(join(tmpdir(), 'skill-final-transcript-'))
  try {
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      const form = options.body as FormData
      expect(form.get('free_single_clip')).toBe('true')
      expect(form.get('free_single_clip_total_duration')).toBe('45')
      expect(form.get('duration')).toBe('45')
      return new Response(JSON.stringify({ success: true, transcript: { words: [{ word: 'Hello', start: 0.1, end: 0.5 }] } }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetch)
    const words = await transcribeVideoWords({ apiUrl: 'https://api.example.com', ffmpeg: 'ffmpeg' } as Config, 'token', 'project', 'edited.mp4', 45, work, new AbortController().signal)
    expect(words).toEqual([{ word: 'Hello', start: 0.1, end: 0.5 }])
    expect(fetch).toHaveBeenCalledTimes(1)
  } finally { await rm(work, { recursive: true, force: true }) }
})
