import pagesConfig from './pages.json'

export type SeoPageType =
  | 'home'
  | 'pillar'
  | 'platform'
  | 'guide'
  | 'comparison'
  | 'directory'
  | 'legal'
  | 'tool'
  | 'authority'

export type SeoFaq = { q: string; a: string }

export type SeoPageRecord = {
  title: string
  description: string
  noscript: string
  type: SeoPageType
  primaryKeyword: string
  parent: string | null
  priority: string
  changefreq: string
  schema: string[]
  faqs: SeoFaq[]
  reviewedAt: string
}

export type SeoPage = SeoPageRecord & { path: string }

type PagesConfig = {
  siteUrl: string
  defaultImage: string
  siteName: string
  privatePrefixes: string[]
  redirects: Record<string, string>
  pages: Record<string, SeoPageRecord>
}

const config = pagesConfig as PagesConfig

const TITLE_MIN = 10
const TITLE_MAX = 70
const DESCRIPTION_MAX = 165

function normalizeRegistryPath(path: string): string {
  if (!path || path === '/') return '/'
  return path.replace(/\/+$/, '') || '/'
}

export function getSiteMeta() {
  return {
    siteUrl: config.siteUrl.replace(/\/$/, ''),
    defaultImage: config.defaultImage,
    siteName: config.siteName,
  }
}

/** @deprecated Prefer getSiteMeta */
export const getSiteConfig = getSiteMeta

export function getAllPages(): SeoPage[] {
  return Object.entries(config.pages).map(([path, page]) => ({
    path,
    ...page,
    faqs: page.faqs ?? [],
    reviewedAt: page.reviewedAt ?? '',
  }))
}

export function getPage(path: string): SeoPage | null {
  const normalized = normalizeRegistryPath(path)
  const page = config.pages[normalized]
  if (!page) return null
  return {
    path: normalized,
    ...page,
    faqs: page.faqs ?? [],
    reviewedAt: page.reviewedAt ?? '',
  }
}

export function getPagesByType(type: SeoPageType): SeoPage[] {
  return getAllPages().filter((page) => page.type === type)
}

export function getRedirects(): Record<string, string> {
  return { ...config.redirects }
}

export function getPrivatePrefixes(): string[] {
  return [...config.privatePrefixes]
}

export type RegistryValidation = {
  ok: boolean
  errors: string[]
}

export function validateRegistry(): RegistryValidation {
  const errors: string[] = []
  const keywordOwners = new Map<string, string>()
  const pages = getAllPages()

  for (const page of pages) {
    if (!page.title?.trim()) errors.push(`${page.path}: missing title`)
    if (!page.description?.trim()) errors.push(`${page.path}: missing description`)
    if (!page.noscript?.trim()) errors.push(`${page.path}: missing noscript`)
    if (!page.reviewedAt?.trim()) errors.push(`${page.path}: missing reviewedAt`)

    const titleLen = page.title?.length ?? 0
    if (titleLen < TITLE_MIN || titleLen > TITLE_MAX) {
      errors.push(`${page.path}: title length ${titleLen} outside ${TITLE_MIN}-${TITLE_MAX}`)
    }
    if ((page.description?.length ?? 0) > DESCRIPTION_MAX) {
      errors.push(
        `${page.path}: description length ${page.description.length} exceeds ${DESCRIPTION_MAX}`,
      )
    }

    const keyword = page.primaryKeyword?.trim().toLowerCase() ?? ''
    if (!keyword) {
      errors.push(`${page.path}: missing primaryKeyword`)
    } else if (keywordOwners.has(keyword)) {
      errors.push(
        `${page.path}: duplicate primaryKeyword "${page.primaryKeyword}" (also ${keywordOwners.get(keyword)})`,
      )
    } else {
      keywordOwners.set(keyword, page.path)
    }

    if (page.type === 'guide' && !page.parent) {
      errors.push(`${page.path}: guides require a parent`)
    }

    if (page.parent && !config.pages[page.parent]) {
      errors.push(`${page.path}: parent "${page.parent}" is not in the registry`)
    }
  }

  for (const [from, to] of Object.entries(config.redirects)) {
    if (!config.pages[to]) {
      errors.push(`redirect ${from} → ${to}: target missing from pages`)
    }
  }

  return { ok: errors.length === 0, errors }
}

export type RelatedPageLink = {
  path: string
  title: string
  description: string
  type: SeoPageType
  relation: 'parent' | 'sibling' | 'child'
}

export function relatedPages(path: string): RelatedPageLink[] {
  const page = getPage(path)
  if (!page) return []

  const links: RelatedPageLink[] = []
  const seen = new Set<string>()

  const push = (targetPath: string, relation: RelatedPageLink['relation']) => {
    if (targetPath === page.path || seen.has(targetPath)) return
    const target = getPage(targetPath)
    if (!target) return
    seen.add(targetPath)
    links.push({
      path: target.path,
      title: target.title,
      description: target.description,
      type: target.type,
      relation,
    })
  }

  if (page.parent) push(page.parent, 'parent')

  for (const candidate of getAllPages()) {
    if (
      candidate.path !== page.path &&
      page.parent &&
      candidate.parent === page.parent &&
      candidate.type === page.type
    ) {
      push(candidate.path, 'sibling')
    }
  }

  for (const candidate of getAllPages()) {
    if (candidate.parent === page.path) push(candidate.path, 'child')
  }

  return links
}
