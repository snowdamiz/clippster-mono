import type { CreatorSkillPackage } from '@clippster/shared-types';

/** A cross-host logo must be explicitly embedded in its captured brand page. */
export function creatorSkillBrandLogo(item?: CreatorSkillPackage, capturedPages?: ReadonlySet<string>, headline?: string, linkedLogos?: ReadonlyMap<string, string>): { name: string; url: string } | null {
  const brands = item?.brandReferences ?? [];
  const namedBrands = brands.filter(brand => headline && new RegExp(`(^|[^\\p{L}\\p{N}])${brand.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(headline));
  // A multi-brand clip needs a matching headline; picking the first proposal can misbrand it.
  const candidates = namedBrands.length === 1 ? namedBrands : namedBrands.length === 0 && brands.length === 1 ? brands : [];
  for (const brand of candidates) {
    if (!brand.logoUrl) continue;
    if (capturedPages && !capturedPages.has(brand.sourceUrl)) continue;
    try {
      const page = new URL(brand.sourceUrl);
      const image = new URL(brand.logoUrl);
      if (page.protocol === 'https:' && image.protocol === 'https:' &&
          (page.hostname.toLowerCase() === image.hostname.toLowerCase() || linkedLogos?.get(brand.sourceUrl) === image.href) &&
          !image.username && !image.password && (!image.port || image.port === '443')) {
        return { name: brand.name, url: image.href };
      }
    } catch { /* Invalid proposals remain in the review notes. */ }
  }
  return null;
}
