// Runtime-independent site logic shared by the Node server (Fly) and the Cloudflare Worker.
import pagesConfig from './src/seo/pages.json' with { type: 'json' }

export const SITE_URL = (process.env.SITE_URL || pagesConfig.siteUrl).replace(/\/$/, '')
export const API_URL = (process.env.API_URL || 'https://api.clippster.app/api').replace(/\/$/, '')
const DEFAULT_IMAGE = pagesConfig.defaultImage
const PRIVATE_PREFIXES = pagesConfig.privatePrefixes || []
const REDIRECTS = pagesConfig.redirects || {}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

const MAX_PROFILE_CACHE = 500
let sitemapCache = { at: 0, data: null }
const SITEMAP_TTL_MS = 10 * 60 * 1000
const profileCache = new Map()
const PROFILE_TTL_MS = 60 * 1000

export function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function normalizePath(pathname) {
  const decoded = decodeURIComponent(pathname || '/')
  if (!decoded || decoded === '/') return '/'
  const trimmed = decoded.replace(/\/+$/, '')
  return trimmed || '/'
}

export function isProxyPath(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function redirectLocation(hostname, pathname, search) {
  if (hostname === 'www.clippster.app') return `${SITE_URL}${pathname}${search}`
  if (REDIRECTS[pathname]) return `${SITE_URL}${REDIRECTS[pathname]}`
  return null
}

export function assetCacheControl(filePath) {
  return filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
}

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function upsertMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i')
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function upsertLink(html, rel, href) {
  const tag = `<link rel="${rel}" href="${escapeAttr(href)}" />`
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i')
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

export function applySeo(html, seo) {
  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)
  next = upsertMeta(next, 'name', 'description', seo.description)
  next = upsertMeta(next, 'name', 'robots', seo.robots || 'index, follow')
  next = upsertMeta(next, 'property', 'og:title', seo.title)
  next = upsertMeta(next, 'property', 'og:description', seo.description)
  next = upsertMeta(next, 'property', 'og:type', 'website')
  next = upsertMeta(next, 'property', 'og:url', seo.canonical)
  next = upsertMeta(next, 'property', 'og:site_name', pagesConfig.siteName)
  next = upsertMeta(next, 'property', 'og:image', seo.image || DEFAULT_IMAGE)
  next = upsertMeta(next, 'name', 'twitter:card', 'summary_large_image')
  next = upsertMeta(next, 'name', 'twitter:title', seo.title)
  next = upsertMeta(next, 'name', 'twitter:description', seo.description)
  next = upsertMeta(next, 'name', 'twitter:image', seo.image || DEFAULT_IMAGE)
  next = upsertLink(next, 'canonical', seo.canonical)

  const jsonLdBlocks = Array.isArray(seo.jsonLd) ? seo.jsonLd : seo.jsonLd ? [seo.jsonLd] : []
  if (jsonLdBlocks.length) {
    const scripts = jsonLdBlocks
      .map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
      .join('\n    ')
    next = next.replace('</head>', `    ${scripts}\n  </head>`)
  }

  if (seo.noscript) {
    next = next.replace(
      '</body>',
      `  <noscript><article>${seo.noscript}</article></noscript>\n  </body>`,
    )
  }

  return next
}

function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Clippster',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows, macOS',
    url: SITE_URL,
    description:
      'Desktop clipping studio that finds livestream highlights, edits clips on a timeline, and schedules posts to Instagram, TikTok, X, and YouTube.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
}

function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Clippster',
    url: SITE_URL,
    logo: `${SITE_URL}/favicon-192.png`,
  }
}

function faqJsonLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (faqs || []).map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Clippster-SEO/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

async function getSitemapData() {
  if (sitemapCache.data && Date.now() - sitemapCache.at < SITEMAP_TTL_MS) {
    return sitemapCache.data
  }
  const data = await fetchJson(`${API_URL}/seo/sitemap`)
  sitemapCache = { at: Date.now(), data }
  return data
}

