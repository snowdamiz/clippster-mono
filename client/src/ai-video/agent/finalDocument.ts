import { validateDocument } from '../director/validate';
import type { EditDocument, MediaItem } from '../types';

/** Validate the authored edit against files that will actually be exported. */
export function finalAgentDocument(
  document: EditDocument,
  files: Record<string, string>,
  media: MediaItem[],
  maxSeconds: number,
  exampleShots = 0,
): EditDocument {
  const usable = { ...document, overlays: document.overlays.filter((overlay) => overlay.composition in files) };
  const result = validateDocument(usable, {
    media,
    maxSeconds,
    exampleShots,
    files: Object.keys(files),
    requireFiles: true,
  });
  if (result.errors.length) throw new Error(`The finished edit is invalid: ${result.errors[0]}`);
  return result.document;
}
