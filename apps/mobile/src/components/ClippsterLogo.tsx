import { Canvas, ImageSVG, useSVG } from '@shopify/react-native-skia';
import { View } from 'react-native';

interface ClippsterLogoProps {
  iconSize?: number;
  wordmarkHeight?: number;
}

function ClippsterLogoIcon({ size = 32 }: { size?: number }) {
  const svg = useSVG(require('../../assets/images/logo-icon.svg'));

  return (
    <View style={{ width: size, height: size }}>
      {svg ? (
        <Canvas style={{ width: size, height: size }}>
          <ImageSVG svg={svg} x={0} y={0} width={size} height={size} />
        </Canvas>
      ) : null}
    </View>
  );
}

function ClippsterLogoWordmark({ height = 20 }: { height?: number }) {
  const width = (215 / 64) * height;
  const svg = useSVG(require('../../assets/images/logo-wordmark.svg'));

  return (
    <View style={{ width, height }}>
      {svg ? (
        <Canvas style={{ width, height }}>
          <ImageSVG svg={svg} x={0} y={0} width={width} height={height} />
        </Canvas>
      ) : null}
    </View>
  );
}

export function ClippsterLogo({ iconSize = 32, wordmarkHeight = 20 }: ClippsterLogoProps) {
  return (
    <View className="flex-row items-center justify-center gap-3">
      <ClippsterLogoIcon size={iconSize} />
      <ClippsterLogoWordmark height={wordmarkHeight} />
    </View>
  );
}
