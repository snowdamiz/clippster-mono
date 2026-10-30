import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:600}});
await page.goto('http://localhost:1420/qa-ai-video.html');
await page.getByText('Third',{exact:true}).waitFor();
for(const size of [900,500,1100]) {
 await page.locator('#app').evaluate((el,width)=>el.style.width=`${width}px`,size);
 await page.waitForTimeout(150);
 const viewport=page.locator('#app .overflow-x-auto');
 const full=await viewport.boundingBox();
 const inner=await viewport.locator(':scope > div').boundingBox();
 assert.ok(Math.abs(full.width-inner.width)<1,`timeline should fill viewport at ${size}`);
 const ruler=viewport.locator(':scope > div > div').first();
 await ruler.click({position:{x:inner.width/2,y:10}});
 assert.ok(Math.abs(await page.evaluate(()=>window.lastSeek)-6)<0.05,'seeking uses fitted scale');
 console.log(`PASS fitted width ${size}, midpoint seeks 6s`);
}
await page.screenshot({path:'.tmp-ai-video-qa/timeline-fixed.png'});
await browser.close();
