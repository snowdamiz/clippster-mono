function readBoxSize(bytes: Uint8Array, offset: number): number {
  if (offset + 8 > bytes.length) return 0;
  const size =
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  return size >>> 0;
}

function readBoxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset + 4],
    bytes[offset + 5],
    bytes[offset + 6],
    bytes[offset + 7],
  );
}

/** True when `moov` is before `mdat` — the player can start without scanning the whole file. */
export function moovIsBeforeMdat(header: Uint8Array): boolean {
  let offset = 0;
  while (offset + 8 <= header.length) {
    const size = readBoxSize(header, offset);
    const type = readBoxType(header, offset);
    if (size < 8) break;
    if (type === 'moov') return true;
    if (type === 'mdat') return false;
    offset += size;
  }
  return false;
}
