import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { tokens } from '@/theme/tokens';

const THUMB_SIZE = 16;
const TRACK_HEIGHT = 8;
const HIT_HEIGHT = 40;

interface SeekBarProps {
  minimumValue: number;
  maximumValue: number;
  value: number;
  step?: number;
  onValueChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
}

export function SeekBar({
  minimumValue,
  maximumValue,
  value,
  step = 1,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
}: SeekBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(value);
  const trackWidthRef = useRef(0);
  const originXRef = useRef(0);
  const trackRef = useRef<View>(null);
  const dragValueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const onStartRef = useRef(onSlidingStart);
  const onCompleteRef = useRef(onSlidingComplete);
  onValueChangeRef.current = onValueChange;
  onStartRef.current = onSlidingStart;
  onCompleteRef.current = onSlidingComplete;

  const range = maximumValue - minimumValue;
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const minRef = useRef(minimumValue);
  minRef.current = minimumValue;
  const maxRef = useRef(maximumValue);
  maxRef.current = maximumValue;
  const stepRef = useRef(step);
  stepRef.current = step;

  const displayed = dragging ? dragValue : value;
  const ratio = range > 0 ? (displayed - minimumValue) / range : 0;
  const thumbLeft = trackWidth > THUMB_SIZE ? ratio * (trackWidth - THUMB_SIZE) : 0;
  const thumbTop = (HIT_HEIGHT - THUMB_SIZE) / 2;

  const pickFromPageX = useCallback((pageX: number) => {
    const width = trackWidthRef.current;
    const span = rangeRef.current;
    if (width <= 0 || span <= 0) return value;
    const clamped = Math.max(0, Math.min(1, (pageX - originXRef.current) / width));
    const raw = minRef.current + clamped * span;
    const increment = stepRef.current;
    const stepped = increment > 0 ? Math.round(raw / increment) * increment : raw;
    return Math.max(minRef.current, Math.min(maxRef.current, stepped));
  }, [value]);

  const commit = useCallback((next: number) => {
    dragValueRef.current = next;
    setDragValue(next);
    onValueChangeRef.current(next);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          setDragging(true);
          onStartRef.current?.();
          trackRef.current?.measureInWindow((x) => {
            originXRef.current = x;
            commit(pickFromPageX(event.nativeEvent.pageX));
          });
        },
        onPanResponderMove: (event) => {
          commit(pickFromPageX(event.nativeEvent.pageX));
        },
        onPanResponderRelease: () => {
          setDragging(false);
          onCompleteRef.current?.(dragValueRef.current);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onCompleteRef.current?.(dragValueRef.current);
        },
      }),
    [commit, pickFromPageX],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }

  return (
    <View ref={trackRef} onLayout={handleLayout} {...panResponder.panHandlers} collapsable={false}>
      <View style={{ height: HIT_HEIGHT, justifyContent: 'center' }} accessibilityRole="adjustable">
        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: tokens.colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: TRACK_HEIGHT,
              width: `${Math.max(0, Math.min(100, ratio * 100))}%`,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: tokens.colors.accent,
            }}
          />
        </View>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: thumbTop,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            borderWidth: 2,
            borderColor: '#ffffff',
            backgroundColor: tokens.colors.primary,
          }}
        />
      </View>
    </View>
  );
}
