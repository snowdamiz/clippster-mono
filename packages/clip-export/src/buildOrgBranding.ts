export interface WatermarkSettings {
  position?: string;
  opacity?: number;
  scale?: number;
  margin?: number;
}

export interface OrgBrandingInput {
  videoPath: string;
  outputPath: string;
  width: number;
  height: number;
  watermarkPath?: string;
  watermarkSettings?: WatermarkSettings;
  introPath?: string;
  outroPath?: string;
}

export interface OrgBrandingPlan {
  ffmpegArgs: string[];
}

function getOverlayPosition(position: string | undefined, margin: number): string {
  switch (position) {
    case 'top-left':
      return `${margin}:${margin}`;
    case 'top-right':
      return `main_w-overlay_w-${margin}:${margin}`;
    case 'bottom-left':
      return `${margin}:main_h-overlay_h-${margin}`;
    case 'center':
      return '(main_w-overlay_w)/2:(main_h-overlay_h)/2';
    default:
      return `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`;
  }
}

export function buildOrgBrandingPlan(input: OrgBrandingInput): OrgBrandingPlan {
  const { videoPath, outputPath, width, height } = input;
  const wmSettings = input.watermarkSettings ?? {};
  const margin = wmSettings.margin ?? 16;
  const opacity = wmSettings.opacity ?? 0.85;
  const scale = wmSettings.scale ?? 0.15;
  const position = getOverlayPosition(wmSettings.position, margin);

  const inputs: string[] = [];
  let inputIndex = 0;
  const filterParts: string[] = [];
  const concatSegments: string[] = [];

  if (input.introPath) {
    inputs.push('-i', input.introPath);
    const introIdx = inputIndex++;
    filterParts.push(
      `[${introIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[introv]`,
    );
    filterParts.push(`[${introIdx}:a]aresample=async=1:first_pts=0[introa]`);
    concatSegments.push('[introv][introa]');
  }

  inputs.push('-i', videoPath);
  const mainIdx = inputIndex++;
  let mainVideoLabel = `${mainIdx}:v`;
  let mainAudioLabel = `${mainIdx}:a`;

  filterParts.push(
    `[${mainVideoLabel}]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[mainv]`,
  );
  mainVideoLabel = 'mainv';
  filterParts.push(`[${mainAudioLabel}]aresample=async=1:first_pts=0[maina]`);
  mainAudioLabel = 'maina';

  if (input.watermarkPath) {
    inputs.push('-i', input.watermarkPath);
    const wmIdx = inputIndex++;
    filterParts.push(
      `[${wmIdx}:v]scale=iw*${scale}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm]`,
    );
    filterParts.push(`[${mainVideoLabel}][wm]overlay=${position}:format=auto[mainwm]`);
    mainVideoLabel = 'mainwm';
  }

  concatSegments.push(`[${mainVideoLabel}][${mainAudioLabel}]`);

  if (input.outroPath) {
    inputs.push('-i', input.outroPath);
    const outroIdx = inputIndex++;
    filterParts.push(
      `[${outroIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[outrov]`,
    );
    filterParts.push(`[${outroIdx}:a]aresample=async=1:first_pts=0[outroa]`);
    concatSegments.push('[outrov][outroa]');
  }

  const segmentCount = concatSegments.length;
  filterParts.push(`${concatSegments.join('')}concat=n=${segmentCount}:v=1:a=1[outv][outa]`);

  const filterComplex = filterParts.join(';');

  const ffmpegArgs = [
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    '-y',
    outputPath,
  ];

  return { ffmpegArgs };
}
