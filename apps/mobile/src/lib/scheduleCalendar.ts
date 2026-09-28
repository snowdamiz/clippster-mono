/** Calendar cells use local dates so DST and UTC offsets cannot move a selection. */
export function calendarCells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= count; day++)
    cells.push(new Date(month.getFullYear(), month.getMonth(), day))
  while (cells.length % 7) cells.push(null)
  return cells
}

export function localScheduledDate(
  day: Date,
  hour: string,
  minute: string,
  period: 'AM' | 'PM'
): Date | null {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null
  const h = Number(hour)
  const m = Number(minute)
  if (h < 1 || h > 12 || m < 0 || m > 59) return null
  const clockHour = (h % 12) + (period === 'PM' ? 12 : 0)
  const result = new Date(day.getFullYear(), day.getMonth(), day.getDate(), clockHour, m)
  // Reject nonexistent local times during the spring DST change.
  if (result.getHours() !== clockHour || result.getMinutes() !== m) return null
  return result
}

export function toLocalScheduleValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
