import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { formatPlaybackClock } from '@/lib/formatTime';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const BASE_STYLE: TextStyle = {
  fontFamily: 'monospace',
  fontSize: 12,
  fontVariant: ['tabular-nums'],
  letterSpacing: -0.2,
  padding: 0,
  margin: 0,
  backgroundColor: 'transparent',
  includeFontPadding: false,
  textAlignVertical: 'center',
};

export function PlaybackClockText({
  time,
  style,
}: {
  time: SharedValue<number>;
  style?: StyleProp<TextStyle>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const label = formatPlaybackClock(time.value);
    return {
      text: label,
      defaultValue: label,
    };
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      caretHidden
      showSoftInputOnFocus={false}
      pointerEvents="none"
      animatedProps={animatedProps}
      style={[BASE_STYLE, style]}
    />
  );
}
