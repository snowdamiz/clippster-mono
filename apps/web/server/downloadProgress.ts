// yt-dlp and FFmpeg emit progress in arbitrary pipe chunks, including CR-delimited stats.
export function downloadProgress(duration: number, update: (percent: number, message: string) => void) {
  let buffer = '', last = -1
  return (chunk: string) => {
    buffer += chunk
    const lines = buffer.split(/[\r\n]/)
    buffer = lines.pop()!.slice(-4096)
    for (const line of lines) {
      const percent = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/)
      const time = line.match(/(?:out_time=|\btime=)(\d+):(\d+):(\d+(?:\.\d+)?)/)
      const microseconds = line.match(/^out_time_(?:us|ms)=(\d+)/)
      const seconds = time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : microseconds ? Number(microseconds[1]) / 1_000_000 : null
      const value = percent ? Number(percent[1]) : seconds !== null && duration > 0 ? seconds / duration * 100 : null
      if (value === null || !Number.isFinite(value)) continue
      const progress = Math.round(10 + Math.min(100, Math.max(0, value)) * .45)
      if (progress > last) { last = progress; update(progress, 'Downloading source…') }
    }
  }
}
