import type { TextOverlayRatioConfig, TextOverlayStyle } from '@/types';

/** Persisted on clips.clip_text_overlay (JSON) */
export interface ClipTextBoxState {
  enabled: boolean;
  text: string;
  /** Seconds from clip start */
  startTime: number;
  /** Seconds from clip start */
  endTime: number;
  /** 0–100, anchor center */
  positionX: number;
  positionY: number;
  /** Box width as % of frame */
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
    width: undefined,
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

/** Parse and merge with defaults */
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

/** Merge per-ratio POI geometry onto base state for target preview. */
export function mergeClipTextBoxForRatio(state: ClipTextBoxState, ratio: string): ClipTextBoxState {
  const pr = state.perRatioConfigs?.[ratio] as TextOverlayRatioConfig | undefined;
  if (!pr?.position) {
    return { ...state };
  }
  const prStyle = pr.style && typeof pr.style === 'object' ? pr.style : {};
  const widthFromStyle =
    typeof prStyle.maxWidth === 'number'
      ? prStyle.maxWidth
      : typeof prStyle.width === 'number'
        ? (prStyle.width as number)
        : state.widthPct;
  const style: TextOverlayStyle = {
    ...state.style,
    maxWidth: widthFromStyle,
    width: widthFromStyle,
  };
  return {
    ...state,
    positionX: pr.position.x,
    positionY: pr.position.y,
    widthPct: widthFromStyle,
    style,
  };
}

/** Persist POI drag/resize for the active target aspect ratio. */
export function upsertClipTextPerRatioGeometry(
  state: ClipTextBoxState,
  ratio: string,
  geometry: { x: number; y: number; widthPct: number; fontSize?: number }
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
    style: nextRootStyle,
    perRatioConfigs: {
      ...(state.perRatioConfigs || {}),
      [ratio]: entry,
    },
  };
}

/** Shape expected by ClipsTab → build_clip_from_segments (camelCase) */
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

/** Load enabled clip text box as export payloads (single-element array) or null. */
export async function getClipTextBoxOverlaysForExport(clipId: string) {
  const { getClip } = await import('@/services/database/clips');
  const row = await getClip(clipId);
  const s = parseClipTextOverlayJson(row?.clip_text_overlay);
  if (!s?.enabled) return null;
  return [clipTextBoxToExportPayload(clipId, s)];
}
