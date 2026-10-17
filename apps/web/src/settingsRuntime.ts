import { workspaceClient } from './api'
const handlers=new Set<(event:{payload:{operation:string;percentage:number}})=>void>()
export function useAppTour(){return {restartTour:async(_id:string)=>{throw new Error('Desktop tours require Clippster Desktop.')}}}
export async function listen<T>(_name:string,handler:(event:{payload:T})=>void){handlers.add(handler as any);return()=>handlers.delete(handler as any)}
export async function invoke<T>(command:string):Promise<T>{
  if(command==='calculate_local_storage_size')return workspaceClient.get('/web/storage') as Promise<T>
  throw new Error('Source-media cleanup is unavailable on web.')
}
export async function performCompleteCleanup(){throw new Error('Source-media cleanup is unavailable on web.')}
