import { compileDocument, type CompileContext } from '../compiler/compile';
import { COMPOSITION_PATH } from '../director/validate';
import type { EditDocument, MediaItem } from '../types';
import type { HyperframesWorkspace } from './workspace';

/**
 * Link the project's media into the workspace and build the compiler context. Link names carry
 * part of the content hash, so a reused media id never points at a stale file.
 */
export async function linkProjectMedia(workspace: HyperframesWorkspace, media: MediaItem[]): Promise<CompileContext> {
  const items = media.map((item) => ({ id: `${item.id}-${item.contentHash.replace(/[^\w]/g, '').slice(-10)}`, path: item.path }));
  const { linked } = await workspace.linkMedia(items);
  const srcByLinkId = new Map(linked.map((entry) => [entry.id, entry.src]));
  return {
    gsapSrc: workspace.gsapSrc,
    fonts: workspace.fonts,
    media: Object.fromEntries(
      media.map((item, index) => [
        item.id,
        { src: srcByLinkId.get(items[index].id) ?? '', kind: item.kind, duration: item.duration, hasAudio: item.hasAudio },
      ])
    ),
  };
}

export function writeCompiledDocument(workspace: HyperframesWorkspace, document: EditDocument, context: CompileContext) {
  return workspace.writeFile('index.html', compileDocument(document, context));
}

export async function compositionPaths(workspace: HyperframesWorkspace): Promise<string[]> {
  return (await workspace.listFiles()).filter((path) => COMPOSITION_PATH.test(path));
}

export async function readCompositionFiles(workspace: HyperframesWorkspace): Promise<Record<string, string>> {
  const paths = await compositionPaths(workspace);
  const contents = await Promise.all(paths.map((path) => workspace.readFile(path)));
  return Object.fromEntries(paths.map((path, index) => [path, contents[index]]));
}

/** Make the workspace hold exactly the saved composition files (and the compiled root, when there is a document). */
export async function syncWorkspace(
  workspace: HyperframesWorkspace,
  files: Record<string, string>,
  document: EditDocument | null,
  context: CompileContext
) {
  for (const path of await compositionPaths(workspace)) {
    if (!(path in files)) await workspace.deleteFile(path);
  }
  for (const [path, content] of Object.entries(files)) {
    if (COMPOSITION_PATH.test(path)) await workspace.writeFile(path, content);
  }
  if (document) await writeCompiledDocument(workspace, document, context);
}
