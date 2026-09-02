import { View } from 'react-native';

export function PlayheadMarker({
  x,
  height,
  color = '#ffffff',
}: {
  x: number;
  height: number;
  color?: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 7,
        top: 0,
        width: 14,
        height,
        zIndex: 30,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderTopWidth: 9,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
        }}
      />
      <View style={{ width: 2, flex: 1, backgroundColor: color, marginTop: -1 }} />
    </View>
  );
}
