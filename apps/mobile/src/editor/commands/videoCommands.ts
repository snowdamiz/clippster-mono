import {
  EDITOR_MAX_TICKS,
  type EditorTick,
  type MediaAssetRef,
  type MobileEditProjectV3,
  type TransitionItem,
  type VideoItem,
  type VideoTrack,
} from '../model/schema';
import type { ClipEffect } from '@clippster/clip-export';
import {
  MIN_ITEM_TICKS,
  getVideoTrack,
  reflowVideoTrack,
  replaceVideoTrack,
} from '../model/timeline';
import type { EditorCommand } from './command';

function copyTrack(track: VideoTrack): VideoTrack {
  return {
    ...track,
    items: track.items.map((item) => ({
      ...item,
      transform: item.transform.overrides
        ? {
            base: { ...item.transform.base },
            overrides: Object.fromEntries(
              Object.entries(item.transform.overrides).map(([ratio, transform]) => [
                ratio,
                transform ? { ...transform } : transform,
              ]),
            ),
          }
        : { base: { ...item.transform.base } },
      effectStack: item.effectStack.map((effect) => ({ ...effect })),
    })),
    transitions: track.transitions.map((transition) => ({ ...transition })),
  };
}

function normalizeTransitions(track: VideoTrack): VideoTrack {
  const transitions: TransitionItem[] = [];
  for (let index = 1; index < track.items.length; index++) {
    const previous = track.items[index - 1];
    const item = track.items[index];
    const existing = track.transitions.find((transition) => transition.toItemId === item.id);
    if (existing) {
      transitions.push({ ...existing, fromItemId: previous.id });
    }
  }
  return { ...track, transitions };
}

class RestoreVideoTrackCommand implements EditorCommand {
  readonly type = 'RestoreVideoTrack';

  constructor(
    private readonly track: VideoTrack,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return replaceVideoTrack(document, copyTrack(this.track), this.updatedAt);
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreVideoTrackCommand(getVideoTrack(before), this.updatedAt);
  }
}

class RestoreVideoTrackAndAssetsCommand implements EditorCommand {
  readonly type = 'RestoreVideoTrackAndAssets';

  constructor(
    private readonly track: VideoTrack,
    private readonly assets: MobileEditProjectV3['assets'],
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return {
      ...replaceVideoTrack(document, copyTrack(this.track), this.updatedAt),
      assets: this.assets,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreVideoTrackAndAssetsCommand(
      copyTrack(getVideoTrack(before)),
      before.assets,
      this.updatedAt,
    );
  }
}

export class InsertVideoItemCommand implements EditorCommand {
  readonly type = 'InsertVideoItem';

  constructor(
    readonly item: VideoItem,
    readonly asset: MediaAssetRef,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (this.item.assetId !== this.asset.id || this.asset.kind !== 'video') {
      throw new Error('Video item must reference its inserted video asset');
    }
    if (document.assets[this.asset.id]) throw new Error(`Duplicate editor asset ID ${this.asset.id}`);
    const track = getVideoTrack(document);
    if (track.items.some((item) => item.id === this.item.id)) {
      throw new Error(`Duplicate editor item ID ${this.item.id}`);
    }
    const items = [...track.items, this.item];
    const nextTrack = reflowVideoTrack({ ...track, items });
    const duration = nextTrack.items.at(-1)?.timelineEnd ?? 0;
    if (duration > EDITOR_MAX_TICKS) throw new Error('Edit exceeds the 120 second mobile policy');
    return {
      ...replaceVideoTrack(document, nextTrack, this.updatedAt),
      assets: { ...document.assets, [this.asset.id]: this.asset },
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreVideoTrackAndAssetsCommand(
      copyTrack(getVideoTrack(before)),
      before.assets,
      this.updatedAt,
    );
  }
}

abstract class VideoTrackCommand implements EditorCommand {
  abstract readonly type: string;

  constructor(protected readonly updatedAt: number) {}

