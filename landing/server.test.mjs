import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applySeo, escapeAttr, normalizePath } from './server.mjs'
import pagesConfig from './src/seo/pages.json' with { type: 'json' }

const shell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Old description" />
    <meta property="og:title" content="Old title" />
    <title>Old title</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

test('normalizePath strips trailing slashes', () => {
  assert.equal(normalizePath('/clipping-tool/'), '/clipping-tool')
  assert.equal(normalizePath('/'), '/')
})

test('applySeo rewrites title, description, canonical, and noscript', () => {
  const html = applySeo(shell, {
    title: 'AI Clipping Tool | Clippster',
    description: 'Desktop clipping tool for Twitch and Kick.',
    canonical: 'https://clippster.app/clipping-tool',
    image: 'https://clippster.app/og-image.png',
    noscript: '<h1>AI clipping tool</h1>',
    jsonLd: { '@type': 'SoftwareApplication', name: 'Clippster' },
  })

  assert.match(html, /<title>AI Clipping Tool \| Clippster<\/title>/)
  assert.match(html, /content="Desktop clipping tool for Twitch and Kick."/)
  assert.match(html, /rel="canonical" href="https:\/\/clippster.app\/clipping-tool"/)
  assert.match(html, /<script type="application\/ld\+json">/)
  assert.match(html, /<noscript><article><h1>AI clipping tool<\/h1><\/article><\/noscript>/)
  assert.doesNotMatch(html, /Old title/)
})

test('escapeAttr encodes quotes', () => {
  assert.equal(escapeAttr('Clip "Studio"'), 'Clip &quot;Studio&quot;')
})

test('pages registry has unique primary keywords and required parents', () => {
  const keywords = new Map()
  for (const [path, page] of Object.entries(pagesConfig.pages)) {
    assert.ok(page.title, `${path} missing title`)
    assert.ok(page.description, `${path} missing description`)
    assert.ok(page.primaryKeyword, `${path} missing primaryKeyword`)
    assert.ok((page.title?.length ?? 0) >= 10, `${path} title too short`)
    assert.ok((page.title?.length ?? 0) <= 70, `${path} title too long`)
    assert.ok((page.description?.length ?? 0) <= 165, `${path} description too long`)
    const key = page.primaryKeyword.toLowerCase()
    assert.equal(
      keywords.has(key),
      false,
      `duplicate keyword ${page.primaryKeyword} on ${path} and ${keywords.get(key)}`,
    )
    keywords.set(key, path)
    if (page.type === 'guide' || page.type === 'platform') {
      assert.ok(page.parent, `${path} missing parent`)
      assert.ok(pagesConfig.pages[page.parent], `${path} parent missing: ${page.parent}`)
    }
  }
  assert.ok(Object.keys(pagesConfig.pages).length >= 35, 'expected a broad page catalog')
})

test('redirect targets exist in the page catalog', () => {
  for (const [from, to] of Object.entries(pagesConfig.redirects || {})) {
    assert.ok(pagesConfig.pages[to], `${from} redirects to missing ${to}`)
  }
})

test('content pages have PAGE_BODIES entries', () => {
  const bodiesSrc = readFileSync(new URL('./src/seo/pageBodies.ts', import.meta.url), 'utf8')
  const skip = new Set(['/', '/pricing', '/privacy', '/terms', '/clippers', '/orgs'])
  for (const path of Object.keys(pagesConfig.pages)) {
    if (skip.has(path)) continue
    assert.match(bodiesSrc, new RegExp(`['"]${path.replace(/\//g, '\\/')}['"]\\s*:`), `${path} missing from PAGE_BODIES`)
  }
})

test('productFacts keep honest caption language count', () => {
  const facts = readFileSync(new URL('./src/seo/productFacts.ts', import.meta.url), 'utf8')
  assert.match(facts, /CAPTION_LANGUAGES_VERIFIED\s*=\s*9/)
  assert.doesNotMatch(facts, /CAPTION_LANGUAGES_VERIFIED\s*=\s*40/)
})

test('sitemap includes registry URLs', async () => {
  const { buildSitemapXml } = await import('./server.mjs')
  const xml = buildSitemapXml({ clippers: [], organizations: [] })
  assert.match(xml, /https:\/\/clippster\.app\/clipping-tool/)
  assert.match(xml, /https:\/\/clippster\.app\/platforms\/twitch/)
  assert.match(xml, /https:\/\/clippster\.app\/vs\/opus-clip/)
  assert.match(xml, /https:\/\/clippster\.app\/guides\/how-to-clip-twitch-streams/)
  assert.match(xml, /https:\/\/clippster\.app\/methodology/)
  assert.match(xml, /https:\/\/clippster\.app\/authors\/clippster-editorial/)
  assert.match(xml, /https:\/\/clippster\.app\/case-studies\/live-clipping-vs-vod-queue/)
})

test('unknown routes render 404 noindex HTML', async () => {
  const { renderApp } = await import('./server.mjs')
  const result = await renderApp('/this-page-does-not-exist-seo')
  assert.equal(result.status, 404)
  assert.match(result.html, /noindex/)
})

test('pillar pages inject registry titles into HTML', async () => {
  const { renderApp } = await import('./server.mjs')
  const result = await renderApp('/clipping-tool')
  assert.equal(result.status, 200)
  assert.match(result.html, /AI Clipping Tool for Streamers/)
  assert.match(result.html, /rel="canonical" href="https:\/\/clippster\.app\/clipping-tool"/)
})
