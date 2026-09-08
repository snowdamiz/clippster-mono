import type { ClipEffect } from '@clippster/clip-export';

import {
  EDITOR_MAX_TICKS,
  type AudioItem,
  type AudioTrack,
  type EditorTrack,
  type MediaAssetRef,
  type MobileEditProjectV3,
  type OverlayItem,
  type OverlayTrack,
  type TextStyle,
  type TextTrack,
  type TimedTextItem,
  type TransitionKind,
} from '../model/schema';
import { getVideoTrack, reflowVideoTrack, replaceVideoTrack } from '../model/timeline';
import type { EditorCommand } from './command';

type InsertTrackItem =
  | { trackKind: 'text'; item: TimedTextItem }
  | { trackKind: 'overlay'; item: OverlayItem; asset: MediaAssetRef }
  | { trackKind: 'audio'; item: AudioItem; asset: MediaAssetRef };

function replaceTrack(
  document: MobileEditProjectV3,
  replacement: EditorTrack,
  updatedAt: number,
): MobileEditProjectV3 {
  return {
    ...document,
    tracks: document.tracks.map((track) => (track.id === replacement.id ? replacement : track)),
    updatedAt,
  };
}

function trackByKind<K extends EditorTrack['kind']>(
  document: MobileEditProjectV3,
  kind: K,
): Extract<EditorTrack, { kind: K }> {
  const track = document.tracks.find(
    (candidate): candidate is Extract<EditorTrack, { kind: K }> => candidate.kind === kind,
  );
  if (!track) throw new Error(`Document has no ${kind} track`);
  return track;
}

class RestoreTrackCommand implements EditorCommand {
  readonly type = 'RestoreTrack';

  constructor(
    private readonly track: EditorTrack,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return replaceTrack(document, this.track, this.updatedAt);
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    const track = before.tracks.find((candidate) => candidate.id === this.track.id);
    if (!track) throw new Error(`Cannot restore missing track ${this.track.id}`);
    return new RestoreTrackCommand(track, this.updatedAt);
  }
}

class RestoreTrackAndAssetsCommand implements EditorCommand {
  readonly type = 'RestoreTrackAndAssets';

  constructor(
    private readonly track: EditorTrack,
    private readonly assets: MobileEditProjectV3['assets'],
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return {
      ...replaceTrack(document, this.track, this.updatedAt),
      assets: this.assets,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    const track = before.tracks.find((candidate) => candidate.id === this.track.id);
    if (!track) throw new Error(`Cannot restore missing track ${this.track.id}`);
    return new RestoreTrackAndAssetsCommand(track, before.assets, this.updatedAt);
  }
}

class RestoreAssetCommand implements EditorCommand {
  readonly type = 'RestoreAsset';

  constructor(
    private readonly asset: MediaAssetRef,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return {
      ...document,
      assets: { ...document.assets, [this.asset.id]: this.asset },
      updatedAt: this.updatedAt,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    const asset = before.assets[this.asset.id];
    if (!asset) throw new Error(`Cannot restore missing asset ${this.asset.id}`);
    return new RestoreAssetCommand(asset, this.updatedAt);
  }
}

abstract class TrackCommand implements EditorCommand {
  abstract readonly type: string;

  constructor(
    protected readonly trackKind: EditorTrack['kind'],
    protected readonly updatedAt: number,
  ) {}

  abstract apply(document: MobileEditProjectV3): MobileEditProjectV3;

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreTrackCommand(trackByKind(before, this.trackKind), this.updatedAt);
  }
}

export class InsertTrackItemCommand implements EditorCommand {
  readonly type = 'InsertTrackItem';

  constructor(
    readonly payload: InsertTrackItem,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (this.payload.item.timelineEnd > EDITOR_MAX_TICKS) {
      throw new Error('Item exceeds the 120 second mobile policy');
    }
    if (document.tracks.some((track) => track.items.some((item) => item.id === this.payload.item.id))) {
      throw new Error(`Duplicate editor item ID ${this.payload.item.id}`);
    }
    if (this.payload.trackKind === 'text') {
      const track = trackByKind(document, 'text');
      return replaceTrack(
        document,
        { ...track, items: [...track.items, this.payload.item].sort(byTimelineStart) },
        this.updatedAt,
      );
    }
    const asset = this.payload.asset;
    if (document.assets[asset.id]) throw new Error(`Duplicate editor asset ID ${asset.id}`);
    if (this.payload.item.assetId !== asset.id) throw new Error('Item must reference its inserted asset');
    const assets = { ...document.assets, [asset.id]: asset };
    if (this.payload.trackKind === 'overlay') {
      const track = trackByKind(document, 'overlay');
      return {
        ...replaceTrack(
          document,
          { ...track, items: [...track.items, this.payload.item].sort(byTimelineStart) },
          this.updatedAt,
        ),
        assets,
      };
    }
    const track = trackByKind(document, 'audio');
    return {
      ...replaceTrack(
        document,
        { ...track, items: [...track.items, this.payload.item].sort(byTimelineStart) },
        this.updatedAt,
      ),
      assets,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreTrackAndAssetsCommand(
      trackByKind(before, this.payload.trackKind),
      before.assets,
      this.updatedAt,
    );
  }
}

function byTimelineStart<T extends { timelineStart: number }>(left: T, right: T): number {
  return left.timelineStart - right.timelineStart;
}

export class DeleteTrackItemCommand extends TrackCommand {
  readonly type = 'DeleteTrackItem';

