/** IANA timezone for display: underscores → spaces (America/Los_Angeles → America/Los Angeles). */
export function formatTimezoneForDisplay(iana: string | null | undefined): string {
  if (!iana) return ''
  return iana.replace(/_/g, ' ')
}
