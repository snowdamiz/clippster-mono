import { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';

export function TrimHandle({
  edge,
  onMove,
  onEnd,
}: {
  edge: 'start' | 'end';
  onMove: (dx: number) => void;
  onEnd?: () => void;
}) {
  const lastX = useRef(0);
  const onMoveRef = useRef(onMove);
  const onEndRef = useRef(onEnd);
  onMoveRef.current = onMove;
  onEndRef.current = onEnd;

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
        onPanResponderRelease: () => onEndRef.current?.(),
        onPanResponderTerminate: () => onEndRef.current?.(),
      }),
    [],
  );

  const isStart = edge === 'start';

  return (
    <View
      {...pan.panHandlers}
      hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [isStart ? 'left' : 'right']: -2,
        width: 28,
        zIndex: 8,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 18,
          height: '100%',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: isStart ? 8 : 2,
          borderBottomLeftRadius: isStart ? 8 : 2,
          borderTopRightRadius: isStart ? 2 : 8,
          borderBottomRightRadius: isStart ? 2 : 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View style={{ gap: 3 }}>
          <View style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: '#111111' }} />
          <View style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: '#111111' }} />
          <View style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: '#111111' }} />
        </View>
      </View>
    </View>
  );
}
