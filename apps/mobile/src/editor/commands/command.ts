import type { MobileEditProjectV3 } from '../model/schema';

export interface EditorCommand {
  readonly type: string;
  readonly coalescingKey?: string;
  apply(document: MobileEditProjectV3): MobileEditProjectV3;
  invert(before: MobileEditProjectV3): EditorCommand;
  coalesce?(next: EditorCommand): EditorCommand | null;
}

export function withUpdatedTimestamp(
  document: MobileEditProjectV3,
  updatedAt: number,
): MobileEditProjectV3 {
  return { ...document, updatedAt };
}
