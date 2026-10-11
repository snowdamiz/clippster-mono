import type { ManualFramingConfig, ManualRegion, TargetAspectRatio } from '@clippster/shared-types';
import { TARGET_DIMENSIONS, manualSourceRect } from '@clippster/shared-types';

export interface FramingFilterInput {
  framingConfig: ManualFramingConfig | null;
  targetRatio: TargetAspectRatio;
  sourceWidth?: number;
  sourceHeight?: number;
  fit?: 'cover' | 'contain';
  mediaSources?: Record<string, number>;
}

export interface FramingFilterResult {
  filterComplex: string;
  outputLabel: string;
  width: number;
  height: number;
}

function ratioToValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  return (w || 16) / (h || 9);
}

export function getActiveRegionsForTime(
  config: ManualFramingConfig,
  clipRelativeTime: number,
): ManualRegion[] {
  const segmentConfigs = config.segmentConfigs ?? [];
  if (segmentConfigs.length === 0) {
    return config.regions;
  }

  const active = segmentConfigs.find(
    (seg) => clipRelativeTime >= seg.startTime && clipRelativeTime < seg.endTime,
  );
  return active?.regions ?? config.regions;
}

export function buildFramingFilterGraph(input: FramingFilterInput): FramingFilterResult | null {
  const { framingConfig, targetRatio } = input;
  const dims = TARGET_DIMENSIONS[targetRatio];
  const width = dims.width;
  const height = dims.height;

  if (framingConfig?.segmentConfigs?.length) {
    const configs = [framingConfig, ...framingConfig.segmentConfigs.map(segment => ({ ...framingConfig, regions: segment.regions }))];
    const parts = [`[0:v]split=${configs.length}${configs.map((_, i) => `[timed_source_${i}]`).join('')}`];
    configs.forEach((config, i) => {
      const graph = buildFramingFilterGraph({ ...input, framingConfig: { ...config, segmentConfigs: [] } })!;
      parts.push(graph.filterComplex.replace(/\[([^\]]+)\]/g, (_, label: string) => label === '0:v' ? `[timed_source_${i}]` : /^\d+:v$/.test(label) ? `[${label}]` : `[timed_${i}_${label}]`));
    });
    let previous = 'timed_0_framed';
    framingConfig.segmentConfigs.forEach((segment, i) => {
      const output = i === framingConfig.segmentConfigs!.length - 1 ? 'framed' : `timed_result_${i}`;
      parts.push(`[${previous}][timed_${i + 1}_framed]overlay=0:0:shortest=1:enable='gte(t,${segment.startTime})*lt(t,${segment.endTime})'[${output}]`);
      previous = output;
    });
    return { filterComplex: parts.join(';'), outputLabel: 'framed', width, height };
  }

  if (!framingConfig || (framingConfig.regions.length === 0 && !framingConfig.brollConfigs?.length && !framingConfig.sourceFrameMode)) {
    const sourceRatio = ratioToValue(framingConfig?.sourceAspectRatio ?? '16:9');
    const targetRatioVal = ratioToValue(targetRatio);
    if (input.fit === 'cover' || (input.fit !== 'contain' && sourceRatio > targetRatioVal)) {
      return {
        filterComplex: `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2[framed]`,
        outputLabel: 'framed',
        width,
        height,
      };
    }
    return {
      filterComplex: `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black[framed]`,
      outputLabel: 'framed',
      width,
      height,
    };
  }

  const broll = framingConfig.brollConfigs || [];
  const regions = [...framingConfig.regions, ...broll.map(part => part.region)];
  // Split the composed source explicitly: filtered output labels are single-use.
  // Derive the background from it as well to retain its full duration and frame rate.
  const filters: string[] = [
    `[0:v]split=${regions.length + 1}[base_source]${regions.map((_, index) => `[region_source${index}]`).join('')}`,
    `[base_source]scale=${width}:${height},setsar=1,drawbox=c=black:t=fill[base]`,
  ];
  if (framingConfig.sourceFrameMode && framingConfig.sourceFrameMode !== 'none') {
    filters.pop();
    const rect = manualSourceRect(framingConfig, width, height);
    const fw = Math.max(2, Math.round(rect.width / 2) * 2), fh = Math.max(2, Math.round(rect.height / 2) * 2);
    const blur = framingConfig.blurEnabled ? Math.max(0.1, (framingConfig.blurAmount ?? 12) * height / 1080) : 0;
    if (framingConfig.sourceFrameMode === 'use16x9') {
      filters.push('[base_source]split=2[bg_source][sharp_source]',
        `[bg_source]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}${blur ? `,gblur=sigma=${blur}` : ''},setsar=1[background]`,
        `[sharp_source]scale=${fw}:${fh},setsar=1[foreground]`);
    } else {
      filters.push('[base_source]split=2[bg_source][sharp_source]',
        `[bg_source]scale=${width}:${height},drawbox=c=black:t=fill,setsar=1[background]`,
        `[sharp_source]scale=${fw}:${fh}${blur ? `,gblur=sigma=${blur}` : ''},setsar=1[foreground]`);
    }
    filters.push(`[background][foreground]overlay=${Math.round(rect.x)}:${Math.round(rect.y)}:shortest=1[base]`);
  }
  let currentLabel = 'base';

  regions.forEach((region, index) => {
    const cropW = Math.max(0.01, region.source.width);
    const cropH = Math.max(0.01, region.source.height);
    const cropX = region.source.x;
    const cropY = region.source.y;
    const outX = Math.round(region.output.x * width);
    const outY = Math.round(region.output.y * height);
    const outW = Math.max(1, Math.round(region.output.width * width));
    const outH = Math.max(1, Math.round(region.output.height * height));

    const cropLabel = `crop${index}`;
    const scaleLabel = `scaled${index}`;
    const overlayLabel = index === regions.length - 1 ? 'framed' : `ovl${index}`;

    const mediaIndex = region.mediaAssetId ? input.mediaSources?.[region.mediaAssetId] : undefined;
    if (region.mediaAssetId && mediaIndex === undefined) throw new Error('Framing media asset is unavailable');
    if (mediaIndex !== undefined) filters.push(`[region_source${index}]nullsink`);
    const radius = Math.min(region.cornerRadiusEnabled ? (region.cornerRadiusPx ?? 0) * outW / 1080 : 0, outW / 2, outH / 2);
    const timing = index >= framingConfig.regions.length ? broll[index - framingConfig.regions.length] : undefined;
    const timestamps = mediaIndex !== undefined ? `trim=start=${region.mediaSourceOffset || 0},setpts=PTS-STARTPTS${timing ? `+${timing.startTime}/TB` : ''},` : '';
    const scale = mediaIndex === undefined ? `scale=${outW}:${outH}` : `scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH}`;
    const corners = radius > 0 ? `,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(max(abs(X-W/2)-(W/2-${radius}),0),2)+pow(max(abs(Y-H/2)-(H/2-${radius}),0),2),${radius * radius}),255,0)'` : '';
    filters.push(
      `[${mediaIndex === undefined ? `region_source${index}` : `${mediaIndex}:v`}]${timestamps}crop=iw*${cropW}:ih*${cropH}:iw*${cropX}:ih*${cropY}[${cropLabel}]`,
      `[${cropLabel}]${scale},setsar=1${corners}[${scaleLabel}]`,
      `[${currentLabel}][${scaleLabel}]overlay=${outX}:${outY}:shortest=1${timing ? `:enable='gte(t,${timing.startTime})*lt(t,${timing.endTime})'` : ''}[${overlayLabel}]`,
    );
    currentLabel = overlayLabel;
  });
  if (!regions.length) filters.push('[base]null[framed]');

  return {
    filterComplex: filters.join(';'),
    outputLabel: 'framed',
    width,
    height,
  };
}