  abstract apply(document: MobileEditProjectV3): MobileEditProjectV3;

  invert(before: MobileEditProjectV3): EditorCommand {
    return new RestoreVideoTrackCommand(copyTrack(getVideoTrack(before)), this.updatedAt);
  }
}

export class TrimVideoItemCommand extends VideoTrackCommand {
  readonly type = 'TrimVideoItem';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly edge: 'start' | 'end',
    readonly sourceTick: EditorTick,
    updatedAt: number,
  ) {
    super(updatedAt);
    this.coalescingKey = `${this.type}:${itemId}:${edge}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const items = track.items.map((item) => {
      if (item.id !== this.itemId) return item;
      const asset = document.assets[item.assetId];
      if (this.edge === 'start') {
        const sourceStart = Math.max(0, Math.min(this.sourceTick, item.sourceEnd - MIN_ITEM_TICKS));
        return { ...item, sourceStart };
      }
      const sourceEnd = Math.min(
        asset?.durationTicks ?? Number.MAX_SAFE_INTEGER,
        Math.max(this.sourceTick, item.sourceStart + MIN_ITEM_TICKS),
      );
      return { ...item, sourceEnd };
    });
    if (items.every((item, index) => item === track.items[index])) return document;
    return replaceVideoTrack(document, reflowVideoTrack({ ...track, items }), this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof TrimVideoItemCommand &&
      next.itemId === this.itemId &&
      next.edge === this.edge
      ? next
      : null;
  }
}

export class SetVideoSpeedCommand extends VideoTrackCommand {
  readonly type = 'SetVideoSpeed';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly speed: number,
    updatedAt: number,
  ) {
    super(updatedAt);
    this.coalescingKey = `${this.type}:${itemId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (!Number.isFinite(this.speed) || this.speed <= 0) throw new Error('Speed must be positive');
    const track = getVideoTrack(document);
    const items = track.items.map((item) =>
      item.id === this.itemId ? { ...item, speed: this.speed } : item,
    );
    if (items.every((item, index) => item === track.items[index])) return document;
    return replaceVideoTrack(document, reflowVideoTrack({ ...track, items }), this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof SetVideoSpeedCommand && next.itemId === this.itemId ? next : null;
  }
}

export class SetVideoVolumeCommand extends VideoTrackCommand {
  readonly type = 'SetVideoVolume';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly volume: number,
    updatedAt: number,
  ) {
    super(updatedAt);
    this.coalescingKey = `${this.type}:${itemId}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const volume = Math.max(0, Math.min(1, this.volume));
    const track = getVideoTrack(document);
    const items = track.items.map((item) =>
      item.id === this.itemId ? { ...item, volume } : item,
    );
    if (items.every((item, index) => item === track.items[index])) return document;
    return replaceVideoTrack(document, { ...track, items }, this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof SetVideoVolumeCommand && next.itemId === this.itemId ? next : null;
  }
}

export class SetVideoEffectsCommand extends VideoTrackCommand {
  readonly type = 'SetVideoEffects';

  constructor(
    readonly itemId: string,
    readonly effectStack: ClipEffect[],
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const items = track.items.map((item) =>
      item.id === this.itemId
        ? { ...item, effectStack: this.effectStack.map((effect) => ({ ...effect })) }
        : item,
    );
    if (items.every((item, index) => item === track.items[index])) return document;
    return replaceVideoTrack(document, { ...track, items }, this.updatedAt);
  }
}

export class SetVideoPitchPolicyCommand extends VideoTrackCommand {
  readonly type = 'SetVideoPitchPolicy';

  constructor(
    readonly itemId: string,
    readonly pitchPolicy: 'preserve' | 'resample',
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const items = track.items.map((item) =>
      item.id === this.itemId ? { ...item, pitchPolicy: this.pitchPolicy } : item,
    );
    if (items.every((item, index) => item === track.items[index])) return document;
    return replaceVideoTrack(document, { ...track, items }, this.updatedAt);
  }
}

export class SplitVideoItemCommand extends VideoTrackCommand {
  readonly type = 'SplitVideoItem';

  constructor(
    readonly itemId: string,
    readonly timelineTick: EditorTick,
    readonly rightItemId: string,
    readonly transitionId: string,
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const index = track.items.findIndex((item) => item.id === this.itemId);
    const item = track.items[index];
    if (!item || this.timelineTick <= item.timelineStart || this.timelineTick >= item.timelineEnd) {
      return document;
    }
    const sourceTick =
      item.sourceStart + Math.round((this.timelineTick - item.timelineStart) * item.speed);
    if (
      sourceTick - item.sourceStart < MIN_ITEM_TICKS ||
      item.sourceEnd - sourceTick < MIN_ITEM_TICKS
    ) {
      return document;
    }
    const left = { ...item, sourceEnd: sourceTick };
    const right = { ...item, id: this.rightItemId, sourceStart: sourceTick };
    const items = [...track.items];
    items.splice(index, 1, left, right);
    const transitions = track.transitions
      .map((transition) =>
        transition.fromItemId === item.id && transition.toItemId !== right.id
          ? { ...transition, fromItemId: right.id }
          : transition,
      )
      .concat({
        id: this.transitionId,
        kind: 'transition',
        fromItemId: left.id,
        toItemId: right.id,
        transition: 'cut',
        durationTicks: 0,
      });
    return replaceVideoTrack(
      document,
      reflowVideoTrack({ ...track, items, transitions }),
      this.updatedAt,
    );
  }
}

export class MoveVideoItemCommand extends VideoTrackCommand {
  readonly type = 'MoveVideoItem';

  constructor(
    readonly itemId: string,
    readonly toIndex: number,
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const fromIndex = track.items.findIndex((item) => item.id === this.itemId);
    if (fromIndex < 0) return document;
    const toIndex = Math.max(0, Math.min(track.items.length - 1, this.toIndex));
    if (fromIndex === toIndex) return document;
    const items = [...track.items];
    const [item] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, item);
    return replaceVideoTrack(
      document,
      reflowVideoTrack(normalizeTransitions({ ...track, items })),
      this.updatedAt,
    );
  }
}

export class DeleteVideoItemCommand extends VideoTrackCommand {
  readonly type = 'DeleteVideoItem';

  constructor(
    readonly itemId: string,
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    if (track.items.length <= 1) return document;
    const items = track.items.filter((item) => item.id !== this.itemId);
    if (items.length === track.items.length) return document;
    const transitions = track.transitions.filter(
      (transition) =>
        transition.fromItemId !== this.itemId && transition.toItemId !== this.itemId,
    );
    return replaceVideoTrack(
      document,
      reflowVideoTrack(normalizeTransitions({ ...track, items, transitions })),
      this.updatedAt,
    );
  }
}

export class DuplicateVideoItemCommand extends VideoTrackCommand {
  readonly type = 'DuplicateVideoItem';

  constructor(
    readonly itemId: string,
    readonly duplicateId: string,
    readonly transitionId: string,
    updatedAt: number,
  ) {
    super(updatedAt);
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    const track = getVideoTrack(document);
    const index = track.items.findIndex((item) => item.id === this.itemId);
    const item = track.items[index];
    if (!item) return document;
    const duplicate = { ...item, id: this.duplicateId };
    const items = [...track.items];
    items.splice(index + 1, 0, duplicate);
    const transitions = track.transitions.concat({
      id: this.transitionId,
      kind: 'transition',
      fromItemId: item.id,
      toItemId: duplicate.id,
      transition: 'cut',
      durationTicks: 0,
    });
    const normalized = reflowVideoTrack(normalizeTransitions({ ...track, items, transitions }));
    if (normalized.items[normalized.items.length - 1]?.timelineEnd > EDITOR_MAX_TICKS) {
      throw new Error('Duplicate would exceed the 120 second mobile policy');
    }
    return replaceVideoTrack(document, normalized, this.updatedAt);
  }
}
