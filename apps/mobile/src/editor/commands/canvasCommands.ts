import {
  transformForRatio,
  type CanvasRatio,
  type MobileEditProjectV3,
  type RatioAwareTransform,
  type Transform,
} from '../model/schema';
import type { EditorCommand } from './command';

export class SetCanvasRatioCommand implements EditorCommand {
  readonly type = 'SetCanvasRatio';

  constructor(
    readonly ratio: CanvasRatio,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (document.canvas.activeRatio === this.ratio) return document;
    return {
      ...document,
      canvas: { ...document.canvas, activeRatio: this.ratio },
      updatedAt: this.updatedAt,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new SetCanvasRatioCommand(before.canvas.activeRatio, this.updatedAt);
  }
}

export class SetCanvasSafeAreaCommand implements EditorCommand {
  readonly type = 'SetCanvasSafeArea';

  constructor(
    readonly visible: boolean,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (document.canvas.safeAreaVisible === this.visible) return document;
    return {
      ...document,
      canvas: { ...document.canvas, safeAreaVisible: this.visible },
      updatedAt: this.updatedAt,
    };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new SetCanvasSafeAreaCommand(before.canvas.safeAreaVisible, this.updatedAt);
  }
}

export class SetItemTransformCommand implements EditorCommand {
  readonly type = 'SetItemTransform';
  readonly coalescingKey: string;

  constructor(
    readonly itemId: string,
    readonly ratio: CanvasRatio,
    readonly transform: Transform,
    private readonly updatedAt: number,
  ) {
    this.coalescingKey = `${this.type}:${itemId}:${ratio}`;
  }

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    if (document.captionDocument?.id === this.itemId) {
      return {
        ...document,
        captionDocument: {
          ...document.captionDocument,
          transform: setRatioTransform(document.captionDocument.transform, this.ratio, this.transform),
        },
        updatedAt: this.updatedAt,
      };
    }

    let found = false;
    const tracks = document.tracks.map((track) => {
      if (track.kind === 'audio') return track;
      if (track.kind === 'video') {
        const items = track.items.map((item) => {
          if (item.id !== this.itemId) return item;
          found = true;
          return { ...item, transform: setRatioTransform(item.transform, this.ratio, this.transform) };
        });
        return found ? { ...track, items } : track;
      }
      if (track.kind === 'text') {
        const items = track.items.map((item) => {
          if (item.id !== this.itemId) return item;
          found = true;
          return { ...item, transform: setRatioTransform(item.transform, this.ratio, this.transform) };
        });
        return found ? { ...track, items } : track;
      }
      const items = track.items.map((item) => {
        if (item.id !== this.itemId) return item;
        found = true;
        return { ...item, transform: setRatioTransform(item.transform, this.ratio, this.transform) };
      });
      return found ? { ...track, items } : track;
    });
    if (!found) return document;
    return { ...document, tracks, updatedAt: this.updatedAt };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    const transform = findRatioTransform(before, this.itemId, this.ratio);
    if (!transform) throw new Error(`Cannot invert transform for missing item ${this.itemId}`);
    return new SetItemTransformCommand(this.itemId, this.ratio, transform, this.updatedAt);
  }

  coalesce(next: EditorCommand): EditorCommand | null {
    return next instanceof SetItemTransformCommand &&
      next.itemId === this.itemId &&
      next.ratio === this.ratio
      ? next
      : null;
  }
}

function setRatioTransform(
  current: RatioAwareTransform,
  ratio: CanvasRatio,
  transform: Transform,
): RatioAwareTransform {
  return {
    base: { ...current.base },
    overrides: {
      ...current.overrides,
      [ratio]: { ...transform },
    },
  };
}

function findRatioTransform(
  document: MobileEditProjectV3,
  itemId: string,
  ratio: CanvasRatio,
): Transform | null {
  if (document.captionDocument?.id === itemId) {
    return transformForRatio(document.captionDocument.transform, ratio);
  }
  for (const track of document.tracks) {
    if (track.kind !== 'video' && track.kind !== 'text' && track.kind !== 'overlay') continue;
    const item = track.items.find((candidate) => candidate.id === itemId);
    if (item) return transformForRatio(item.transform, ratio);
  }
  return null;
}
