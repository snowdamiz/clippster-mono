import { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { FilmstripFrames } from '@/components/timeline/FilmstripFrames';
import { PlayheadMarker } from '@/components/timeline/PlayheadMarker';
import { CLIP_ADJUST_CONTEXT_SECONDS, trimSelection } from '@/lib/clipAdjust';
import { formatClock } from '@/lib/formatTime';
import { tokens } from '@/theme/tokens';

const TRACK_HEIGHT = 88;
const HANDLE_WIDTH = 22;
const MIN_PPS = 8;

function EdgeHandle({
  edge,
  left,
  onMove,
}: {
  edge: 'start' | 'end';
  left: number;
  onMove: (dx: number) => void;
}) {
  const lastX = useRef(0);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          lastX.current = event.nativeEvent.pageX;
        },
        onPanResponderMove: (event) => {
          const x = event.nativeEvent.pageX;
          onMoveRef.current(x - lastX.current);
          lastX.current = x;
        },
      }),
    [],
  );

  const isStart = edge === 'start';

  return (
    <View
      {...pan.panHandlers}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
      style={{
        position: 'absolute',
        left: left - HANDLE_WIDTH / 2,
        top: -4,
        width: HANDLE_WIDTH,
        height: TRACK_HEIGHT + 8,
        zIndex: 20,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: HANDLE_WIDTH,
          height: '100%',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: isStart ? 10 : 3,
          borderBottomLeftRadius: isStart ? 10 : 3,
          borderTopRightRadius: isStart ? 3 : 10,
          borderBottomRightRadius: isStart ? 3 : 10,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: tokens.colors.accent,
        }}
      >
        <View style={{ gap: 4 }}>
          <View style={{ width: 9, height: 2, borderRadius: 1, backgroundColor: '#111111' }} />
          <View style={{ width: 9, height: 2, borderRadius: 1, backgroundColor: '#111111' }} />
          <View style={{ width: 9, height: 2, borderRadius: 1, backgroundColor: '#111111' }} />
        </View>
      </View>
    </View>
  );
}

export function AdjustClipTimeline({
  videoPath,
  bufferStart,
  bufferEnd,
  selectStart,
  selectEnd,
  currentTime,
  onSeek,
  onSelectionChange,
}: {
  videoPath: string;
  bufferStart: number;
  bufferEnd: number;
  selectStart: number;
  selectEnd: number;
  mediaDuration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onSelectionChange: (next: { selectStart: number; selectEnd: number }) => void;
  onExtendBuffer?: (edge: 'start' | 'end') => void;
  extending?: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const ppsRef = useRef(MIN_PPS);

  const bufferDuration = Math.max(0.1, bufferEnd - bufferStart);
  const pixelsPerSecond =
    trackWidth > 0 ? Math.max(MIN_PPS, trackWidth / bufferDuration) : MIN_PPS;
  ppsRef.current = pixelsPerSecond;

  const width = trackWidth > 0 ? trackWidth : Math.max(bufferDuration * pixelsPerSecond, 160);
  const selectLeft = (selectStart - bufferStart) * pixelsPerSecond;
  const selectWidth = Math.max(HANDLE_WIDTH * 2 + 8, (selectEnd - selectStart) * pixelsPerSecond);
  const playheadX = Math.max(0, Math.min(width, (currentTime - bufferStart) * pixelsPerSecond));

  const ticks = useMemo(() => {
    if (trackWidth <= 0) return [] as number[];
    const idealStep = bufferDuration <= 40 ? 5 : 10;
    const values: number[] = [];
    const first = Math.ceil(bufferStart / idealStep) * idealStep;
    for (let time = first; time <= bufferEnd + 0.001; time += idealStep) {
      values.push(Number(time.toFixed(3)));
    }
    return values;
  }, [bufferDuration, bufferEnd, bufferStart, trackWidth]);

  function onTrackLayout(event: LayoutChangeEvent) {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== trackWidth) setTrackWidth(next);
  }

  function applyTrim(edge: 'start' | 'end', dx: number) {
    const next = trimSelection({
      edge,
      deltaSeconds: dx / ppsRef.current,
      selectStart,
      selectEnd,
      bufferStart,
      bufferEnd,
    });
    onSelectionChange(next);
    onSeek(edge === 'start' ? next.selectStart : next.selectEnd);
  }

  return (
    <View className="min-h-40 flex-1 border-y border-border bg-black">
      <View className="flex-row items-center justify-between px-4 py-2">
        <View>
          <Text className="text-xs font-semibold text-foreground">Adjust range</Text>
          <Text className="text-[11px] tabular-nums text-muted">
            {formatClock(selectStart)} – {formatClock(selectEnd)} ·{' '}
            {formatClock(selectEnd - selectStart)}
          </Text>
        </View>
        <Text className="text-[10px] text-muted">
          Grey = ±{CLIP_ADJUST_CONTEXT_SECONDS}s context
        </Text>
      </View>

      <View className="flex-1 justify-center px-3 pb-3" onLayout={onTrackLayout}>
        <View style={{ width: '100%' }}>
          <View style={{ width, height: 16, marginBottom: 6 }}>
            {ticks.map((tick) => (
              <Text
                key={tick}
                className="absolute text-[10px] tabular-nums text-muted"
                style={{ left: Math.max(0, (tick - bufferStart) * pixelsPerSecond - 10) }}
              >
                {formatClock(tick)}
              </Text>
            ))}
          </View>

          <Pressable
            onPress={(event) => {
              onSeek(bufferStart + event.nativeEvent.locationX / pixelsPerSecond);
            }}
            style={{ width, height: TRACK_HEIGHT + 8 }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 4,
                width,
                height: TRACK_HEIGHT,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: '#0c0c0e',
              }}
            >
              {trackWidth > 0 ? (
                <FilmstripFrames
                  path={videoPath}
                  start={bufferStart}
                  end={bufferEnd}
                  width={width}
                  height={TRACK_HEIGHT}
                />
              ) : null}

              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: Math.max(0, selectLeft),
                  backgroundColor: 'rgba(0,0,0,0.62)',
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: selectLeft + selectWidth,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.62)',
                }}
              />
            </View>

            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: selectLeft,
                top: 4,
                width: selectWidth,
                height: TRACK_HEIGHT,
                borderWidth: 2,
                borderColor: tokens.colors.accent,
                borderRadius: 10,
                backgroundColor: 'rgba(14,165,233,0.08)',
              }}
            />

            <EdgeHandle edge="start" left={selectLeft} onMove={(dx) => applyTrim('start', dx)} />
            <EdgeHandle
              edge="end"
              left={selectLeft + selectWidth}
              onMove={(dx) => applyTrim('end', dx)}
            />

            <PlayheadMarker x={playheadX} height={TRACK_HEIGHT + 12} />
          </Pressable>

          <Text className="mt-2 text-center text-[10px] text-muted">
            Drag the white edges to change what gets saved
          </Text>
        </View>
      </View>
    </View>
  );
}
