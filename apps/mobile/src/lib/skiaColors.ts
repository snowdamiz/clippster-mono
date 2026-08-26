export function hexToSkiaColor(hex: string, alpha = 1): string {
  const clean = hex.replace('#', '');
  if (clean.length === 8) {
    const a = Number.parseInt(clean.slice(0, 2), 16) / 255;
    const r = Number.parseInt(clean.slice(2, 4), 16);
    const g = Number.parseInt(clean.slice(4, 6), 16);
    const b = Number.parseInt(clean.slice(6, 8), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (clean.length === 6) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}
