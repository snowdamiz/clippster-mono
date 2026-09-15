import type { EditorCommand } from '../commands/command'
import type { MobileEditProjectV3 } from '../model/schema'

/** One undoable Android composition swap after the draft has passed preflight. */
export class ApplyTemplateCommand implements EditorCommand {
  readonly type = 'ApplyTemplate'

  constructor(private readonly next: MobileEditProjectV3) {}

  apply(document: MobileEditProjectV3): MobileEditProjectV3 {
    return {
      ...this.next,
      id: document.id,
      targetId: document.targetId,
      projectId: document.projectId,
      linkedClipId: document.linkedClipId,
      createdAt: document.createdAt
    }
  }

  invert(before: MobileEditProjectV3): EditorCommand {
    return new ApplyTemplateCommand(before)
  }
}
