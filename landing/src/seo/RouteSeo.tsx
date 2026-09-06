import { useLocation } from 'react-router-dom'
import { SeoHead } from './SeoHead'
import {
  DEFAULT_OG_IMAGE,
  EDITORIAL_AUTHOR,
  SITE_NAME,
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  getStaticPageSeo,
  isPrivatePath,
  organizationJsonLd,
  personJsonLd,
  softwareApplicationJsonLd,
} from './catalog'

export function RouteSeo() {
  const { pathname } = useLocation()
  const page = getStaticPageSeo(pathname)

  if (page) {
    const jsonLd: unknown[] = [organizationJsonLd()]
    if (page.schema?.includes('SoftwareApplication') || page.path === '/') {
      jsonLd.push(softwareApplicationJsonLd())
    }
    if (page.schema?.includes('FAQ') && page.faqs?.length) {
      jsonLd.push(faqJsonLd(page.faqs))
    }
    if (page.schema?.includes('Person')) {
      jsonLd.push(
        personJsonLd({
          name: EDITORIAL_AUTHOR.name,
          description: EDITORIAL_AUTHOR.description,
          path: EDITORIAL_AUTHOR.path,
        }),
      )
    }
    if ((page.type === 'guide' || page.type === 'authority') && !page.schema?.includes('Person')) {
      jsonLd.push(
        articleJsonLd({
          title: page.title,
          description: page.description,
          path: page.path,
          dateModified: page.reviewedAt,
        }),
      )
      jsonLd.push(
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: page.title.split('|')[0].trim(), path: page.path },
        ]),
      )
    }
    return (
      <SeoHead
        title={page.title}
        description={page.description}
        canonical={page.canonical}
        image={page.image}
        jsonLd={jsonLd}
      />
    )
  }

  if (isPrivatePath(pathname)) {
    return (
      <SeoHead
        title={`${SITE_NAME}`}
        description="Sign in to Clippster."
        robots="noindex, nofollow"
        canonical={absoluteUrl(pathname)}
        image={DEFAULT_OG_IMAGE}
      />
    )
  }

  return null
}
