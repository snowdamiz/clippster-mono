import { Image as RNImage } from 'react-native';
import Svg, { Defs, Mask, Rect, Image as SvgImage } from 'react-native-svg';
import { tokens } from '@/theme/tokens';

const TOKEND_SOURCE = require('../../../assets/images/tokend.png');

interface TokendLogoProps {
  size?: number;
  /** When set, renders the logo shape in this color (e.g. white foreground icons). */
  color?: string;
}

export function TokendLogo({ size = 24, color }: TokendLogoProps) {
  if (!color) {
    return (
      <RNImage
        source={TOKEND_SOURCE}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="cover"
      />
    );
  }

  const asset = RNImage.resolveAssetSource(TOKEND_SOURCE);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <Mask id="tokendMask" x="0" y="0" width={size} height={size}>
          <SvgImage
            x={0}
            y={0}
            width={size}
            height={size}
            href={asset}
            preserveAspectRatio="xMidYMid slice"
          />
        </Mask>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={color} mask="url(#tokendMask)" />
    </Svg>
  );
}

/** White Tokend glyph for platform rows alongside Ionicons. */
export function TokendPlatformIcon({ size = 22 }: { size?: number }) {
  return <TokendLogo size={size} color={tokens.colors.foreground} />;
}
