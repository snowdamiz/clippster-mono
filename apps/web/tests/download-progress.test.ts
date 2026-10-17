import { describe, it, expect } from 'vitest'
import { downloadProgress } from '../server/downloadProgress'
describe('download progress', () => {
  it('tracks the selected range duration using split FFmpeg progress records', () => {
    const updates: number[] = [], progress = downloadProgress(1800, value => updates.push(value))
    progress('out_t'); progress('ime=00:15:00.000000\nout_time_us=900000000\n')
    progress('out_time=00:10:00.000000\nout_time=00:30:00.000000\n')
    expect(updates).toEqual([33, 55])
  })
  it('handles yt-dlp percentages and CR-delimited FFmpeg stats without invalid values', () => {
    const updates: number[] = [], progress = downloadProgress(60, value => updates.push(value))
    progress('[download] 20.0% of 100MiB\nframe=100 time=00:00:30.00 speed=20x\rout_time=N/A\n')
    expect(updates).toEqual([19, 33])
  })
})
