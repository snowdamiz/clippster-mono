import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calendarCells, localScheduledDate, toLocalScheduleValue } from './scheduleCalendar'

describe('local schedule calendar', () => {
  it('includes leap day and pads complete calendar weeks', () => {
    const cells = calendarCells(new Date(2028, 1, 1))
    assert.equal(cells.length % 7, 0)
    assert.equal(cells.filter(Boolean).length, 29)
    assert.equal(cells.filter(Boolean).at(-1)?.getDate(), 29)
  })
  it('converts noon and midnight without changing the selected day', () => {
    const day = new Date(2026, 8, 27)
    assert.equal(
      toLocalScheduleValue(localScheduledDate(day, '12', '05', 'AM')!),
      '2026-09-27T00:05'
    )
    assert.equal(
      toLocalScheduleValue(localScheduledDate(day, '12', '05', 'PM')!),
      '2026-09-27T12:05'
    )
    assert.equal(
      toLocalScheduleValue(localScheduledDate(day, '6', '30', 'PM')!),
      '2026-09-27T18:30'
    )
  })
  it('rejects incomplete and out-of-range clock values', () => {
    for (const [hour, minute] of [
      ['', '30'],
      ['0', '30'],
      ['13', '00'],
      ['6', '60'],
      ['6', '-1']
    ]) {
      assert.equal(localScheduledDate(new Date(2026, 8, 27), hour, minute, 'AM'), null)
    }
  })
  it('round-trips local schedule values without interpreting them as UTC', () => {
    const original = new Date(2026, 11, 31, 23, 45)
    assert.equal(new Date(toLocalScheduleValue(original)).getTime(), original.getTime())
  })
})
