import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { creatorSkillZip } from '../server/creatorSkillZip'

it('streams a dated, readable ZIP with nested artifacts and checked MD5 values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'creator-skill-zip-'))
  try {
    const source = join(dir, 'raw.mp4')
    const output = join(dir, 'package.zip')
    await writeFile(source, 'raw video bytes')
    const expected = createHash('md5').update('raw video bytes').digest('hex')
    const chunks: Buffer[] = []
    for await (const chunk of creatorSkillZip([
      { name: 'raw.mp4', path: source },
      { name: 'source-captures/0.txt', content: Buffer.from('dated source') },
    ], '2026-11-02-test', { 'raw.mp4': expected })) chunks.push(chunk)
    await writeFile(output, Buffer.concat(chunks))
    const names = execFileSync('tar', ['-tf', output], { encoding: 'utf8' })
    expect(names).toContain('2026-11-02-test/raw.mp4')
    expect(names).toContain('2026-11-02-test/source-captures/0.txt')
    expect(names).toContain('2026-11-02-test/checksums.md')
    expect(execFileSync('tar', ['-xOf', output, '2026-11-02-test/raw.mp4'], { encoding: 'utf8' })).toBe('raw video bytes')
    expect(execFileSync('tar', ['-xOf', output, '2026-11-02-test/source-captures/0.txt'], { encoding: 'utf8' })).toBe('dated source')
    expect(execFileSync('tar', ['-xOf', output, '2026-11-02-test/checksums.md'], { encoding: 'utf8' })).toContain(`${expected}  raw.mp4`)
    expect((await readFile(output)).length).toBeGreaterThan(100)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

it('rejects changed masters and unsafe archive names', async () => {
  await expect(async () => { for await (const _ of creatorSkillZip([{ name: 'edited-master.mp4', content: Buffer.from('changed') }], 'safe', { 'edited-master.mp4': 'wrong' })) { /* exhaust */ } }).rejects.toThrow('changed')
  await expect(async () => { for await (const _ of creatorSkillZip([{ name: '../escape', content: Buffer.from('x') }], 'safe')) { /* exhaust */ } }).rejects.toThrow('Invalid')
})