  constructor(
    trackKind: 'text' | 'overlay' | 'audio',
    readonly itemId: string,
    updatedAt: number,
  ) {
    super(trackKind, updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (this.trackKind === 'text') {
      const track = trackByKind(document, 'text');
      const items = track.items.filter((item) => item.id !== this.itemId);
      return items.length === track.items.length
        ? document
        : replaceTrack(document, { ...track, items }, this.updatedAt);
    }
    if (this.trackKind === 'overlay') {
      const track = trackByKind(document, 'overlay');
      const items = track.items.filter((item) => item.id !== this.itemId);
      return items.length === track.items.length
        ? document
        : replaceTrack(document, { ...track, items }, this.updatedAt);
    }
    const track = trackByKind(document, 'audio');
    const items = track.items.filter((item) => item.id !== this.itemId);
    return items.length === track.items.length
      ? document
      : replaceTrack(document, { ...track, items }, this.updatedAt);
  }
}

export class DuplicateTrackItemCommand extends TrackCommand {
  readonly type = 'DuplicateTrackItem';

  constructor(
    trackKind: 'text' | 'overlay' | 'audio',
    readonly itemId: string,
    readonly duplicateId: string,
    updatedAt: number,
  ) {
    super(trackKind, updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (this.trackKind === 'text') {
      const track = trackByKind(document, 'text');
      const item = track.items.find((candidate) => candidate.id === this.itemId);
      if (!item) return document;
      const duplicate = { ...item, id: this.duplicateId };
      return replaceTrack(document, { ...track, items: [...track.items, duplicate] }, this.updatedAt);
    }
    if (this.trackKind === 'overlay') {
      const track = trackByKind(document, 'overlay');
      const item = track.items.find((candidate) => candidate.id === this.itemId);
      if (!item) return document;
      const duplicate = { ...item, id: this.duplicateId };
      return replaceTrack(document, { ...track, items: [...track.items, duplicate] }, this.updatedAt);
    }
    const track = trackByKind(document, 'audio');
    const item = track.items.find((candidate) => candidate.id === this.itemId);
    if (!item) return document;
    const duplicate = { ...item, id: this.duplicateId };
    return replaceTrack(document, { ...track, items: [...track.items, duplicate] }, this.updatedAt);
  }
}

export class SplitAudioItemCommand extends TrackCommand {
  readonly type = 'SplitAudioItem';

  constructor(
    readonly itemId: string,
    readonly timelineTick: number,
    readonly rightItemId: string,
    updatedAt: number,
  ) {
    super('audio', updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = trackByKind(document, 'audio');
    const index = track.items.findIndex((item) => item.id === this.itemId);
    const item = track.items[index];
    if (!item || this.timelineTick <= item.timelineStart || this.timelineTick >= item.timelineEnd) {
      return document;
    }
    const sourceTick =
      item.sourceStart + Math.round((this.timelineTick - item.timelineStart) * item.speed);
    if (sourceTick <= item.sourceStart || sourceTick >= item.sourceEnd) return document;
    const left = {
      ...item,
      timelineEnd: this.timelineTick,
      sourceEnd: sourceTick,
      fadeOutTicks: 0,
    };
    const right = {
      ...item,
      id: this.rightItemId,
      timelineStart: this.timelineTick,
      sourceStart: sourceTick,
      fadeInTicks: 0,
    };
    const items = [...track.items];
    items.splice(index, 1, left, right);
    return replaceTrack(document, { ...track, items }, this.updatedAt);
  }
}

export class ReplaceMediaAssetCommand implements EditorCommand {
  readonly type = 'ReplaceMediaAsset';

