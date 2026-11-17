import type { CreatorSkillPreferences } from '@clippster/shared-types';

export function parseCreatorSkillPreferences(value: unknown): CreatorSkillPreferences {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as CreatorSkillPreferences;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as CreatorSkillPreferences;
  } catch {
    // Preferences saved before the structured editor were plain editing instructions.
  }
  return { editing: { rules: [value.trim()] } };
}

export function serializeCreatorSkillPreferences(value: CreatorSkillPreferences): string | undefined {
  const brand = value.brand;
  const delivery = value.delivery;
  if (delivery?.previewMaxMb !== undefined && (!Number.isFinite(delivery.previewMaxMb) || delivery.previewMaxMb < 1 || delivery.previewMaxMb > 200)) {
    throw new Error('Phone preview size must be between 1 and 200 MB.');
  }
  const editing = value.editing;
  const sponsors = value.sponsors?.filter((sponsor) => sponsor.name.trim()).map((sponsor) => ({
    name: sponsor.name.trim(),
    ...(sponsor.referralUrl?.trim() && { referralUrl: sponsor.referralUrl.trim() }),
    ...(sponsor.code?.trim() && { code: sponsor.code.trim() }),
    ...(sponsor.disclosure?.trim() && { disclosure: sponsor.disclosure.trim() }),
    ...(sponsor.riskLine?.trim() && { riskLine: sponsor.riskLine.trim() }),
    ...(sponsor.discountInDescriptionAllowed !== undefined && { discountInDescriptionAllowed: sponsor.discountInDescriptionAllowed }),
    ...(sponsor.platforms?.some((platform) => platform.trim()) && {
      platforms: sponsor.platforms.map((platform) => platform.trim()).filter(Boolean),
    }),
  }));
  const publishing = value.publishing;
  const hasEditing = editing && (
    editing.preserveEveryWord === false || editing.musicAllowed === true ||
    editing.soundEffectsAllowed === true ||
    (editing.graphicDensity && editing.graphicDensity !== 'standard') ||
    editing.rules?.some((rule) => rule.trim())
  );
  const hasPublishing = publishing && (publishing.audience?.trim() || publishing.tone?.trim() || publishing.callToAction?.trim() || publishing.schedule?.trim() || publishing.platforms?.some((platform) => platform.trim()));
  const normalized: CreatorSkillPreferences = {
    ...(brand && (brand.channelName?.trim() || brand.companyUrl?.trim() || brand.colors?.some(color => color.trim()) || brand.fonts?.some(font => font.trim())) && {
      brand: {
        ...(brand.channelName?.trim() && { channelName: brand.channelName.trim() }),
        ...(brand.companyUrl?.trim() && { companyUrl: brand.companyUrl.trim() }),
        colors: brand.colors?.map(color => color.trim()).filter(Boolean) ?? [],
        fonts: brand.fonts?.map(font => font.trim()).filter(Boolean) ?? [],
      },
    }),
    ...(hasEditing && {
      editing: {
        preserveEveryWord: editing.preserveEveryWord ?? true,
        musicAllowed: editing.musicAllowed ?? false,
        soundEffectsAllowed: editing.soundEffectsAllowed ?? false,
        graphicDensity: editing.graphicDensity ?? 'standard',
        rules: editing.rules?.map((rule) => rule.trim()).filter(Boolean) ?? [],
      },
    }),
    ...(sponsors?.length && { sponsors }),
    ...(hasPublishing && {
      publishing: {
        ...(publishing.audience?.trim() && { audience: publishing.audience.trim() }),
        ...(publishing.tone?.trim() && { tone: publishing.tone.trim() }),
        ...(publishing.callToAction?.trim() && { callToAction: publishing.callToAction.trim() }),
        ...(publishing.schedule?.trim() && { schedule: publishing.schedule.trim() }),
        platforms: publishing.platforms?.map((platform) => platform.trim()).filter(Boolean) ?? [],
      },
    }),
    ...(delivery && (delivery.destination?.trim() || (Number.isFinite(delivery.previewMaxMb) && (delivery.previewMaxMb ?? 0) > 0)) && {
      delivery: {
        ...(delivery.destination?.trim() && { destination: delivery.destination.trim() }),
        ...(Number.isFinite(delivery.previewMaxMb) && (delivery.previewMaxMb ?? 0) > 0 && { previewMaxMb: delivery.previewMaxMb }),
      },
    }),
  };
  return Object.keys(normalized).length ? JSON.stringify(normalized) : undefined;
}
