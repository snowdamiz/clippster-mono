import encodeQR from 'qr';
import decodeQR from 'qr/decode.js';

/** Encode a saved referral URL locally and decode its raster matrix before using it. */
export function creatorSkillQrSvg(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 1024) throw new Error('The saved referral URL is not suitable for a QR card.');
  const modules = encodeQR(value, 'raw', { border: 4, ecc: 'medium' });
  const scale = 4;
  const side = modules.length * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const dark = modules[Math.floor(y / scale)][Math.floor(x / scale)];
    const offset = (y * side + x) * 4;
    data.fill(dark ? 0 : 255, offset, offset + 3);
    data[offset + 3] = 255;
  }
  if (decodeQR({ width: side, height: side, data }, { effort: Infinity, timeLimit: Infinity }) !== value) {
    throw new Error('The referral QR code did not decode to the saved URL.');
  }
  const rects = modules.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`<rect x="${x}" y="${y}" width="1" height="1"/>`] : []));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules.length} ${modules.length}" role="img" aria-label="Referral QR code"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
}
