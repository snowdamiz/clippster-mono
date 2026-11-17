type RatioSettings = Record<string, { assetId?: string | number | null } | null>;

function parse(value: unknown): RatioSettings | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RatioSettings : null;
  } catch { return null; }
}

export function ratioAssetIds(value: unknown): string[] {
  const settings = parse(value);
  return settings ? Object.values(settings).flatMap(config => config?.assetId != null && String(config.assetId).trim() ? [String(config.assetId).trim()] : []) : [];
}

export function ratioAssetIdFor(value: unknown, ratio: string): string | undefined {
  const config = parse(value)?.[ratio];
  if (!config || (config as { enabled?: boolean }).enabled === false || config.assetId == null) return undefined;
  if (typeof config.assetId === 'number' && (!Number.isSafeInteger(config.assetId) || config.assetId <= 0)) return undefined;
  const id = String(config.assetId).trim();
  return id || undefined;
}

/** Rewrite local/cloud asset IDs without changing the per-ratio selection or nulls. */
export async function remapRatioAssetIds(value: unknown, mapId: (id: string) => Promise<string | number>): Promise<string | null> {
  if (value == null || value === '') return null;
  const settings = parse(value);
  if (!settings) throw new Error('Invalid per-ratio creator asset settings.');
  const entries = await Promise.all(Object.entries(settings).map(async ([ratio, config]) => {
    if (!config?.assetId) return [ratio, config] as const;
    return [ratio, { ...config, assetId: await mapId(String(config.assetId)) }] as const;
  }));
  return JSON.stringify(Object.fromEntries(entries));
}
