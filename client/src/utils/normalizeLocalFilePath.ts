/**
 * Paths from the webview / DB may be `file://` URLs (common on macOS). Rust `Path` and `fs` need plain paths.
 */
export function normalizeLocalFilePathForFs(path: string): string {
  const t = path.trim();
  if (!t.startsWith('file://')) {
    return t;
  }
  let rest = t.slice('file://'.length);
  if (rest.startsWith('localhost')) {
    rest = rest.slice('localhost'.length);
  }
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}
