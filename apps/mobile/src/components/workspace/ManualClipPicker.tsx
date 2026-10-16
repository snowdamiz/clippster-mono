import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, PanResponder, Pressable, Text, View } from 'react-native'
import { AppIcon } from '@/components/AppIcon'
import { FilmstripFrames } from '@/components/timeline/FilmstripFrames'
import { TrimHandle } from '@/components/timeline/TrimHandle'
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer'
import { toVideoSource } from '@/lib/playbackVideo'
import { formatPlaybackClock } from '@/lib/formatTime'
import { tokens } from '@/theme/tokens'

type Range = { startTime: number; endTime: number }

export function ManualClipPicker({ videoPath, duration, value, onChange, fallbackUri }: {
  videoPath: string; duration: number; value: Range; onChange: (range: Range) => void; fallbackUri?: string
}) {
  const player = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer)
  const [width, setWidth] = useState(0)
  const [time, setTime] = useState(value.startTime)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(() => Math.max(1, duration / Math.max(60, value.endTime - value.startTime + 10)))
  const [windowStart, setWindowStart] = useState(() => Math.max(0, Math.min(duration - Math.min(duration, Math.max(60, value.endTime - value.startTime + 10)), value.startTime - 5)))
  const [status, setStatus] = useState(player.status)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const rangeRef = useRef(value)
  rangeRef.current = value
  const total = Math.max(duration, value.endTime, 0.1)
  const span = total / zoom
  const windowEnd = Math.min(total, windowStart + span)
  const pixelsPerSecond = width / span
  const seek = (seconds: number) => {
    player.currentTime = Math.max(0, Math.min(total, seconds))
    setTime(player.currentTime)
  }
  useEffect(() => {
    player.currentTime = rangeRef.current.startTime
    player.timeUpdateEventInterval = 0.1
  }, [player])
  useEventListener(player, 'playingChange', event => setPlaying(event.isPlaying))
  useEventListener(player, 'statusChange', event => { setStatus(event.status); setPlaybackError(event.error?.message ?? null) })
  useEventListener(player, 'timeUpdate', event => {
    const range = rangeRef.current
    if (event.currentTime >= range.endTime && player.playing) {
      player.pause()
      player.currentTime = range.startTime
      setTime(range.startTime)
    } else setTime(event.currentTime)
  })
  const moveRange = useRef((dx: number) => {})
  moveRange.current = dx => {
    const current = rangeRef.current
    const delta = Math.max(-current.startTime, Math.min(total - current.endTime, dx / pixelsPerSecond))
    const next = { startTime: current.startTime + delta, endTime: current.endTime + delta }
    rangeRef.current = next
    onChange(next)
    player.pause()
    seek(next.startTime)
  }
  const lastX = useRef(0)
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => { lastX.current = event.nativeEvent.pageX },
    onPanResponderMove: event => {
      moveRange.current(event.nativeEvent.pageX - lastX.current)
      lastX.current = event.nativeEvent.pageX
    }
  }), [])
  function trim(edge: 'start' | 'end', dx: number) {
    const current = rangeRef.current
    const minimum = Math.min(1, total)
    const next = edge === 'start'
      ? { ...current, startTime: Math.max(0, Math.min(current.endTime - minimum, current.startTime + dx / pixelsPerSecond)) }
      : { ...current, endTime: Math.min(total, Math.max(current.startTime + minimum, current.endTime + dx / pixelsPerSecond)) }
    rangeRef.current = next
    onChange(next)
    player.pause()
    seek(edge === 'start' ? next.startTime : next.endTime)
  }
  const left = Math.max(0, Math.min(width, (value.startTime - windowStart) * pixelsPerSecond))
  const right = Math.max(left, Math.min(width, (value.endTime - windowStart) * pixelsPerSecond))
  return (
    <View className="gap-4">
      <View className="overflow-hidden rounded-xl bg-black" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <VideoView player={player} nativeControls={false} contentFit="contain" style={{ width: '100%', height: Math.max(180, width * 9 / 16) }} />
        {status !== 'readyToPlay' ? <View className="absolute inset-0 items-center justify-center gap-2 p-4">
          {playbackError ? <Text className="text-center text-sm text-red-300">{playbackError}</Text> : <><ActivityIndicator color={tokens.colors.accent} /><Text className="text-xs text-muted">Loading video…</Text></>}
        </View> : null}
      </View>
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause selection' : 'Play selection'} className="rounded-full bg-accent p-3" onPress={() => {
          if (playing) player.pause()
          else { if (time < value.startTime || time >= value.endTime) seek(value.startTime); player.play() }
        }}><AppIcon name={playing ? 'Pause' : 'Play'} size={20} color="#000" /></Pressable>
        <Text className="font-mono text-sm text-foreground">{formatPlaybackClock(time)} / {formatPlaybackClock(total)}</Text>
      </View>
      <Text className="text-sm text-muted">Drag the ends to trim. Drag the selected section to move it. Tap a frame to preview.</Text>
      {width > 0 ? <View style={{ height: 76 }}>
        <Pressable onPress={event => { player.pause(); seek(windowStart + event.nativeEvent.locationX / pixelsPerSecond) }}>
          <FilmstripFrames path={videoPath} start={windowStart} end={windowEnd} width={width} height={76} fallbackUri={fallbackUri} />
        </Pressable>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: left, backgroundColor: '#0009' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: right, right: 0, top: 0, bottom: 0, backgroundColor: '#0009' }} />
        <View style={{ position: 'absolute', left, width: Math.max(2, right - left), top: 0, bottom: 0, borderTopWidth: 3, borderBottomWidth: 3, borderColor: tokens.colors.accent }}>
          <View {...pan.panHandlers} style={{ position: 'absolute', left: 20, right: 20, top: 0, bottom: 0 }} />
          <TrimHandle edge="start" onMove={dx => trim('start', dx)} />
          <TrimHandle edge="end" onMove={dx => trim('end', dx)} />
        </View>
        {time >= windowStart && time <= windowEnd ? <View pointerEvents="none" style={{ position: 'absolute', left: (time - windowStart) * pixelsPerSecond, width: 2, top: -4, bottom: -4, backgroundColor: '#fff' }} /> : null}
      </View> : null}
      <View className="flex-row justify-between"><Text className="text-xs text-muted">{formatPlaybackClock(windowStart)}</Text><Text className="text-xs text-muted">{formatPlaybackClock(windowEnd)}</Text></View>
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityLabel="Previous filmstrip section" onPress={() => setWindowStart(Math.max(0, windowStart - span / 2))}><AppIcon name="ChevronLeft" size={24} color={tokens.colors.foreground} /></Pressable>
        <Pressable accessibilityRole="button" className="rounded-lg border border-border px-3 py-2" onPress={() => {
          const next = zoom === 1 ? Math.max(1, total / Math.max(60, value.endTime - value.startTime + 10)) : 1
          setZoom(next)
          setWindowStart(next === 1 ? 0 : Math.max(0, Math.min(total - total / next, value.startTime - 5)))
        }}><Text className="text-xs text-foreground">{zoom === 1 ? 'Zoom to selection' : 'Show full video'}</Text></Pressable>
        <Pressable accessibilityLabel="Next filmstrip section" onPress={() => setWindowStart(Math.min(total - span, windowStart + span / 2))}><AppIcon name="ChevronRight" size={24} color={tokens.colors.foreground} /></Pressable>
      </View>
      <View className="rounded-xl border border-border bg-surface p-3">
        <Text className="text-sm text-foreground">{formatPlaybackClock(value.startTime)} – {formatPlaybackClock(value.endTime)}</Text>
        <Text className="mt-1 text-xs text-muted">Selected duration: {formatPlaybackClock(value.endTime - value.startTime)}</Text>
      </View>
    </View>
  )
}
