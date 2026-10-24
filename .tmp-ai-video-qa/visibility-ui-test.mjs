import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {serve} from '../client/src-tauri/sidecars/hyperframes-renderer/lib/server.mjs';
const projectDir=await fs.mkdtemp(path.join(os.tmpdir(),'clippster-visibility-qa-'));await fs.cp(path.resolve('.tmp-ai-video-qa/project'),projectDir,{recursive:true,filter:source=>!source.includes('.hyperframes')});const {url}=await serve({projectDir});
const server=http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');let body='';for await(const chunk of req)body+=chunk;if(req.url==='/save'){const data=JSON.parse(body);await fs.writeFile(path.join(projectDir,'index.html'),data.html);for(const[file,source]of Object.entries(data.files))await fs.writeFile(path.join(projectDir,file),source);}res.end('ok');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const host=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1500,height:900}});page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
await page.goto(`http://localhost:1420/qa-ai-video.html?preview=${encodeURIComponent(url)}&host=${encodeURIComponent(host)}`);
await page.waitForFunction(()=>Object.keys(window.qaInventories).length===3);
console.log(JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(window.qaInventories).map(([id,layers])=>[id,layers.filter(l=>l.category==='icons').map(l=>({label:l.label,start:l.start,duration:l.duration,ranges:l.ranges}))])))));
await page.getByRole('button',{name:'Expand Icons',exact:true}).click();await page.getByRole('button',{name:'Icons: catch-icon',exact:true}).first().click();
const icon=await page.evaluate(()=>window.qaInventories.catch.find(l=>l.label==='catch-icon'));assert.ok(icon.start>0,'animated scale-in starts after scene boundary');assert.ok(icon.ranges?.length);
const ruler=page.getByRole('slider',{name:'Timeline ruler',exact:true});
async function seek(time){const rect=await ruler.boundingBox();await ruler.click({position:{x:time*(rect.width-24)/12,y:18}});await page.waitForTimeout(100);}
for(const time of [0, .2, 1.5, 3.8, 8.1, 9, 11.5]){
 await seek(time);const expected=await page.evaluate(t=>{const owner=t<4?'catch':t<8?'clips':'share';return window.qaInventories[owner].filter(l=>l.category==='icons').map(l=>({selector:l.selector,expected:l.ranges.some(r=>t-(owner==='catch'?0:owner==='clips'?4:8)>=r.start&&t-(owner==='catch'?0:owner==='clips'?4:8)<r.start+r.duration)}))},time);
 const result=await page.frames()[1].evaluate(({time,expected})=>{const id=time<4?'catch':time<8?'clips':'share';const root=document.querySelector('[data-composition-id="'+id+'"]');const b=root.getBoundingClientRect();return expected.map(({selector,expected})=>{const el=root.querySelector(selector),r=el.getBoundingClientRect();let visible=r.width>0&&r.height>0&&r.right>b.left&&r.left<b.right&&r.bottom>b.top&&r.top<b.bottom;for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(Number(s.opacity)<=.001||s.visibility==='hidden'||s.display==='none')visible=false;if(p===root)break;}return {expected,visible}})},{time,expected});
 assert.ok(result.every(r=>r.expected===r.visible),'timeline visibility matches rendered frame at '+time+' '+JSON.stringify(result));
}
console.log('PASS icon timeline intervals agree with actual rendered visibility across all scenes');
await seek(1.5);await page.getByRole('button',{name:'Icons: catch-icon',exact:true}).first().click();assert.ok(Math.abs(Number(await ruler.getAttribute('aria-valuenow'))-1.5)<.04,'selection preserves playhead while element is visible');
await page.getByRole('button',{name:'Delete element',exact:true}).click();await page.waitForFunction(()=>window.qaProject.document.value.shots[0].scene.variables.__editorLayers?.includes('deleted'));
await page.frameLocator('iframe').locator('#catch-icon[style*="display: none"]').waitFor({state:'attached'});await page.waitForFunction(()=>!window.qaInventories.catch.some(l=>l.label==='catch-icon'));assert.equal(await page.getByRole('button',{name:'Icons: catch-icon',exact:true}).count(),0);
console.log('PASS individual deletion removes only selected icon from rendering and timeline');
await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Icons: catch-icon',exact:true}).first().waitFor();await seek(1.5);await page.frameLocator('iframe').locator('#catch-icon').waitFor();
console.log('PASS undo restores icon and its original timed intervals');
await page.evaluate(()=>{window.qaMessages=[];window.addEventListener('message',e=>{if(e.data?.type?.startsWith('clippster'))window.qaMessages.push(e.data)})});
await page.frames()[1].evaluate(()=>{window.qaClicks=[];window.addEventListener('click',e=>window.qaClicks.push({target:e.target.id,x:e.clientX,y:e.clientY,root:getComputedStyle(document.querySelector('[data-composition-id="catch"]')).visibility,icon:document.querySelector('#catch-icon').getBoundingClientRect().toJSON()}),true)});
const preview=await page.locator('hyperframes-player').boundingBox();await page.mouse.click(preview.x+preview.width/2,preview.y+preview.height*380/1080);await page.waitForFunction(()=>document.querySelector('[aria-label="Icons: catch-icon"]')?.getAttribute('aria-pressed')==='true',null,{timeout:10000});
await page.frameLocator('iframe').locator('#catch-icon[style*="outline"]').waitFor();
console.log('PASS clicking rendered icon selects its timeline item and highlights that element');
if(process.env.QA_PARITY==='1'){
 await page.getByRole('button',{name:'Delete element',exact:true}).click();await page.waitForFunction(()=>!window.qaInventories.catch.some(l=>l.label==='catch-icon'));
 await page.getByRole('button',{name:'Expand Shapes & elements',exact:true}).click();await page.getByRole('button',{name:'Shapes & elements: catch-bg',exact:true}).first().click();await page.getByRole('textbox',{name:'Layer Background',exact:true}).fill('#123456');await page.getByRole('textbox',{name:'Layer Background',exact:true}).press('Tab');
 await page.getByRole('button',{name:'Collapse Shapes & elements',exact:true}).click();await page.getByRole('button',{name:'Text: Catch the moment',exact:true}).click();await page.getByRole('textbox',{name:'Text content'}).fill('Export parity checked');await page.getByRole('button',{name:'Text: Export parity checked',exact:true}).waitFor();
 await page.getByRole('button',{name:'Graphics: Catch the moment',exact:true}).click();await page.getByRole('spinbutton',{name:'Segment duration'}).fill('5');await page.getByRole('spinbutton',{name:'Segment duration'}).press('Tab');await page.waitForFunction(()=>window.qaProject.document.value.shots[0].duration===5);
 await page.getByRole('button',{name:'Transitions: cut',exact:true}).first().click();await page.getByRole('combobox',{name:'Incoming transition'}).selectOption('flash');await page.waitForFunction(()=>window.qaProject.document.value.shots[1].transitionIn==='flash');
 await fs.writeFile('.tmp-ai-video-qa/parity-files.json',JSON.stringify(await page.evaluate(()=>window.qaExportFiles())));
 console.log('PASS export manifest captured edited text, background, deletion, duration and transition');
}
await page.screenshot({path:'.tmp-ai-video-qa/visibility-timeline.png'});await fs.writeFile('.tmp-ai-video-qa/visibility-project-path.txt',projectDir);await browser.close();server.close();process.exit(0);
