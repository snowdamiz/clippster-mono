import { Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { CTA } from '@/components/CTA'
import { getPage, relatedPages } from '@/seo/content'
import type { ContentSection } from '@/seo/contentSections'
import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  EDITORIAL_AUTHOR,
  faqJsonLd,
  organizationJsonLd,
  personJsonLd,
  softwareApplicationJsonLd,
} from '@/seo/catalog'
import { SeoHead } from '@/seo/SeoHead'

export type { ContentSection }

type Props = {
  path: string
  sections: ContentSection[]
  showCta?: boolean
}

export function SeoMarketingPage({ path, sections, showCta = true }: Props) {
  const page = getPage(path)
  if (!page) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        Missing SEO page for {path}
      </div>
    )
  }

  const related = relatedPages(path).filter((r) => r.path !== path)
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(page.parent ? [{ name: getPage(page.parent)?.title.split('|')[0].trim() || 'Parent', path: page.parent }] : []),
    { name: page.title.split('|')[0].trim(), path },
  ]

  const jsonLd: unknown[] = [organizationJsonLd(), breadcrumbJsonLd(crumbs)]
  if (page.schema.includes('SoftwareApplication')) jsonLd.push(softwareApplicationJsonLd())
  if (page.schema.includes('FAQ') && page.faqs?.length) jsonLd.push(faqJsonLd(page.faqs))
  if (page.schema.includes('Person')) {
    jsonLd.push(
      personJsonLd({
        name: EDITORIAL_AUTHOR.name,
        description: EDITORIAL_AUTHOR.description,
        path: EDITORIAL_AUTHOR.path,
      }),
    )
  }
  if (page.type === 'guide' || page.type === 'authority') {
    if (!page.schema.includes('Person')) {
      jsonLd.push(
        articleJsonLd({
          title: page.title,
          description: page.description,
          path,
          dateModified: page.reviewedAt,
        }),
      )
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <SeoHead
        title={page.title}
        description={page.description}
        canonical={absoluteUrl(path)}
        jsonLd={jsonLd}
      />
      <Header />
      <main className="pt-28 sm:pt-32 pb-16">
        <article className="max-w-4xl mx-auto px-6">
          <nav className="text-xs text-zinc-500 mb-6 flex flex-wrap gap-2">
            {crumbs.map((crumb, i) => (
              <span key={crumb.path} className="inline-flex items-center gap-2">
                {i > 0 && <span>/</span>}
                {i === crumbs.length - 1 ? (
                  <span className="text-zinc-400">{crumb.name}</span>
                ) : (
                  <Link to={crumb.path} className="hover:text-cyan-400">
                    {crumb.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <p className="text-sm font-medium text-cyan-400 mb-3 capitalize">{page.type}</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em] text-white mb-6 leading-[1.1]">
            {page.title.split('|')[0].trim()}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed mb-10">{page.description}</p>

          <div className="space-y-10 text-zinc-400 leading-relaxed">
            {sections.map((section, index) => {
              if (section.type === 'heading') {
                return (
                  <h2 key={index} className="text-2xl sm:text-3xl font-bold text-white">
                    {section.text}
                  </h2>
                )
              }
              if (section.type === 'paragraph') {
                return <p key={index}>{section.text}</p>
              }
              if (section.type === 'bullets') {
                return (
                  <ul key={index} className="space-y-2 list-disc pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )
              }
              if (section.type === 'steps') {
                return (
                  <ol key={index} className="space-y-4">
                    {section.items.map((step, i) => (
                      <li key={step.title}>
                        <strong className="text-white">
                          {i + 1}. {step.title}.
                        </strong>{' '}
                        {step.body}
                      </li>
                    ))}
                  </ol>
                )
              }
              if (section.type === 'table') {
                return (
                  <div key={index} className="overflow-x-auto rounded-xl border border-[#1f1f23]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#141416] text-left text-zinc-300">
                          {section.headers.map((h) => (
                            <th key={h} className="px-4 py-3 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => (
                          <tr key={row.join('-')} className="border-t border-[#1f1f23]">
                            {row.map((cell) => (
                              <td key={cell} className="px-4 py-3">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
              return (
                <dl key={index} className="space-y-6">
                  {section.items.map((faq) => (
                    <div key={faq.q}>
                      <dt className="text-white font-medium mb-2">{faq.q}</dt>
                      <dd>{faq.a}</dd>
                    </div>
                  ))}
                </dl>
              )
            })}

            {page.faqs && page.faqs.length > 0 && !sections.some((s) => s.type === 'faq') && (
              <section>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">FAQ</h2>
                <dl className="space-y-6">
                  {page.faqs.map((faq) => (
                    <div key={faq.q}>
                      <dt className="text-white font-medium mb-2">{faq.q}</dt>
                      <dd>{faq.a}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-bold text-white mb-4">Related</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {related.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="p-4 rounded-xl border border-[#1f1f23] bg-[#141416] hover:border-white/15 transition-colors"
                  >
                    <div className="text-white font-medium mb-1">{item.title.split('|')[0].trim()}</div>
                    <div className="text-sm text-zinc-500 line-clamp-2">{item.description}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {page.reviewedAt && (
            <p className="mt-10 text-xs text-zinc-600">Last reviewed {page.reviewedAt}</p>
          )}
        </article>
        {showCta && <CTA />}
      </main>
      <Footer />
    </div>
  )
}