  constructor(
    readonly assetId: string,
    readonly replacement: MediaAssetRef,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const current = document.assets[this.assetId];
    if (!current) return document;
    if (this.replacement.id !== this.assetId) throw new Error('Replacement must preserve asset ID');
    if (this.replacement.kind !== current.kind) throw new Error('Replacement media kind must match');
    return {
      ...document,
      assets: { ...document.assets, [this.assetId]: this.replacement },
      updatedAt: this.updatedAt,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    const asset = before.assets[this.assetId];
    if (!asset) throw new Error(`Cannot restore missing asset ${this.assetId}`);
    return new RestoreAssetCommand(asset, this.updatedAt);
  }
}

export class UpdateTextItemCommand extends TrackCommand {
  readonly type = 'UpdateTextItem';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly patch: Partial<
      Pick<
        TimedTextItem,
        'content' | 'style' | 'timelineStart' | 'timelineEnd' | 'animationIn' | 'animationOut'
      >
    >,
    updatedAt: number,
  ) {
    super('text', updatedAt);
    this.coalescingKey = `${this.type}:${itemId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = trackByKind(document, 'text');
    const items = track.items.map((item) =>
      item.id === this.itemId
        ? {
            ...item,
            ...this.patch,
            style: this.patch.style ? { ...this.patch.style } : item.style,
          }
        : item,
    );
    return items.every((item, index) => item === track.items[index])
      ? document
      : replaceTrack(document, { ...track, items: items.sort(byTimelineStart) }, this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof UpdateTextItemCommand && next.itemId === this.itemId
      ? new UpdateTextItemCommand(
          this.itemId,
          { ...this.patch, ...next.patch },
          next.updatedAt,
        )
      : null;
  }
}

export class UpdateOverlayItemCommand extends TrackCommand {
  readonly type = 'UpdateOverlayItem';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly patch: Partial<
      Pick<
        OverlayItem,
        | 'timelineStart'
        | 'timelineEnd'
        | 'sourceStart'
        | 'sourceEnd'
        | 'speed'
        | 'volume'
        | 'opacity'
        | 'crop'
        | 'effectStack'
      >
    >,
    updatedAt: number,
  ) {
    super('overlay', updatedAt);
    this.coalescingKey = `${this.type}:${itemId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = trackByKind(document, 'overlay');
    const items = track.items.map((item) => {
      if (item.id !== this.itemId) return item;
      const updated = { ...item, ...this.patch };
      return this.patch.speed
        ? {
            ...updated,
            timelineEnd:
              updated.timelineStart +
              Math.round((updated.sourceEnd - updated.sourceStart) / updated.speed),
          }
        : updated;
    });
    if (items.some((item) => item.timelineEnd > EDITOR_MAX_TICKS)) {
      throw new Error('Overlay speed would exceed the 120 second mobile policy');
    }
    return items.every((item, index) => item === track.items[index])
      ? document
      : replaceTrack(document, { ...track, items: items.sort(byTimelineStart) }, this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof UpdateOverlayItemCommand && next.itemId === this.itemId
      ? new UpdateOverlayItemCommand(
          this.itemId,
          { ...this.patch, ...next.patch },
          next.updatedAt,
        )
      : null;
  }
}

export class UpdateAudioItemCommand extends TrackCommand {
  readonly type = 'UpdateAudioItem';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly patch: Partial<
      Pick<
        AudioItem,
        | 'timelineStart'
        | 'timelineEnd'
        | 'sourceStart'
        | 'sourceEnd'
        | 'speed'
        | 'volume'
        | 'fadeInTicks'
        | 'fadeOutTicks'
        | 'label'
      >
    >,
    updatedAt: number,
  ) {
    super('audio', updatedAt);
    this.coalescingKey = `${this.type}:${itemId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = trackByKind(document, 'audio');
    const items = track.items.map((item) => {
      if (item.id !== this.itemId) return item;
      const updated = { ...item, ...this.patch };
      return this.patch.speed
        ? {
            ...updated,
            timelineEnd:
              updated.timelineStart +
              Math.round((updated.sourceEnd - updated.sourceStart) / updated.speed),
          }
        : updated;
    });
    if (items.some((item) => item.timelineEnd > EDITOR_MAX_TICKS)) {
      throw new Error('Audio speed would exceed the 120 second mobile policy');
    }
    return items.every((item, index) => item === track.items[index])
      ? document
      : replaceTrack(document, { ...track, items: items.sort(byTimelineStart) }, this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof UpdateAudioItemCommand && next.itemId === this.itemId
      ? new UpdateAudioItemCommand(
          this.itemId,
          { ...this.patch, ...next.patch },
          next.updatedAt,
        )
      : null;
  }
}

export class SetTransitionCommand extends TrackCommand {
  readonly type = 'SetTransition';

  constructor(
    readonly toItemId: string,
    readonly transitionId: string,
    readonly transition: TransitionKind,
    readonly durationTicks: number,
    updatedAt: number,
  ) {
    super('video', updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const index = track.items.findIndex((item) => item.id === this.toItemId);
    if (index <= 0) return document;
    const previous = track.items[index - 1];
    const durationTicks = this.transition === 'cut' ? 0 : Math.max(0, this.durationTicks);
    const nextTransition = {
      id: track.transitions.find((item) => item.toItemId === this.toItemId)?.id ?? this.transitionId,
      kind: 'transition' as const,
      fromItemId: previous.id,
      toItemId: this.toItemId,
      transition: this.transition,
      durationTicks,
    };
    const transitions = track.transitions
      .filter((item) => item.toItemId !== this.toItemId)
      .concat(nextTransition);
    return replaceVideoTrack(
      document,
      reflowVideoTrack({ ...track, transitions }),
      this.updatedAt,
    );
  }
}

export function defaultTextStyle(): TextStyle {
  return {
    fontFamily: 'System',
    fontSize: 48,
    color: '#ffffff',
    outlineColor: '#000000',
    outlineWidth: 2,
    alignment: 'center',
  };
}

export function effectStackPatch(effectStack: ClipEffect[]): Pick<OverlayItem, 'effectStack'> {
  return { effectStack: effectStack.map((effect) => ({ ...effect })) };
}

export type { AudioTrack, OverlayTrack, TextTrack };
