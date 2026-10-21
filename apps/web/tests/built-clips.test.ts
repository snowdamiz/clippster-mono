import { it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { startFixture, waitForJob } from './fixtures'
it('keeps historical builds playable and publishable, and deletes only the owned export', async () => {
  const fixture = await startFixture()
  try {
    const cookie = await fixture.login(), other = await fixture.login('second@example.com')
    const request = (path: string, method='GET', body?: unknown, session=cookie) => fetch(`${fixture.url}/api/web${path}`, { method, headers: { Cookie: session, Origin: fixture.config.origin, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    let workspace = await (await request('/projects','POST',{name:'Built library'})).json()
    const path = `/projects/${workspace.project.id}`
    await fetch(`${fixture.url}/api/web${path}/source`, { method:'PUT', headers:{Cookie:cookie,Origin:fixture.config.origin,'Content-Type':'application/octet-stream'},body:await readFile(fixture.source) })
    await waitForJob(fixture.url,cookie,workspace.project.id)
    workspace = await (await request(`${path}/clips`,'POST',{name:'Saved build',aspectRatio:'16:9',captions:false,segments:[{start_time:0,end_time:1}]})).json()
    const clipPath=`${path}/clips/${workspace.project.clips[0].id}`
    expect((await request(`${clipPath}/build`,'POST',{})).status).toBe(202)
    workspace=await waitForJob(fixture.url,cookie,workspace.project.id)
    const clip=workspace.project.clips[0], build=clip.builds[0]
    expect(build.duration).toBeCloseTo(1,1)
    await request(clipPath,'PUT',{...clip,name:'Edited after build'})
    expect((await request(`${clipPath}/playback?buildId=${build.id}`)).status).toBe(200)
    expect((await request(`${clipPath}/builds/${build.id}/thumbnail`)).status).toBe(200)
    expect((await request(`${clipPath}/publish`,'POST',{buildId:build.id,requestId:randomUUID(),accountId:10})).status).toBe(200)
    expect((await request(`${clipPath}/builds/${build.id}`,'DELETE',undefined,other)).status).toBe(404)
    expect((await request(`${clipPath}/builds/${build.id}`,'DELETE')).status).toBe(200)
    expect((await request(`${clipPath}/playback?buildId=${build.id}`)).status).toBe(404)
    expect((await request(`${path}/source`)).status).toBe(200)
    const saved=await (await request(path)).json()
    expect(saved.project.clips[0].name).toBe('Edited after build')
    expect(saved.project.clips[0].builds).toHaveLength(0)
  } finally { await fixture.dispose() }
},60000)
