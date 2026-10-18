import { test, expect } from './browser-fixture'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
test('built clips library supports folders, filters, playback, download, publish and deletion',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  const headers={Origin:'http://127.0.0.1:8091'}
  await page.request.post('/api/auth/email/login',{headers,data:{email:'test@example.com',password:'test-password'}})
  const {project}=await (await page.request.post('/api/web/projects',{headers,data:{name:'Built library fixture'}})).json()
  const source=testInfo.outputPath('source.mp4')
  execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-y',source])
  const path='/api/web/projects/'+project.id
  await page.request.put(path+'/source',{headers:{...headers,'Content-Type':'application/octet-stream'},data:readFileSync(source)})
  await expect.poll(async()=>(await(await page.request.get(path)).json()).project.status).toBe('ready')
  const saved=await(await page.request.post(path+'/clips',{headers,data:{name:'Library highlight',aspectRatio:'16:9',captions:false,segments:[{start_time:0,end_time:1}]}})).json()
  await page.request.post(path+'/clips/'+saved.project.clips[0].id+'/build',{headers,data:{}})
  await expect.poll(async()=>(await(await page.request.get(path)).json()).project.clips[0].builds?.length,{timeout:60000}).toBe(1)
  await page.goto('/?view=built')
  await expect(page.locator('.clips__title')).toHaveText('Built Clips')
  await page.getByRole('button',{name:/Built library fixture/}).click()
  const card=page.locator('[data-build-id]').filter({hasText:'Library highlight'})
  await expect(card).toBeVisible()
  await card.hover();await card.getByTitle('Play',{exact:true}).click()
  await expect(page.locator('video')).toHaveJSProperty('readyState',4)
  await page.getByTitle('Close',{exact:true}).click()
  await card.hover();await card.getByRole('button',{name:'More actions',exact:true}).click()
  const downloading=page.waitForEvent('download');await page.getByRole('menuitem',{name:'Save to…',exact:true}).click();expect((await downloading).suggestedFilename()).toContain('Library highlight')
  await card.getByTitle('Publish',{exact:true}).click();await expect(page.getByRole('dialog',{name:'Publish Library highlight'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.getByPlaceholder('Search clips...').fill('no matching clip');await expect(page.getByText('No matching clips',{exact:true})).toBeVisible();await page.getByPlaceholder('Search clips...').fill('')
  await page.screenshot({path:testInfo.outputPath('built-clips.png')})
  await card.hover();await card.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Open in project',exact:true}).click();await expect(page.getByRole('region',{name:'Project workspace'})).toBeVisible()
  await page.goto('/?view=built');await page.getByTitle('List View',{exact:true}).click()
  await card.hover();await card.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Delete build',exact:true}).click();await page.getByRole('button',{name:'Delete Build',exact:true}).click();await expect(card).toHaveCount(0)
  expect(errors).toEqual([])
})