function putProfileCache(key, value) {
  if (profileCache.size >= MAX_PROFILE_CACHE) {
    const first = profileCache.keys().next().value
    if (first) profileCache.delete(first)
  }
  profileCache.set(key, { at: Date.now(), value })
}

async function getProfile(kind, slug) {
  const key = `${kind}:${slug}`
  const cached = profileCache.get(key)
  if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached.value
  const url = kind === 'clipper' ? `${API_URL}/clippers/${slug}` : `${API_URL}/orgs/${slug}`
  try {
    const data = await fetchJson(url)
    const value = { ok: true, profile: data.profile }
    putProfileCache(key, value)
    return value
  } catch (error) {
    const value = { ok: false, status: error.status || 502 }
    if (value.status === 404) putProfileCache(key, value)
    return value
  }
}

function clipperSeo(slug, profile) {
  const name = profile.display_name || 'Clipper'
  const description =
    profile.bio ||
    `${name} is a clipper on Clippster. View campaigns, clips delivered, and specialties.`
  const canonical = `${SITE_URL}/clippers/${slug}`
  const specialties = (profile.specialty_tags || []).join(', ')
  return {
    title: `${name} | Clipper on Clippster`,
    description: description.slice(0, 160),
    canonical,
    image: profile.avatar_url || DEFAULT_IMAGE,
    noscript: `<h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p><p>${profile.total_campaigns_completed || 0} campaigns, ${profile.total_clips_delivered || 0} clips delivered.${specialties ? ` Specialties: ${escapeHtml(specialties)}.` : ''}</p>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: canonical,
      name: `${name} | Clipper on Clippster`,
      mainEntity: {
        '@type': 'Person',
        name,
        description,
        image: profile.avatar_url || undefined,
        url: canonical,
      },
    },
  }
}

function orgSeo(slug, profile) {
  const name = profile.name || 'Organization'
  const description =
    profile.description || profile.bio || `${name} is a clipping organization on Clippster.`
  const canonical = `${SITE_URL}/orgs/${slug}`
  return {
    title: `${name} | Clipping organization on Clippster`,
    description: description.slice(0, 160),
    canonical,
    image: profile.logo_url || DEFAULT_IMAGE,
    noscript: `<h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: canonical,
      name: `${name} | Clipping organization on Clippster`,
      mainEntity: {
        '@type': 'Organization',
        name,
        description,
        image: profile.logo_url || undefined,
        url: canonical,
      },
    },
  }
}

function notFoundSeo(kind, slug) {
  const requestPath = kind === 'clipper' ? `/clippers/${slug}` : `/orgs/${slug}`
  return {
    title: 'Profile not found | Clippster',
    description: 'This Clippster profile is missing or private.',
    canonical: `${SITE_URL}${requestPath}`,
    robots: 'noindex, nofollow',
    noscript: '<h1>Profile not found</h1><p>This profile does not exist or is private.</p>',
  }
}

function staticPageSeo(pathname) {
  const page = pagesConfig.pages[pathname]
  if (!page) return null
  const jsonLd = [organizationJsonLd()]
  if ((page.schema || []).includes('SoftwareApplication') || pathname === '/') {
    jsonLd.push(softwareApplicationJsonLd())
  }
  if ((page.schema || []).includes('FAQ') && page.faqs?.length) {
    jsonLd.push(faqJsonLd(page.faqs))
  }
  return {
    title: page.title,
    description: page.description,
    canonical: `${SITE_URL}${pathname === '/' ? '/' : pathname}`,
    image: DEFAULT_IMAGE,
    noscript: `<h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.noscript)}</p>`,
    jsonLd,
  }
}

function privateSeo(pathname) {
  return {
    title: 'Clippster',
    description: 'Sign in to Clippster.',
    canonical: `${SITE_URL}${pathname}`,
    robots: 'noindex, nofollow',
  }
}

function unknownSeo(pathname) {
  return {
    title: 'Page not found | Clippster',
    description: 'This page does not exist on Clippster.',
    canonical: `${SITE_URL}${pathname}`,
    robots: 'noindex, nofollow',
    noscript: '<h1>Page not found</h1>',
  }
}

