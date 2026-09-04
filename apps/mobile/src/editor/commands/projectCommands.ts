import type { EditorCommand } from './command';
import type { MobileEditProjectV3 } from '../model/schema';

export class SetLinkedClipCommand implements EditorCommand {
  readonly type = 'SetLinkedClip';

  constructor(
    readonly linkedClipId: string | undefined,
    private readonly updatedAt: number,
  ) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return { ...document, linkedClipId: this.linkedClipId, updatedAt: this.updatedAt };
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new SetLinkedClipCommand(before.linkedClipId, this.updatedAt);
  }
}
