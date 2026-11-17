import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CreatorSkillClaimEvidence, CreatorSkillPackage } from '@clippster/shared-types'
import { openAsset } from './network'
import { creatorSkillSourceTargets } from '../../../client/src/services/creatorSkillSourceTargets'
import { pageLinksProposedLogo } from '../../../client/src/services/creatorSkillPageLogo'
import { creatorSkillClaimEvidence } from '../../../client/src/services/creatorSkillClaimEvidence'
import { creatorSkillCaptureDateIssues, creatorSkillPagePublishedDate } from '../../../client/src/services/creatorSkillPageDate'

const MAX_CAPTURE_BYTES = 1024 * 1024
const MAX_PAGES = 12
const CONCURRENT_PAGES = 3

export interface CreatorSkillSourceCapture {
  index: number
  url: string
  title: string
  kind: 'source' | 'brand'
  fetchedAt: string
  linkedLogoUrl?: string
  screenshotAvailable?: boolean
  pagePublishedAt?: string
}

/** A readable review copy; this conversion never makes a claim verified. */
export function publicPageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|article|section|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity.toLowerCase()] ?? entity)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function creatorSkillCaptureText(kind: 'source' | 'brand', title: string, url: string, fetchedAt: string, body: string, pagePublishedAt?: string): string {
  return [`Kind: ${kind}`, `Proposed title: ${title.replace(/\r?\n/g, ' ').trim()}`, `Requested URL: ${url}`, `Captured at: ${fetchedAt}`, `Page-advertised publication date: ${pagePublishedAt || 'not found'}`, 'Claim support and asset rights require human review.', '', body].join('\n')
}

async function capturePage(target: { url: string; title: string; kind: 'source' | 'brand'; fetchedAt: string; logoUrl?: string }, destination: string, signal: AbortSignal): Promise<{ linkedLogoUrl?: string; html: string; captureText: string; pagePublishedAt?: string }> {
  const { url } = target
  const response = await openAsset(url, signal)
  const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
  if (!/^(text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/.test(contentType)) {
    response.destroy()
    throw new Error('The source did not return a readable page.')
  }
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of response) {
    signal.throwIfAborted()
    bytes += chunk.length
    if (bytes > MAX_CAPTURE_BYTES) { response.destroy(); throw new Error('The source page is too large.') }
    chunks.push(chunk)
  }
  const html = Buffer.concat(chunks).toString('utf8')
  const text = publicPageText(html)
  if (!text) throw new Error('The source page contains no readable text.')
  const pagePublishedAt = creatorSkillPagePublishedDate(html)
  const captureText = creatorSkillCaptureText(target.kind, target.title, url, target.fetchedAt, text, pagePublishedAt)
  await writeFile(destination, captureText, { flag: 'w', mode: 0o600 })
  return { linkedLogoUrl: pageLinksProposedLogo(html, url, target.logoUrl) ? target.logoUrl : undefined, html, captureText, pagePublishedAt }
}

/** Save bounded public page text for a human to inspect beside the proposed citations. */
export async function captureCreatorSkillSources(item: CreatorSkillPackage, work: string, signal: AbortSignal, screenshot?: (html: string, destination: string, highlightText: string | undefined, sourceUrl: string, capturedAt: string) => Promise<{ highlighted: boolean }>): Promise<{ captures: CreatorSkillSourceCapture[]; claimEvidence: CreatorSkillClaimEvidence[]; reviewItems: string[] }> {
  const { targets, omitted } = creatorSkillSourceTargets(item, MAX_PAGES)
  const folder = join(work, 'source-captures')
  await mkdir(folder, { recursive: true })
  const captures: CreatorSkillSourceCapture[] = []
  const claimEvidence: CreatorSkillClaimEvidence[] = []
  const reviewItems: string[] = []
  for (let offset = 0; offset < targets.length; offset += CONCURRENT_PAGES) {
    const batch = await Promise.all(targets.slice(offset, offset + CONCURRENT_PAGES).map(async ({ index, url, title, kind, logoUrl }) => {
      try {
        const fetchedAt = new Date().toISOString()
        const page = await capturePage({ url, title, kind, logoUrl, fetchedAt }, join(folder, `${index}.txt`), AbortSignal.any([signal, AbortSignal.timeout(20_000)]))
        const evidence = creatorSkillClaimEvidence(item, [{ index, url, text: page.captureText }])
        let screenshotAvailable = false
        let screenshotHighlighted = false
        if (screenshot) {
          try {
            const result = await screenshot(Buffer.from(page.html).subarray(0, 255 * 1024).toString('utf8'), join(folder, `${index}.png`), evidence[0]?.excerpt, url, fetchedAt)
            screenshotAvailable = true
            screenshotHighlighted = result.highlighted
          } catch (error) {
            if (signal.aborted) throw error
          }
        }
        return { capture: { index, url, title, kind, fetchedAt, ...(page.linkedLogoUrl && { linkedLogoUrl: page.linkedLogoUrl }), ...(page.pagePublishedAt && { pagePublishedAt: page.pagePublishedAt }), screenshotAvailable }, evidence,
          reviewItems: [
            ...creatorSkillCaptureDateIssues(item, url, page.pagePublishedAt),
            ...(!screenshotAvailable && screenshot ? [`Could not render a static screenshot of ${url}; use the saved text capture and inspect the live page.`] : []),
            ...(evidence.length && screenshotAvailable && !screenshotHighlighted ? [`Could not highlight the candidate claim passage in the static screenshot of ${url}; inspect the saved text and live page.`] : []),
          ] }
      } catch (error) {
        if (signal.aborted) throw error
        return { reviewItems: [`Could not capture ${kind} page ${url}; open it directly before using its claims or assets.`] }
      }
    }))
    for (const result of batch) {
      if ('capture' in result && result.capture) captures.push(result.capture)
      if ('evidence' in result && result.evidence) claimEvidence.push(...result.evidence)
      reviewItems.push(...result.reviewItems)
    }
  }
  if (omitted) reviewItems.push(`${omitted} proposed source pages exceeded the automatic capture limit; inspect them directly.`)
  return { captures, claimEvidence, reviewItems }
}
