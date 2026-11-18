import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export type CreatorSkillZipEntry = { name: string; path: string } | { name: string; content: Buffer }
type ScannedEntry = CreatorSkillZipEntry & { size: bigint; crc: number; md5: string }

const crcTable = new Uint32Array(256)
for (let index = 0; index < 256; index++) {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  crcTable[index] = value >>> 0
}

function updateCrc(crc: number, data: Buffer): number {
  let result = crc
  for (const byte of data) result = crcTable[(result ^ byte) & 0xff] ^ (result >>> 8)
  return result >>> 0
}

function chunks(entry: CreatorSkillZipEntry): AsyncIterable<Buffer> {
  if ('content' in entry) return (async function* () { yield entry.content })()
  return createReadStream(entry.path)
}

async function scan(entry: CreatorSkillZipEntry): Promise<ScannedEntry> {
  if (!entry.name || entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error('Invalid delivery archive entry name.')
  let size = 0n, crc = 0xffffffff
  const md5 = createHash('md5')
  for await (const chunk of chunks(entry)) { size += BigInt(chunk.length); crc = updateCrc(crc, chunk); md5.update(chunk) }
  return { ...entry, size, crc: (crc ^ 0xffffffff) >>> 0, md5: md5.digest('hex') }
}

function zip64Extra(values: bigint[]): Buffer {
  const buffer = Buffer.alloc(4 + values.length * 8)
  buffer.writeUInt16LE(1, 0)
  buffer.writeUInt16LE(values.length * 8, 2)
  values.forEach((value, index) => buffer.writeBigUInt64LE(value, 4 + index * 8))
  return buffer
}

function localHeader(entry: ScannedEntry): Buffer {
  const name = Buffer.from(entry.name, 'utf8'), extra = zip64Extra([entry.size, entry.size])
  const buffer = Buffer.alloc(30 + name.length + extra.length)
  buffer.writeUInt32LE(0x04034b50, 0)
  buffer.writeUInt16LE(45, 4)
  buffer.writeUInt16LE(0x0800, 6)
  buffer.writeUInt16LE(0x0021, 12)
  buffer.writeUInt32LE(entry.crc, 14)
  buffer.writeUInt32LE(0xffffffff, 18)
  buffer.writeUInt32LE(0xffffffff, 22)
  buffer.writeUInt16LE(name.length, 26)
  buffer.writeUInt16LE(extra.length, 28)
  name.copy(buffer, 30)
  extra.copy(buffer, 30 + name.length)
  return buffer
}

function centralHeader(entry: ScannedEntry, offset: bigint): Buffer {
  const name = Buffer.from(entry.name, 'utf8'), extra = zip64Extra([entry.size, entry.size, offset])
  const buffer = Buffer.alloc(46 + name.length + extra.length)
  buffer.writeUInt32LE(0x02014b50, 0)
  buffer.writeUInt16LE(45, 4)
  buffer.writeUInt16LE(45, 6)
  buffer.writeUInt16LE(0x0800, 8)
  buffer.writeUInt16LE(0x0021, 14)
  buffer.writeUInt32LE(entry.crc, 16)
  buffer.writeUInt32LE(0xffffffff, 20)
  buffer.writeUInt32LE(0xffffffff, 24)
  buffer.writeUInt16LE(name.length, 28)
  buffer.writeUInt16LE(extra.length, 30)
  buffer.writeUInt32LE(0xffffffff, 42)
  name.copy(buffer, 46)
  extra.copy(buffer, 46 + name.length)
  return buffer
}

function archiveEnd(entryCount: bigint, centralSize: bigint, centralOffset: bigint): Buffer {
  const buffer = Buffer.alloc(56 + 20 + 22)
  buffer.writeUInt32LE(0x06064b50, 0)
  buffer.writeBigUInt64LE(44n, 4)
  buffer.writeUInt16LE(45, 12)
  buffer.writeUInt16LE(45, 14)
  buffer.writeBigUInt64LE(entryCount, 24)
  buffer.writeBigUInt64LE(entryCount, 32)
  buffer.writeBigUInt64LE(centralSize, 40)
  buffer.writeBigUInt64LE(centralOffset, 48)
  buffer.writeUInt32LE(0x07064b50, 56)
  buffer.writeBigUInt64LE(centralOffset + centralSize, 64)
  buffer.writeUInt32LE(1, 72)
  buffer.writeUInt32LE(0x06054b50, 76)
  buffer.writeUInt16LE(0xffff, 84)
  buffer.writeUInt16LE(0xffff, 86)
  buffer.writeUInt32LE(0xffffffff, 88)
  buffer.writeUInt32LE(0xffffffff, 92)
  return buffer
}

/** Stream a ZIP64 delivery folder with checksums for every included artifact. */
export async function* creatorSkillZip(entries: CreatorSkillZipEntry[], folder: string, expectedMd5: Record<string, string> = {}): AsyncGenerator<Buffer> {
  if (!folder || folder.includes('/') || folder.includes('\\') || folder === '.' || folder === '..' || new Set(entries.map(entry => entry.name)).size !== entries.length || entries.some(entry => entry.name === 'checksums.md'))
    throw new Error('Invalid delivery archive layout.')
  const scanned: ScannedEntry[] = []
  for (const entry of entries) scanned.push(await scan(entry))
  for (const entry of scanned) if (expectedMd5[entry.name] && entry.md5 !== expectedMd5[entry.name])
    throw new Error(`${entry.name} changed since the edit was prepared.`)
  const manifest = Buffer.from(`# Delivery checksums\n\nMD5 for files in this archive:\n\n${scanned.map(entry => `${entry.md5}  ${entry.name}`).join('\n')}\n`)
  scanned.push(await scan({ name: 'checksums.md', content: manifest }))
  let offset = 0n
  const central: Buffer[] = []
  for (const entry of scanned) {
    const archived = { ...entry, name: `${folder}/${entry.name}` }
    const header = localHeader(archived)
    central.push(centralHeader(archived, offset))
    yield header
    offset += BigInt(header.length)
    let written = 0n, crc = 0xffffffff
    const md5 = createHash('md5')
    for await (const chunk of chunks(entry)) { written += BigInt(chunk.length); crc = updateCrc(crc, chunk); md5.update(chunk); yield chunk; offset += BigInt(chunk.length) }
    if (written !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc || md5.digest('hex') !== entry.md5) throw new Error(`${entry.name} changed while building the delivery archive.`)
  }
  const centralOffset = offset
  for (const header of central) { yield header; offset += BigInt(header.length) }
  yield archiveEnd(BigInt(scanned.length), offset - centralOffset, centralOffset)
}
