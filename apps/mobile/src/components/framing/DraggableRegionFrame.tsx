import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

interface DraggableRegionFrameProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  canvasWidth: number;
  canvasHeight: number;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onRemove?: () => void;
}

export function DraggableRegionFrame({
  x,
  y,
  width,
  height,
  color,
  canvasWidth,
  canvasHeight,
  onMove,
  onResize,
  onRemove,
}: DraggableRegionFrameProps) {
  const boxRef = useRef({ x, y, width, height });
  boxRef.current = { x, y, width, height };
  const startRef = useRef({ x, y, width, height });
  const onMoveRef = useRef(onMove);
  const onResizeRef = useRef(onResize);
  onMoveRef.current = onMove;
  onResizeRef.current = onResize;

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = { ...boxRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          onMoveRef.current(
            clamp01(startRef.current.x + gesture.dx / canvasWidth),
            clamp01(startRef.current.y + gesture.dy / canvasHeight),
          );
        },
      }),
    [canvasWidth, canvasHeight],
  );

  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = { ...boxRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          onResizeRef.current(
            clamp01(startRef.current.width + gesture.dx / canvasWidth),
            clamp01(startRef.current.height + gesture.dy / canvasHeight),
          );
        },
      }),
    [canvasWidth, canvasHeight],
  );

  const left = x * canvasWidth;
  const top = y * canvasHeight;
  const frameWidth = Math.max(24, width * canvasWidth);
  const frameHeight = Math.max(24, height * canvasHeight);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <View
        {...moveResponder.panHandlers}
        style={{
          position: 'absolute',
          left,
          top,
          width: frameWidth,
          height: frameHeight,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: `${color}33`,
        }}
      />
      <View
        {...resizeResponder.panHandlers}
        style={{
          position: 'absolute',
          left: left + frameWidth - 18,
          top: top + frameHeight - 18,
          width: 28,
          height: 28,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: '#ffffff',
          backgroundColor: color,
        }}
      />
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          style={{ position: 'absolute', left: left + frameWidth - 18, top: top - 10 }}
          className="h-5 w-5 items-center justify-center rounded-full bg-destructive"
        >
          <Text className="text-[10px] text-white">×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
