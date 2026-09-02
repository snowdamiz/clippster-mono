import type { ClipEffect } from '@clippster/clip-export';
import { effectColorMatrix } from '@clippster/clip-export';
import {
  BackdropBlur,
  BackdropFilter,
  Canvas,
  ColorMatrix,
  Fill,
  FractalNoise,
  Group,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { View } from 'react-native';

interface EffectOverlayProps {
  effect?: ClipEffect | null;
  width: number;
  height: number;
}

export function EffectOverlay({ effect, width, height }: EffectOverlayProps) {
  if (!effect || width <= 0 || height <= 0) return null;

  const t = Math.max(0, Math.min(1, effect.intensity / 100));
  const matrix = effectColorMatrix(effect);
  const blur = effect.type === 'blur' ? Math.max(0.5, t * 10) : 0;
  const grain = effect.type === 'grain' ? t : effect.type === 'glitch' ? t * 0.45 : 0;
  const vignette = effect.type === 'vignette' ? 0.35 + t * 0.55 : 0;
  const letterbox = effect.type === 'letterbox' ? Math.max(0.06, t * 0.18) * height : 0;
  const glitchShift = effect.type === 'glitch' ? Math.max(1, t * 8) : 0;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Canvas style={{ width, height }}>
        {matrix ? (
          <BackdropFilter filter={<ColorMatrix matrix={matrix} />}>
            <Fill color="transparent" />
          </BackdropFilter>
        ) : null}
        {blur > 0 ? (
          <BackdropBlur blur={blur}>
            <Fill color="transparent" />
          </BackdropBlur>
        ) : null}
        {vignette > 0 ? (
          <Fill>
            <RadialGradient
              c={vec(width / 2, height / 2)}
              r={Math.max(width, height) * (0.82 - t * 0.18)}
              colors={[`rgba(0,0,0,0)`, `rgba(0,0,0,${vignette.toFixed(2)})`]}
            />
          </Fill>
        ) : null}
        {grain > 0 ? (
          <Group opacity={0.18 + grain * 0.35}>
            <Fill>
              <FractalNoise freqX={1.4} freqY={1.4} octaves={3} seed={2} />
            </Fill>
          </Group>
        ) : null}
        {glitchShift > 0 ? (
          <Group>
            <Rect x={-glitchShift} y={0} width={width} height={2} color="rgba(255,40,80,0.35)" />
            <Rect x={glitchShift} y={height * 0.42} width={width} height={2} color="rgba(40,220,255,0.35)" />
            <Rect x={0} y={height * 0.7} width={width} height={1} color="rgba(255,255,255,0.18)" />
          </Group>
        ) : null}
        {letterbox > 0 ? (
          <Group>
            <Rect x={0} y={0} width={width} height={letterbox} color="#000" />
            <Rect x={0} y={height - letterbox} width={width} height={letterbox} color="#000" />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}