async function directoryNoscript(kind) {
  try {
    const data = await getSitemapData()
    const items = kind === 'clippers' ? data.clippers || [] : data.organizations || []
    const links = items
      .slice(0, 200)
      .map((item) => {
        if (kind === 'clippers') {
          return `<li><a href="${SITE_URL}/clippers/${escapeAttr(item.slug)}">${escapeHtml(item.display_name || item.slug)}</a></li>`
        }
        return `<li><a href="${SITE_URL}/orgs/${escapeAttr(item.slug)}">${escapeHtml(item.name || item.slug)}</a></li>`
      })
      .join('')
    return `<h1>${kind === 'clippers' ? 'Clipper directory' : 'Clipping organizations'}</h1><ul>${links}</ul>`
  } catch {
    return null
  }
}

export function buildSitemapXml(data) {
  const today = new Date().toISOString()
  const staticUrls = Object.entries(pagesConfig.pages).map(([route, page]) => ({
    loc: `${SITE_URL}${route === '/' ? '/' : route}`,
    lastmod: page.reviewedAt || today,
    changefreq: page.changefreq || 'weekly',
    priority: page.priority || '0.7',
  }))
  const clipperUrls = (data.clippers || []).map((item) => ({
    loc: `${SITE_URL}/clippers/${item.slug}`,
    lastmod: item.updated_at || today,
    changefreq: 'weekly',
    priority: '0.6',
  }))
  const orgUrls = (data.organizations || []).map((item) => ({
    loc: `${SITE_URL}/orgs/${item.slug}`,
    lastmod: item.updated_at || today,
    changefreq: 'weekly',
    priority: '0.6',
  }))

  const urls = [...staticUrls, ...clipperUrls, ...orgUrls]
    .map((url) => {
      const lastmod = url.lastmod ? new Date(url.lastmod).toISOString() : today
      return `  <url><loc>${escapeHtml(url.loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export async function renderSitemap() {
  try {
    return { xml: buildSitemapXml(await getSitemapData()), cacheControl: 'public, max-age=300' }
  } catch {
    return { xml: buildSitemapXml({ clippers: [], organizations: [] }), cacheControl: 'public, max-age=60' }
  }
}

function unavailableSeo(kind, slug) {
  return {
    ...notFoundSeo(kind, slug),
    title: 'Temporarily unavailable | Clippster',
    description: 'This profile could not be loaded right now.',
    robots: 'noindex, nofollow',
  }
}

async function renderProfile(kind, slug, indexHtml) {
  const result = await getProfile(kind, slug)
  if (!result.ok) {
    const status = result.status === 404 ? 404 : 503
    const seo = status === 404 ? notFoundSeo(kind, slug) : unavailableSeo(kind, slug)
    return { status, html: applySeo(indexHtml, seo) }
  }
  const seo = kind === 'clipper' ? clipperSeo(slug, result.profile) : orgSeo(slug, result.profile)
  return { status: 200, html: applySeo(indexHtml, seo) }
}

export async function renderPage(pathname, indexHtml) {
  if (isPrivatePath(pathname)) {
    return { status: 200, html: applySeo(indexHtml, privateSeo(pathname)) }
  }

  const clipperMatch = pathname.match(/^\/clippers\/([^/]+)$/)
  if (clipperMatch) return renderProfile('clipper', clipperMatch[1], indexHtml)

  const orgMatch = pathname.match(/^\/orgs\/([^/]+)$/)
  if (orgMatch) return renderProfile('org', orgMatch[1], indexHtml)

  const page = staticPageSeo(pathname)
  if (page) {
    if (pathname === '/clippers' || pathname === '/orgs') {
      const extra = await directoryNoscript(pathname === '/clippers' ? 'clippers' : 'orgs')
      if (extra) page.noscript = extra
    }
    return { status: 200, html: applySeo(indexHtml, page) }
  }

  return { status: 404, html: applySeo(indexHtml, unknownSeo(pathname)) }
}
