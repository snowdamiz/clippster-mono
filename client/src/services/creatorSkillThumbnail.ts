const WIDTH = 1280;
const HEIGHT = 720;
const PANEL = 460;
const ACCENTS = ['#facc15', '#38bdf8', '#fb7185', '#a3e635'];

export const CREATOR_SKILL_THUMBNAIL_SIZE = { width: WIDTH, height: HEIGHT } as const;

/** Draw a review draft using only an unaltered frame from this VOD and short editorial text. */
export function drawCreatorSkillThumbnail(
  context: Pick<CanvasRenderingContext2D, 'drawImage' | 'fillRect' | 'fillText' | 'measureText' | 'fillStyle' | 'font' | 'textBaseline' | 'save' | 'restore' | 'shadowColor' | 'shadowBlur'>,
  image: CanvasImageSource,
  imageSize: { width: number; height: number },
  headline: string,
  index: number,
  logo?: { image: CanvasImageSource; width: number; height: number },
  brandColors: string[] = [],
  portraitCutout?: CanvasImageSource,
): void {
  const variant = index % 4;
  const palette = brandColors.filter(color => /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color.trim()));
  const accent = palette.length ? palette[variant % palette.length].trim() : ACCENTS[variant];
  const panelLeft = variant % 2 === 0;
  const frameX = panelLeft ? PANEL : 0;
  const frameWidth = WIDTH - PANEL;
  // Keep the whole source frame visible. A centered cover crop can remove a face near an edge.
  const scale = Math.min((portraitCutout ? WIDTH : frameWidth) / imageSize.width, HEIGHT / imageSize.height);
  const imageWidth = imageSize.width * scale;
  const imageHeight = imageSize.height * scale;
  context.fillStyle = '#111827';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const imageX = portraitCutout ? (WIDTH - imageWidth) / 2 : frameX + (frameWidth - imageWidth) / 2;
  const imageY = (HEIGHT - imageHeight) / 2;
  context.drawImage(image, imageX, imageY, imageWidth, imageHeight);
  const panelX = panelLeft ? 0 : frameWidth;
  context.fillStyle = '#0a0d13';
  context.fillRect(panelX, 0, PANEL, HEIGHT);
  context.fillStyle = accent;
  context.fillRect(panelX, 0, 12, HEIGHT);
  if (portraitCutout) {
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.7)';
    context.shadowBlur = 28;
    context.drawImage(portraitCutout, imageX, imageY, imageWidth, imageHeight);
    context.shadowColor = '#ffffff';
    context.shadowBlur = 8;
    context.drawImage(portraitCutout, imageX, imageY, imageWidth, imageHeight);
    context.restore();
  }
  const words = headline.trim().split(/\s+/).slice(0, 4);
  const lines = words.length <= 2 ? words : [words.slice(0, 2).join(' '), words.slice(2).join(' ')];
  const x = panelX + 42;
  context.textBaseline = 'middle';
  for (const [lineIndex, line] of lines.entries()) {
    let size = 94;
    do { context.font = `900 ${size}px Arial, sans-serif`; size -= 4; }
    while (context.measureText(line).width > PANEL - 82 && size >= 42);
    context.fillStyle = lineIndex === lines.length - 1 ? accent : '#ffffff';
    context.fillText(line.toUpperCase(), x, 285 + lineIndex * 120);
  }
  context.fillStyle = '#e5e7eb';
  context.font = 'bold 28px Arial, sans-serif';
  context.fillText('REVIEW DRAFT', x, 648);
  if (logo?.width && logo.height) {
    const boxWidth = 190;
    const boxHeight = 100;
    const scale = Math.min(boxWidth / logo.width, boxHeight / logo.height);
    const width = logo.width * scale;
    const height = logo.height * scale;
    context.drawImage(logo.image, x, 65, width, height);
  }
}
