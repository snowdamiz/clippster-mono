import { useEffect } from 'react'

export type SeoHeadProps = {
  title: string
  description: string
  canonical?: string
  image?: string
  robots?: string
  jsonLd?: unknown | unknown[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(data: unknown | unknown[] | undefined) {
  const existing = document.head.querySelectorAll('script[data-seo-jsonld="true"]')
  existing.forEach((node) => node.remove())
  if (!data) return
  const blocks = Array.isArray(data) ? data : [data]
  for (const block of blocks) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.seoJsonld = 'true'
    script.text = JSON.stringify(block)
    document.head.appendChild(script)
  }
}

export function SeoHead({ title, description, canonical, image, robots, jsonLd }: SeoHeadProps) {
  const jsonLdKey = JSON.stringify(jsonLd ?? null)

  useEffect(() => {
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', robots || 'index, follow')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', 'Clippster')
    if (canonical) {
      upsertMeta('property', 'og:url', canonical)
      upsertLink('canonical', canonical)
    }
    if (image) {
      upsertMeta('property', 'og:image', image)
      upsertMeta('name', 'twitter:image', image)
    }
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertJsonLd(jsonLdKey ? JSON.parse(jsonLdKey) : undefined)
  }, [title, description, canonical, image, robots, jsonLdKey])

  return null
}
