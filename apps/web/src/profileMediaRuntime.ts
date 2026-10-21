import type { Clip, ClipBuild } from '@/services/database/types'
import type { WebProject } from '@clippster/shared-types'
import { workspaceClient, sourcePath, downloadPath, webApiPath } from './api'
export async function getAllClipsWithBuilds():Promise<Array<Clip & {builds:ClipBuild[]}>> {
  const {projects}=await workspaceClient.get<{projects:WebProject[]}>('/web/projects')
  return projects.flatMap(project=>project.clips.filter(clip=>clip.builds?.length).map(clip=>{
    const builds=clip.builds!.map((build,index)=>({id:build.id,clip_id:clip.id,file_path:`${downloadPath(project.id,clip.id)}?buildId=${build.id}`,thumbnail_path:`${webApiPath}/projects/${project.id}/clips/${clip.id}/builds/${build.id}/thumbnail`,status:'completed',duration:build.duration,completed_at:build.completedAt/1000,build_number:index+1,aspect_ratios:JSON.stringify([build.aspectRatio])}))
    return {id:clip.id,project_id:project.id,project_name:project.name,name:clip.name,file_path:sourcePath(project.id),duration:clip.segments.reduce((sum,part)=>sum+part.end_time-part.start_time,0),built_file_path:builds.at(-1)!.file_path,built_thumbnail_path:builds.at(-1)!.thumbnail_path,build_status:'completed',builds,created_at:project.createdAt/1000,updated_at:project.updatedAt/1000} as unknown as Clip & {builds:ClipBuild[]}
  }))
}
export async function getRawVideosByProjectId(id:string){return [{thumbnail_path:sourcePath(id).replace(/\/source$/,'/thumbnail')}]}
export async function getStoragePath(_type:string):Promise<string>{throw new Error('Web builds provide their own thumbnail URLs.')}
export async function invoke<T>(command:string,args:Record<string,any>):Promise<T>{
  const url=new URL(args.filePath || args.path,location.origin)
  if(url.origin!==location.origin||!/^\/(?:workspace\/)?api\/web\/projects\/[\da-f-]{36}\//i.test(url.pathname))throw new Error('Choose a file from your web library.')
  if(command==='check_file_exists')return (await fetch(url,{method:'HEAD',credentials:'same-origin'})).ok as T
  if(command!=='read_file_as_data_url')throw new Error('Unsupported profile media operation.')
  const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error('Unable to read this saved build.')
  const blob=await response.blob();return await new Promise<T>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as T);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
}
