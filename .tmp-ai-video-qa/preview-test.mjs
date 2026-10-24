import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../client/src-tauri/sidecars/hyperframes-renderer/lib/server.mjs';

const root = path.resolve('.tmp-ai-video-qa');
const { url } = await serve({ projectDir: path.join(root, 'project') });
const server = http.createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<script type="module" src="/hyperframes-player.js"></script><hyperframes-player sandbox-origin="opaque" assets-loading-ui="none" style="display:block;width:960px;height:540px" src="${url}"></hyperframes-player>`);
  } else {
    const file = path.basename(req.url);
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(path.resolve('client/node_modules/@hyperframes/player/dist', file))); }
    catch { res.writeHead(404); res.end(); }
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('console', m => console.log('console', m.type(), m.text().slice(0, 500)));
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => document.querySelector('hyperframes-player')?.duration === 12);
await page.evaluate(() => document.querySelector('hyperframes-player').setAttribute('range-end','12'));
for (const time of [2, 6, 10]) {
  await page.evaluate(t => document.querySelector('hyperframes-player').seek(t), time);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(root, `preview-${time}.png`) });
  for (const frame of page.frames().slice(1)) console.log(JSON.stringify(await frame.evaluate(() => ({ time: window.__player?.currentTime, timelines: Object.entries(window.__timelines ?? {}).map(([id,tl])=>({id,time:tl.time(),duration:tl.duration()})), clips: [...document.querySelectorAll('.frame,.clip')].map(e => ({id:e.id,children:e.children.length,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity,text:e.innerText.slice(0,80),rect:e.getBoundingClientRect().toJSON()})) }))));
}
const frame=page.frames()[1];
assert.ok(await frame.evaluate(()=>!!window.__timelines.main),'root timeline registered');
await page.evaluate(()=>{const p=document.querySelector('hyperframes-player');p.addEventListener('ended',()=>window.playbackEnded=true);p.seek(0);p.play();});
for(const [time,id] of [[2,'catch'],[6,'clips'],[10,'share']]) {
 await page.waitForFunction(t=>document.querySelector('hyperframes-player').currentTime>=t,time);
 assert.ok(await frame.evaluate(id=>Number(getComputedStyle(document.querySelector(`#shot-${id}-frame`)).opacity)>0.9,id),`scene ${id} visible during playback`);
 console.log(`PASS natural playback scene ${id}`);
}
await page.waitForFunction(()=>window.playbackEnded===true);
console.log('END visibility',await frame.evaluate(()=>({visibility:getComputedStyle(document.querySelector('#shot-share')).visibility,opacity:getComputedStyle(document.querySelector('#shot-share-frame')).opacity})));
console.log('END',await page.evaluate(()=>document.querySelector('hyperframes-player').currentTime));
await page.screenshot({path:path.join(root,'preview-ended.png')});
await browser.close();
server.close();
process.exit(0);
