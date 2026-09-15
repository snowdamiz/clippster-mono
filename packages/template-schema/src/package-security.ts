export const TEMPLATE_PACKAGE_LIMITS = Object.freeze({
  maxCompressedBytes: 100 * 1024 * 1024,
  maxUncompressedBytes: 500 * 1024 * 1024,
  maxEntryBytes: 250 * 1024 * 1024,
  maxEntries: 2_000,
  maxPathDepth: 12,
  maxCompressionRatio: 100
})

export interface TemplateArchiveEntry {
  path: string
  compressedBytes: number
  uncompressedBytes: number
  kind?: 'file' | 'directory' | 'symlink' | 'hardlink' | 'device'
  encrypted?: boolean
  nestedArchive?: boolean
}

export interface TemplateArchiveInspection {
  valid: boolean
  errors: string[]
}

function normalizedPath(path: string): string {
  return path.replace(/\\/g, '/').normalize('NFC')
}

function hasWindowsReservedSegment(path: string): boolean {
  return path.split('/').some((segment) => {
    const canonical = segment.trimEnd().replace(/\.+$/g, '').toUpperCase()
    const base = canonical.split('.')[0]
    return (
      ['CON', 'PRN', 'AUX', 'NUL'].includes(base) ||
      /^COM[1-9]$/.test(base) ||
      /^LPT[1-9]$/.test(base)
    )
  })
}

export function inspectTemplateArchive(entries: TemplateArchiveEntry[]): TemplateArchiveInspection {
  const errors: string[] = []
  if (!Array.isArray(entries)) return { valid: false, errors: ['archive entries must be an array'] }
  if (entries.length > TEMPLATE_PACKAGE_LIMITS.maxEntries) {
    errors.push(`archive has more than ${TEMPLATE_PACKAGE_LIMITS.maxEntries} entries`)
  }
  let compressedTotal = 0
  let uncompressedTotal = 0
  const paths = new Set<string>()
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`entries[${index}] must be an object`)
      return
    }
    if (typeof entry.path !== 'string') {
      errors.push(`entries[${index}].path is unsafe`)
      return
    }
    const path = normalizedPath(entry.path)
    const lowerPath = path.toLocaleLowerCase('en-US')
    const validSizes =
      Number.isSafeInteger(entry.compressedBytes) &&
      entry.compressedBytes >= 0 &&
      Number.isSafeInteger(entry.uncompressedBytes) &&
      entry.uncompressedBytes >= 0
    if (!validSizes) errors.push(`entries[${index}] has invalid sizes`)
    const compressedBytes = validSizes ? entry.compressedBytes : 0
    const uncompressedBytes = validSizes ? entry.uncompressedBytes : 0
    compressedTotal += compressedBytes
    uncompressedTotal += uncompressedBytes
    if (
      !path ||
      path.startsWith('/') ||
      path.startsWith('//') ||
      /^[a-zA-Z]:/.test(path) ||
      path.includes('\0') ||
      path.split('/').includes('..') ||
      path.includes(':') ||
      hasWindowsReservedSegment(path)
    ) {
      errors.push(`entries[${index}].path is unsafe`)
    }
    if (path.split('/').filter(Boolean).length > TEMPLATE_PACKAGE_LIMITS.maxPathDepth) {
      errors.push(`entries[${index}].path is too deep`)
    }
    if (paths.has(lowerPath)) errors.push(`entries[${index}].path is duplicated or confusable`)
    paths.add(lowerPath)
    if (!entry.kind) errors.push(`entries[${index}].kind is required`)
    else if (entry.kind !== 'file' && entry.kind !== 'directory')
      errors.push(`entries[${index}] has forbidden kind ${entry.kind}`)
    if (entry.encrypted) errors.push(`entries[${index}] is encrypted`)
    if (entry.nestedArchive) errors.push(`entries[${index}] is a nested archive`)
    if (uncompressedBytes > TEMPLATE_PACKAGE_LIMITS.maxEntryBytes) {
      errors.push(`entries[${index}] exceeds per-entry limit`)
    }
    if (
      compressedBytes === 0
        ? uncompressedBytes > 0
        : uncompressedBytes / compressedBytes >
          TEMPLATE_PACKAGE_LIMITS.maxCompressionRatio
    ) {
      errors.push(`entries[${index}] exceeds compression-ratio limit`)
    }
  })
  if (compressedTotal > TEMPLATE_PACKAGE_LIMITS.maxCompressedBytes)
    errors.push('archive exceeds compressed-size limit')
  if (uncompressedTotal > TEMPLATE_PACKAGE_LIMITS.maxUncompressedBytes)
    errors.push('archive exceeds uncompressed-size limit')
  return { valid: errors.length === 0, errors }
}
