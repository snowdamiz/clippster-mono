import { Router } from 'express'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Store } from './store'
import type { Config } from './config'
import { directoryBytes, projectDirectory } from './storage'
const format=(bytes:number)=>bytes>=1024**3?`${(bytes/1024**3).toFixed(2)} GB`:`${(bytes/1024**2).toFixed(2)} MB`
export function settingsStorageRoutes(store:Store,config:Config){
  const router=Router()
  router.get('/storage',async(_req,res)=>{
    let bytes=0
    for(const project of store.list(res.locals.session.owner)){
      const directory=projectDirectory(config,project.id),keep=new Set(project.clips.flatMap(clip=>[...(clip.builds || []).flatMap(build=>[`${build.id}.mp4`,`${build.id}.mov`,`${build.id}-thumbnail.jpg`]),...(clip.builtRevision!==null?[`${clip.id}.mp4`]:[])]))
      for(const entry of await readdir(directory,{withFileTypes:true}).catch(()=>[])){if(keep.has(entry.name))continue;const path=join(directory,entry.name);bytes+=entry.isDirectory()?await directoryBytes(path):(await stat(path).catch(()=>({size:0}))).size}
    }
    res.json({total_bytes:bytes,total_formatted:format(bytes),breakdown:[{name:'Downloaded sources and temporary media',bytes,formatted:format(bytes)}]})
  })
  return router
}
