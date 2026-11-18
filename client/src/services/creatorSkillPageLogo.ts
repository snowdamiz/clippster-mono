/** An image proposed by the editor may cross hosts only if the cited public page actually embeds it. */
export function pageLinksProposedLogo(html: string, pageUrl: string, proposedUrl?: string): boolean {
  if (!proposedUrl) return false;
  let expected: URL;
  try { expected = new URL(proposedUrl); } catch { return false; }
  if (expected.protocol !== 'https:' || expected.username || expected.password || (expected.port && expected.port !== '443')) return false;
  const visibleMarkup = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  for (const tag of visibleMarkup.match(/<(?:img|meta)\b[^>]*>/gi) ?? []) {
    const isLogoImage = /^<img\b/i.test(tag) && /\balt\s*=\s*(?:"[^"]*logo[^"]*"|'[^']*logo[^']*')/i.test(tag);
    const isSocialImage = /^<meta\b/i.test(tag) && /\b(?:name|property)\s*=\s*(?:"(?:og:image|twitter:image|logo)"|'(?:og:image|twitter:image|logo)')/i.test(tag);
    if (!isLogoImage && !isSocialImage) continue;
    const attribute = tag.match(/\b(?:src|content)\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (!attribute) continue;
    try {
      if (new URL(attribute[1] ?? attribute[2], pageUrl).href === expected.href) return true;
    } catch { /* Ignore malformed page references. */ }
  }
  return false;
}
