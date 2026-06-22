export interface TextOverlayStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string | null;
  backgroundEnabled: boolean;
  highlightColor: string;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  borderRadius: number;
  padding: number;
  letterSpacing: number;
  lineHeight: number;
  wordSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  maxWidth: number;
  width?: number;
  textOffsetX: number;
  textOffsetY: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface TextOverlayRatioConfig {
  position: { x: number; y: number };
  style: TextOverlayStyle;
  rotation?: number;
  scale?: number;
}

export interface ClipTextBoxState {
  enabled: boolean;
  text: string;
  startTime: number;
  endTime: number;
  positionX: number;
  positionY: number;
  widthPct: number;
  previewHeight?: number;
  style: TextOverlayStyle;
  perRatioConfigs?: Record<string, TextOverlayRatioConfig>;
}

export function createDefaultClipTextBoxStyle(): TextOverlayStyle {
  return {
    fontFamily: 'Montserrat',
    fontSize: 28,
    fontWeight: 700,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    backgroundEnabled: true,
    highlightColor: '#FFFF00',
    border1Width: 0,
    border1Color: '#000000',
    border2Width: 0,
    border2Color: '#000000',
    strokeEnabled: false,
    strokeColor: '#000000',
    strokeWidth: 0,
    shadowEnabled: false,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    borderRadius: 24,
    padding: 20,
    letterSpacing: 0,
    lineHeight: 1.2,
    wordSpacing: 0.35,
    textAlign: 'center',
    maxWidth: 90,
    textOffsetX: 0,
    textOffsetY: 0,
    textTransform: 'uppercase',
  };
}

export function createDefaultClipTextBoxState(clipDurationSec: number): ClipTextBoxState {
  const dur = Math.max(0.1, clipDurationSec || 3);
  return {
    enabled: true,
    text: 'YOUR TEXT',
    startTime: 0,
    endTime: dur,
    positionX: 50,
    positionY: 50,
    widthPct: 72,
    previewHeight: 1080,
    style: createDefaultClipTextBoxStyle(),
    perRatioConfigs: {},
  };
}

export function parseClipTextOverlayJson(raw: string | null | undefined): ClipTextBoxState | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const dur = typeof parsed.endTime === 'number' ? parsed.endTime : 3;
    const style = {
      ...createDefaultClipTextBoxStyle(),
      ...(parsed.style && typeof parsed.style === 'object' ? parsed.style : {}),
    } as TextOverlayStyle;
    return {
      enabled: Boolean(parsed.enabled),
      text: typeof parsed.text === 'string' ? parsed.text : '',
      startTime: typeof parsed.startTime === 'number' ? parsed.startTime : 0,
      endTime: typeof parsed.endTime === 'number' ? parsed.endTime : dur,
      positionX: typeof parsed.positionX === 'number' ? parsed.positionX : 50,
      positionY: typeof parsed.positionY === 'number' ? parsed.positionY : 50,
      widthPct: typeof parsed.widthPct === 'number' ? parsed.widthPct : 72,
      previewHeight: typeof parsed.previewHeight === 'number' ? parsed.previewHeight : 1080,
      style,
      perRatioConfigs:
        parsed.perRatioConfigs && typeof parsed.perRatioConfigs === 'object'
          ? parsed.perRatioConfigs
          : {},
    };
  } catch {
    return null;
  }
}

export function serializeClipTextBoxState(state: ClipTextBoxState): string {
  return JSON.stringify(state);
}

export function upsertClipTextPerRatioGeometry(
  state: ClipTextBoxState,
  ratio: string,
  geometry: { x: number; y: number; widthPct: number; fontSize?: number },
): ClipTextBoxState {
  const nextRootStyle: TextOverlayStyle = {
    ...state.style,
    ...(geometry.fontSize != null ? { fontSize: geometry.fontSize } : {}),
  };
  const mergedStyle: TextOverlayStyle = {
    ...nextRootStyle,
    maxWidth: geometry.widthPct,
    width: geometry.widthPct,
  };
  const entry: TextOverlayRatioConfig = {
    position: { x: geometry.x, y: geometry.y },
    style: mergedStyle,
  };
  return {
    ...state,
    positionX: geometry.x,
    positionY: geometry.y,
    widthPct: geometry.widthPct,
    style: nextRootStyle,
    perRatioConfigs: {
      ...(state.perRatioConfigs || {}),
      [ratio]: entry,
    },
  };
}

export function clipTextBoxToExportPayload(clipId: string, state: ClipTextBoxState) {
  const per =
    state.perRatioConfigs && Object.keys(state.perRatioConfigs).length > 0
      ? state.perRatioConfigs
      : undefined;
  return {
    id: `${clipId}-clip-text-box`,
    text: state.text,
    startTime: state.startTime,
    endTime: state.endTime,
    positionX: state.positionX,
    positionY: state.positionY,
    style: {
      ...state.style,
      maxWidth: state.widthPct,
      width: state.widthPct,
    },
    animation: 'none' as const,
    perRatioConfigs: per,
    previewHeight: state.previewHeight ?? 1080,
  };
}
