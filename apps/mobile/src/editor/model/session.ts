import {
  type EditorSelection,
  type MobileEditProjectV3,
} from './schema';
import { getVideoTrack } from './timeline';

export interface EditorSessionState {
  playheadTick: number;
  selection: EditorSelection | null;
}

export const DEFAULT_EDITOR_SESSION: EditorSessionState = {
  playheadTick: 0,
  selection: null,
};

export function sanitizeEditorSession(
  document: MobileEditProjectV3,
  session: EditorSessionState | null | undefined,
): EditorSessionState {
  const duration = getVideoTrack(document).items.reduce(
    (maximum, item) => Math.max(maximum, item.timelineEnd),
    0,
  );
  const playheadTick =
    session && Number.isSafeInteger(session.playheadTick)
      ? Math.max(0, Math.min(session.playheadTick, duration))
      : 0;
  return {
    playheadTick,
    selection:
      session?.selection && selectionExists(document, session.selection)
        ? session.selection
        : null,
  };
}

function selectionExists(
  document: MobileEditProjectV3,
  selection: EditorSelection,
): boolean {
  if (selection.kind === 'caption') return document.captionDocument?.id === selection.id;
  if (selection.kind === 'transition') {
    return getVideoTrack(document).transitions.some((item) => item.id === selection.id);
  }
  return document.tracks.some((track) => track.items.some((item) => item.id === selection.id));
}
