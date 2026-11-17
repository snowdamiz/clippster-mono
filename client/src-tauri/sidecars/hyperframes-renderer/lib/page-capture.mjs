import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import puppeteer from 'puppeteer-core';
import { runCli } from './cli.mjs';

/** Render the HTML bytes already fetched by the app. The browser cannot load page subresources. */
export async function capturePageScreenshot({ html, destination, highlightText, sourceUrl, capturedAt }, { signal } = {}) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > 256 * 1024 || typeof destination !== 'string') throw new Error('Invalid source page screenshot input');
  signal?.throwIfAborted();
  const located = await runCli(['browser', 'path'], { signal });
  if (located.code !== 0) throw new Error('The local rendering browser is unavailable');
  const executablePath = located.stdout.trim().split(/\r?\n/).pop();
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const onAbort = () => { void browser.close(); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', request => { void request.abort(); });
    const staticHtml = html
      .replace(/<(script|iframe|object|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<(?:embed|base|link)\b[^>]*>/gi, ' ')
      .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, ' ');
    await page.setContent(staticHtml, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}body{min-height:900px!important}' });
    const highlightRects = typeof highlightText === 'string' && highlightText.trim()
      ? await page.evaluate(excerpt => {
          const normalize = value => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
          const needle = normalize(excerpt).slice(0, 120);
          const element = [...document.querySelectorAll('p,li,blockquote,h1,h2,h3')].find(node => normalize(node.textContent || '').includes(needle));
          if (!element) return 0;
          element.scrollIntoView({ block: 'center' });
          const positions = [];
          let searchable = '';
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            for (let offset = 0; offset < node.textContent.length && searchable.length < 20_000; offset++) {
              const character = node.textContent[offset];
              if (/\s/.test(character)) {
                if (!searchable || searchable.endsWith(' ')) continue;
                searchable += ' ';
              } else searchable += character.toLocaleLowerCase();
              positions.push({ node, offset });
            }
          }
          const start = searchable.indexOf(needle);
          if (start < 0) return 0;
          const range = document.createRange();
          range.setStart(positions[start].node, positions[start].offset);
          const end = positions[start + needle.length - 1];
          range.setEnd(end.node, end.offset + 1);
          const lines = [];
          for (const rect of range.getClientRects()) {
            if (rect.width < 3 || rect.height < 6 || rect.height > 100 || rect.bottom < 0 || rect.top > innerHeight) continue;
            const line = lines.find(item => Math.abs(item.top - rect.top) < 3);
            if (line) {
              line.left = Math.min(line.left, rect.left);
              line.right = Math.max(line.right, rect.right);
              line.bottom = Math.max(line.bottom, rect.bottom);
            } else lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
          }
          for (const line of lines.slice(0, 32)) {
            const mark = document.createElement('div');
            Object.assign(mark.style, {
              position: 'fixed', pointerEvents: 'none', zIndex: '2147483647',
              left: `${line.left}px`, top: `${line.top}px`, width: `${line.right - line.left}px`, height: `${line.bottom - line.top}px`,
              background: 'rgba(250,204,21,.28)', boxShadow: 'inset 0 -3px 0 #facc15',
            });
            document.body.appendChild(mark);
          }
          return Math.min(lines.length, 32);
        }, highlightText)
      : 0;
    const sourceHost = typeof sourceUrl === 'string' ? (() => { try { return new URL(sourceUrl).hostname; } catch { return 'source unknown'; } })() : 'source unknown';
    const sourceLabel = `Source: ${sourceHost} · Captured ${typeof capturedAt === 'string' ? capturedAt.slice(0, 10) : 'date unknown'} UTC · Static copy`;
    await page.evaluate(label => {
      const badge = document.createElement('div');
      badge.textContent = label;
      Object.assign(badge.style, {
        position: 'fixed', left: '12px', bottom: '12px', zIndex: '2147483647',
        maxWidth: 'calc(100vw - 24px)', padding: '8px 12px', boxSizing: 'border-box',
        background: 'rgba(5,9,17,.94)', color: '#fff', font: 'bold 16px Arial,sans-serif',
      });
      document.body.appendChild(badge);
    }, sourceLabel);
    signal?.throwIfAborted();
    await mkdir(dirname(destination), { recursive: true });
    await page.screenshot({ path: destination, type: 'png', fullPage: false, captureBeyondViewport: false });
    return { width: 1280, height: 900, highlighted: highlightRects > 0, highlightRects, sourceLabel };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await browser.close();
  }
}
