import {
  InsertTrackItemCommand,
} from '../commands/trackCommands';
import { InsertVideoItemCommand } from '../commands/videoCommands';
import type { EditorCommand } from '../commands/command';
import type { EditorIdFactory } from '../model/ids';
import {
  EDITOR_MAX_TICKS,
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type EditorSelection,
  type MediaAssetRef,
  type MediaDerivativeRef,
} from '../model/schema';

interface ImportedMedia {
  path: string;
  label: string;
  durationSeconds?: number;
}

export async function createMediaImportCommand(
  kind: 'video' | 'image' | 'audio',
  media: ImportedMedia,
  playheadTick: number,
  idFactory: EditorIdFactory,
  fingerprint: (uri: string) => Promise<string>,
  destination: 'primary' | 'overlay' = 'primary',
  prepareProxy?: (uri: string) => Promise<MediaDerivativeRef | undefined>,
): Promise<{ command: EditorCommand; selection: EditorSelection }> {
  const now = Date.now();
  const assetId = idFactory('asset');
  const itemId = idFactory(kind === 'image' || destination === 'overlay' ? 'overlay' : kind);
  const defaultSeconds = kind === 'image' ? 5 : 30;
  const durationTicks = secondsToTicks(
    Math.max(0.1, Math.min(120, media.durationSeconds || defaultSeconds)),
  );
  const timelineStart = Math.max(0, Math.min(playheadTick, EDITOR_MAX_TICKS - 1));
  const timelineEnd = Math.min(EDITOR_MAX_TICKS, timelineStart + durationTicks);
  const proxy =
    kind === 'video' && prepareProxy ? await prepareProxy(media.path) : undefined;
  const asset: MediaAssetRef = {
    id: assetId,
    kind,
    sourceKind: kind === 'video' ? 'upload' : kind,
    sourceUri: media.path,
    sourceFingerprint: await fingerprint(media.path),
    durationTicks,
    hasAudio: kind !== 'image',
    proxy,
    width: proxy?.width,
    height: proxy?.height,
  };

  if (kind === 'video' && destination === 'primary') {
    return {
      command: new InsertVideoItemCommand(
        {
          id: itemId,
          kind: 'video',
          assetId,
          timelineStart: 0,
          timelineEnd: durationTicks,
          sourceStart: 0,
          sourceEnd: durationTicks,
          speed: 1,
          volume: 1,
          pitchPolicy: 'preserve',
          transform: createDefaultRatioAwareTransform(),
          effectStack: [],
          label: media.label,
        },
        asset,
        now,
      ),
      selection: { kind: 'video', id: itemId },
    };
  }

  if (kind === 'image' || (kind === 'video' && destination === 'overlay')) {
    return {
      command: new InsertTrackItemCommand(
        {
          trackKind: 'overlay',
          asset,
          item: {
            id: itemId,
            kind: 'overlay',
            assetId,
            timelineStart,
            timelineEnd,
            sourceStart: 0,
            sourceEnd: durationTicks,
            speed: 1,
            volume: kind === 'video' ? 1 : 0,
            opacity: 1,
            crop: { x: 0, y: 0, width: 1, height: 1 },
            transform: createDefaultRatioAwareTransform(),
            effectStack: [],
          },
        },
        now,
      ),
      selection: { kind: 'overlay', id: itemId },
    };
  }

  return {
    command: new InsertTrackItemCommand(
      {
        trackKind: 'audio',
        asset,
        item: {
          id: itemId,
          kind: 'audio',
          assetId,
          timelineStart,
          timelineEnd,
          sourceStart: 0,
          sourceEnd: durationTicks,
          speed: 1,
          volume: 1,
          fadeInTicks: 0,
          fadeOutTicks: 0,
          role: 'music',
          label: media.label,
        },
      },
      now,
    ),
    selection: { kind: 'audio', id: itemId },
  };
}
