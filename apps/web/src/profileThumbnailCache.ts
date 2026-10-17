import { useAuthStore } from './workspaceAccount'
const cache=new Map<string,{url:string;time:number}>()
const key=(id:number)=>`${useAuthStore().user?.id}:${id}`
export async function initThumbnailCache(){for(const [id,value] of cache)if(Date.now()-value.time>86400000)cache.delete(id)}
export async function getCachedThumbnail(id:number){const value=cache.get(key(id));return value&&Date.now()-value.time<86400000?value.url:null}
export async function setCachedThumbnail(id:number,url:string){cache.set(key(id),{url,time:Date.now()})}
