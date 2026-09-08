import type { ManualRegionRect } from '@clippster/shared-types';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

interface DraggableRegionFrameProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string;
  isSelected?: boolean;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatioLocked?: boolean;
  onChange: (rect: ManualRegionRect) => void;
  onSelect?: () => void;
  onRemove?: () => void;
}

type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

function contrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.5
    ? '#000000'
    : '#ffffff';
}

export function DraggableRegionFrame({
  x,
  y,
  width,
  height,
  color,
  label,
  isSelected = true,
  canvasWidth,
  canvasHeight,
  aspectRatioLocked = true,
  onChange,
  onSelect,
  onRemove,
}: DraggableRegionFrameProps) {
  const left = useSharedValue(x * canvasWidth);
  const top = useSharedValue(y * canvasHeight);
  const frameWidth = useSharedValue(Math.max(24, width * canvasWidth));
  const frameHeight = useSharedValue(Math.max(24, height * canvasHeight));
  const startLeft = useSharedValue(left.value);
  const startTop = useSharedValue(top.value);
  const startWidth = useSharedValue(frameWidth.value);
  const startHeight = useSharedValue(frameHeight.value);
  const active = useSharedValue(false);

  useEffect(() => {
    if (active.value) return;
    left.value = x * canvasWidth;
    top.value = y * canvasHeight;
    frameWidth.value = Math.max(24, width * canvasWidth);
    frameHeight.value = Math.max(24, height * canvasHeight);
  }, [
    active,
    canvasHeight,
    canvasWidth,
    frameHeight,
    frameWidth,
    height,
    left,
    top,
    width,
    x,
    y,
  ]);

  function selectRegion() {
    onSelect?.();
  }

  function commitRect(next: ManualRegionRect) {
    onChange(next);
  }

  const beginGesture = () => {
    'worklet';
    active.value = true;
    startLeft.value = left.value;
    startTop.value = top.value;
    startWidth.value = frameWidth.value;
    startHeight.value = frameHeight.value;
    runOnJS(selectRegion)();
  };

  const finishGesture = () => {
    'worklet';
    runOnJS(commitRect)({
      x: left.value / canvasWidth,
      y: top.value / canvasHeight,
      width: frameWidth.value / canvasWidth,
      height: frameHeight.value / canvasHeight,
    });
    active.value = false;
  };

  const moveGesture = Gesture.Pan()
    .onBegin(beginGesture)
    .onUpdate((event) => {
      left.value = Math.max(
        0,
        Math.min(canvasWidth - frameWidth.value, startLeft.value + event.translationX),
      );
      top.value = Math.max(
        0,
        Math.min(canvasHeight - frameHeight.value, startTop.value + event.translationY),
      );
    })
    .onEnd(finishGesture)
    .onFinalize(() => {
      active.value = false;
    });

  function resizeGesture(direction: ResizeDirection) {
    const west = direction.includes('w');
    const east = direction.includes('e');
    const north = direction.includes('n');
    const south = direction.includes('s');
    return Gesture.Pan()
      .onBegin(beginGesture)
      .onUpdate((event) => {
        const minWidth = 24;
        const minHeight = 24;
        if (aspectRatioLocked) {
          const ratio = startWidth.value / Math.max(1, startHeight.value);
          const deltaFromX = west ? -event.translationX : east ? event.translationX : 0;
          const deltaFromY = north
            ? -event.translationY * ratio
            : south
              ? event.translationY * ratio
              : 0;
          const deltaWidth =
            Math.abs(deltaFromX) >= Math.abs(deltaFromY) ? deltaFromX : deltaFromY;
          const maxWidthX = west
            ? startLeft.value + startWidth.value
            : canvasWidth - startLeft.value;
          const maxHeight = north
            ? startTop.value + startHeight.value
            : canvasHeight - startTop.value;
          const nextWidth = Math.max(
            minWidth,
            Math.min(maxWidthX, maxHeight * ratio, startWidth.value + deltaWidth),
          );
          const nextHeight = nextWidth / ratio;
          left.value = west ? startLeft.value + startWidth.value - nextWidth : startLeft.value;
          top.value = north ? startTop.value + startHeight.value - nextHeight : startTop.value;
          frameWidth.value = nextWidth;
          frameHeight.value = nextHeight;
          return;
        }

        const right = startLeft.value + startWidth.value;
        const bottom = startTop.value + startHeight.value;
        const nextLeft = west
          ? Math.max(0, Math.min(right - minWidth, startLeft.value + event.translationX))
          : startLeft.value;
        const nextTop = north
          ? Math.max(0, Math.min(bottom - minHeight, startTop.value + event.translationY))
          : startTop.value;
        const nextRight = east
          ? Math.max(startLeft.value + minWidth, Math.min(canvasWidth, right + event.translationX))
          : right;
        const nextBottom = south
          ? Math.max(startTop.value + minHeight, Math.min(canvasHeight, bottom + event.translationY))
          : bottom;
        left.value = nextLeft;
        top.value = nextTop;
        frameWidth.value = nextRight - nextLeft;
        frameHeight.value = nextBottom - nextTop;
      })
      .onEnd(finishGesture)
      .onFinalize(() => {
        active.value = false;
      });
  }

  const frameStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    width: frameWidth.value,
    height: frameHeight.value,
  }));

  const handlePositions: Record<ResizeDirection, object> = {
    nw: { left: -6, top: -6 },
    n: { left: '50%', top: -4, marginLeft: -9, width: 18, height: 8 },
    ne: { right: -6, top: -6 },
    e: { right: -4, top: '50%', marginTop: -9, width: 8, height: 18 },
    se: { right: -6, bottom: -6 },
    s: { left: '50%', bottom: -4, marginLeft: -9, width: 18, height: 8 },
    sw: { left: -6, bottom: -6 },
    w: { left: -4, top: '50%', marginTop: -9, width: 8, height: 18 },
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
    >
      <GestureDetector gesture={moveGesture}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: color,
              borderRadius: 4,
              zIndex: isSelected ? 25 : 10,
              ...(isSelected
                ? {
                    shadowColor: '#ffffff',
                    shadowOpacity: 0.45,
                    shadowRadius: 2,
                    elevation: 3,
                  }
                : {}),
            },
            frameStyle,
          ]}
        >
          {label && isSelected ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 4, top: -20, backgroundColor: color }}
              className="rounded px-1.5 py-0.5"
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: contrastColor(color) }}
              >
                {label}
              </Text>
            </View>
          ) : null}
          {isSelected
            ? (Object.keys(handlePositions) as ResizeDirection[]).map((direction) => (
                <GestureDetector key={direction} gesture={resizeGesture(direction)}>
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#ffffff',
                        backgroundColor: color,
                        zIndex: 30,
                      },
                      handlePositions[direction],
                    ]}
                  />
                </GestureDetector>
              ))
            : null}
          {onRemove && isSelected ? (
            <Pressable
              onPress={onRemove}
              className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-3 -translate-y-3 items-center justify-center rounded-full bg-red-500/90"
            >
              <Text className="text-sm font-semibold text-white">×</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
