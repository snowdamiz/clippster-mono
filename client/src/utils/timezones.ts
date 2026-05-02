/**
 * Profile timezone picker: **curated** canonical IANA zones only (like Google/MS account settings),
 * not every city in the tz database. Sorted by current UTC offset. Stored value is always IANA.
 */

const FALLBACK_TIMEZONES: string[] = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

export function getAllTimeZoneIds(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (typeof fn === 'function') {
      return [...fn.call(Intl, 'timeZone')].sort((a, b) => a.localeCompare(b))
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_TIMEZONES]
}

/**
 * One representative zone per common “settings dropdown” row (major region / city),
 * ordered roughly west → east; final sort still uses live offset.
 */
const CANONICAL_ZONE_ROWS: ReadonlyArray<{ value: string; name: string }> = [
  { value: 'Pacific/Midway', name: 'Midway Island, Samoa' },
  { value: 'Pacific/Honolulu', name: 'Hawaii' },
  { value: 'America/Anchorage', name: 'Alaska' },
  { value: 'America/Los_Angeles', name: 'Pacific Time — Los Angeles' },
  { value: 'America/Phoenix', name: 'Mountain Time — Arizona (no DST)' },
  { value: 'America/Denver', name: 'Mountain Time — Denver' },
  { value: 'America/Chicago', name: 'Central Time — Chicago' },
  { value: 'America/Mexico_City', name: 'Mexico City' },
  { value: 'America/New_York', name: 'Eastern Time — New York' },
  { value: 'America/Toronto', name: 'Eastern Time — Toronto' },
  { value: 'America/Halifax', name: 'Atlantic Time — Halifax' },
  { value: 'America/Caracas', name: 'Caracas' },
  { value: 'America/Bogota', name: 'Bogotá' },
  { value: 'America/Lima', name: 'Lima' },
  { value: 'America/Santiago', name: 'Santiago' },
  { value: 'America/Argentina/Buenos_Aires', name: 'Buenos Aires' },
  { value: 'America/Sao_Paulo', name: 'São Paulo' },
  { value: 'Atlantic/South_Georgia', name: 'Mid-Atlantic' },
  { value: 'Atlantic/Azores', name: 'Azores' },
  { value: 'UTC', name: 'UTC' },
  { value: 'Europe/Lisbon', name: 'Lisbon' },
  { value: 'Europe/London', name: 'London, Dublin' },
  { value: 'Europe/Paris', name: 'Paris, Berlin, Rome' },
  { value: 'Europe/Warsaw', name: 'Warsaw, Prague' },
  { value: 'Europe/Athens', name: 'Athens, Bucharest' },
  { value: 'Africa/Cairo', name: 'Cairo' },
  { value: 'Europe/Istanbul', name: 'Istanbul' },
  { value: 'Asia/Jerusalem', name: 'Jerusalem' },
  { value: 'Asia/Baghdad', name: 'Baghdad' },
  { value: 'Asia/Dubai', name: 'Dubai' },
  { value: 'Asia/Tehran', name: 'Tehran' },
  { value: 'Asia/Karachi', name: 'Karachi' },
  { value: 'Asia/Kolkata', name: 'Mumbai, New Delhi' },
  { value: 'Asia/Kathmandu', name: 'Kathmandu' },
  { value: 'Asia/Dhaka', name: 'Dhaka' },
  { value: 'Asia/Bangkok', name: 'Bangkok, Jakarta' },
  { value: 'Asia/Singapore', name: 'Singapore' },
  { value: 'Asia/Hong_Kong', name: 'Hong Kong' },
  { value: 'Asia/Shanghai', name: 'Beijing, Shanghai' },
  { value: 'Asia/Taipei', name: 'Taipei' },
  { value: 'Asia/Tokyo', name: 'Tokyo' },
  { value: 'Asia/Seoul', name: 'Seoul' },
  { value: 'Australia/Perth', name: 'Perth' },
  { value: 'Australia/Adelaide', name: 'Adelaide' },
  { value: 'Australia/Sydney', name: 'Sydney, Melbourne' },
  { value: 'Pacific/Port_Moresby', name: 'Port Moresby' },
  { value: 'Pacific/Auckland', name: 'Auckland, Wellington' },
  { value: 'Pacific/Tongatapu', name: 'Tonga' },
]

/** Public profile / UI: show IANA with spaces instead of underscores (America/Los_Angeles → America/Los Angeles). */
export function formatTimezoneForDisplay(iana: string | null | undefined): string {
  if (!iana) return ''
  return iana.replace(/_/g, ' ')
}

/** Human-readable location from IANA id (e.g. America/New_York → New York). */
export function ianaLocationLabel(iana: string): string {
  if (iana === 'UTC' || iana === 'Etc/UTC' || iana === 'Etc/GMT') return 'UTC'
  const parts = iana.split('/')
  if (parts.length < 2) return iana.replace(/_/g, ' ')
  return parts.slice(1).join(' / ').replace(/_/g, ' ')
}

/** Parse GMT+05:30 / UTC-05:00 from Intl timeZoneName parts. */
function parseGmtOffsetToMinutes(s: string): number | null {
  const normalized = s.replace(/\u2212/g, '-').trim()
  const m = normalized.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?$/i)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const hours = parseInt(m[2], 10)
  const mins = m[3] ? parseInt(m[3], 10) : 0
  return sign * (hours * 60 + mins)
}

/**
 * Minutes east of UTC at `at` for this zone (e.g. New York winter → -300).
 */
export function getTimezoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  for (const name of ['longOffset', 'shortOffset'] as const) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: name,
      }).formatToParts(at)
      const raw = parts.find((p) => p.type === 'timeZoneName')?.value
      if (raw) {
        const parsed = parseGmtOffsetToMinutes(raw)
        if (parsed !== null) return parsed
      }
    } catch {
      /* continue */
    }
  }
  return 0
}

/** e.g. -300 → (UTC-05:00), 330 → (UTC+05:30) */
export function formatUtcOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const total = Math.abs(offsetMinutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `(UTC${sign}${hh}:${mm})`
}

export interface GlobalTimezoneOption {
  /** IANA id stored in the API */
  value: string
  /** Shown in UI */
  label: string
  offsetMinutes: number
}

/**
 * Curated timezone rows (major cities / regions only), sorted by current offset.
 * @param ensureIncluded — if set and not in the canonical list, one extra row is added so an existing profile value still appears.
 */
export function getGlobalTimezoneSelectOptions(
  at: Date = new Date(),
  ensureIncluded?: string | null
): GlobalTimezoneOption[] {
  const seen = new Set<string>()
  const rows: { value: string; name: string }[] = []

  for (const r of CANONICAL_ZONE_ROWS) {
    if (seen.has(r.value)) continue
    seen.add(r.value)
    rows.push({ ...r })
  }

  if (ensureIncluded && ensureIncluded.trim() && !seen.has(ensureIncluded)) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: ensureIncluded }).format(at)
      rows.push({
        value: ensureIncluded,
        name: `${ianaLocationLabel(ensureIncluded)} (your saved zone)`,
      })
    } catch {
      /* invalid IANA id for this engine */
    }
  }

  const options: GlobalTimezoneOption[] = rows.map(({ value, name }) => {
    const offsetMinutes = getTimezoneOffsetMinutes(value, at)
    const label = `${formatUtcOffsetLabel(offsetMinutes)} ${name}`
    return { value, label, offsetMinutes }
  })

  options.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes
    return a.label.localeCompare(b.label, 'en')
  })

  return options
}

/** @deprecated No longer used; list is small and depends on ensureIncluded. */
export function clearTimezoneOptionsCache(): void {}
