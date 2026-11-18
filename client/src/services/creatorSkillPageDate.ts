import type { CreatorSkillPackage } from '@clippster/shared-types';

const DATE_KEYS = new Set(['article:published_time', 'datepublished', 'pubdate', 'parsely-pub-date', 'citation_publication_date', 'dc.date.issued']);

/** Read only an explicit publication-date meta tag; this is page-advertised, not fact-checked. */
export function creatorSkillPagePublishedDate(html: string): string | undefined {
  const visibleMarkup = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ');
  for (const tag of visibleMarkup.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = new Map([...tag.matchAll(/\b([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1].toLowerCase(), match[2] ?? match[3]]));
    const key = (attributes.get('property') ?? attributes.get('name') ?? attributes.get('itemprop') ?? '').toLowerCase();
    if (!DATE_KEYS.has(key)) continue;
    const match = attributes.get('content')?.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:\b|T)/);
    if (!match) continue;
    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() + 1 === Number(month) && parsed.getUTCDate() === Number(day)) return `${year}-${month}-${day}`;
  }
  return undefined;
}

export function creatorSkillCaptureDateIssues(item: CreatorSkillPackage, url: string, pagePublishedAt?: string): string[] {
  if (!pagePublishedAt) return [];
  return item.claims.flatMap(claim => claim.sourceUrl === url && claim.publishedAt && claim.publishedAt.slice(0, 10) !== pagePublishedAt
    ? [`Claim at ${claim.time.toFixed(1)}s cites ${url} with proposed date ${claim.publishedAt}; the captured page advertises ${pagePublishedAt}. Check the publication date before publishing.`]
    : []);
}
