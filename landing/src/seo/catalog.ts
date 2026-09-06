import pagesConfig from './pages.json'
import {
  getPage,
  getPrivatePrefixes,
  getRedirects,
  getSiteMeta,
  type SeoFaq,
  type SeoPage,
} from './content'
import { CAPTION_LANGUAGES_VERIFIED, publishTargetsLabel } from './productFacts'

const site = getSiteMeta()

export const SITE_URL = site.siteUrl
export const DEFAULT_OG_IMAGE = site.defaultImage
export const SITE_NAME = site.siteName

export type StaticSeoPage = {
  path: string
  title: string
  description: string
  canonical: string
  image: string
  noscript: string
  type?: SeoPage['type']
  faqs?: SeoFaq[]
  schema?: string[]
  reviewedAt?: string
}

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function getStaticPageSeo(pathname: string): StaticSeoPage | null {
  const path = normalizePath(pathname)
  const page = getPage(path)
  if (!page) return null
  return {
    path,
    title: page.title,
    description: page.description,
    canonical: absoluteUrl(path),
    image: DEFAULT_OG_IMAGE,
    noscript: page.noscript,
    type: page.type,
    faqs: page.faqs,
    schema: page.schema,
    reviewedAt: page.reviewedAt,
  }
}

export function isPrivatePath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return getPrivatePrefixes().some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function getSeoRedirect(pathname: string): string | null {
  const path = normalizePath(pathname)
  const redirects = getRedirects()
  return redirects[path] ?? null
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/logo-icon.svg'),
    sameAs: [] as string[],
  }
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows, macOS',
    url: SITE_URL,
    description: `Desktop clipping studio that finds livestream highlights, edits clips on a timeline, adds captions in ${CAPTION_LANGUAGES_VERIFIED} languages, and schedules posts to ${publishTargetsLabel()}.`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }
}

export function faqJsonLd(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }
}

export const EDITORIAL_AUTHOR = {
  name: 'Clippster Editorial',
  path: '/authors/clippster-editorial',
  description:
    'Accountable byline for Clippster product guides, platform hubs, comparisons, methodology, and workflow case studies.',
} as const

export function personJsonLd(input: {
  name: string
  description?: string
  path: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    worksFor: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

export function articleJsonLd(input: {
  title: string
  description: string
  path: string
  dateModified?: string
  datePublished?: string
}) {
  const url = absoluteUrl(input.path)
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    mainEntityOfPage: url,
    url,
    dateModified: input.dateModified,
    datePublished: input.datePublished ?? input.dateModified,
    author: {
      '@type': 'Person',
      name: EDITORIAL_AUTHOR.name,
      url: absoluteUrl(EDITORIAL_AUTHOR.path),
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/logo-icon.svg'),
      },
    },
    image: DEFAULT_OG_IMAGE,
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function clipperProfileJsonLd(input: {
  name: string
  description?: string | null
  slug: string
  image?: string | null
}) {
  const url = absoluteUrl(`/clippers/${input.slug}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${input.name} | Clipper on Clippster`,
    url,
    mainEntity: {
      '@type': 'Person',
      name: input.name,
      description: input.description || undefined,
      image: input.image || undefined,
      url,
    },
  }
}

export function orgProfileJsonLd(input: {
  name: string
  description?: string | null
  slug: string
  image?: string | null
}) {
  const url = absoluteUrl(`/orgs/${input.slug}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${input.name} | Clipping organization on Clippster`,
    url,
    mainEntity: {
      '@type': 'Organization',
      name: input.name,
      description: input.description || undefined,
      image: input.image || undefined,
      url,
    },
  }
}

/** Re-export registry meta for callers that still import pages.json shape. */
export const pagesRegistry = pagesConfig
