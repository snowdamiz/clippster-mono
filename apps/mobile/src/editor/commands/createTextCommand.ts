import {
  EDITOR_MAX_TICKS,
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type EditorSelection,
} from '../model/schema';
import type { EditorIdFactory } from '../model/ids';
import { defaultTextStyle, InsertTrackItemCommand } from './trackCommands';

export function createTextCommand(
  content: string,
  playheadTick: number,
  idFactory: EditorIdFactory,
): { command: InsertTrackItemCommand; selection: EditorSelection } {
  const itemId = idFactory('text');
  const timelineStart = Math.max(0, Math.min(playheadTick, EDITOR_MAX_TICKS - 1));
  const timelineEnd = Math.min(EDITOR_MAX_TICKS, timelineStart + secondsToTicks(3));
  return {
    command: new InsertTrackItemCommand(
      {
        trackKind: 'text',
        item: {
          id: itemId,
          kind: 'text',
          timelineStart,
          timelineEnd,
          content: content.trim(),
          style: defaultTextStyle(),
          transform: createDefaultRatioAwareTransform(),
        },
      },
      Date.now(),
    ),
    selection: { kind: 'text', id: itemId },
  };
}
