/** Axios-shaped adapter for shared desktop account services in the embedded web app. */
import { profileMediaUrls, restoreMediaUrls } from './profileMediaUrls'
type Options = { timeout?: number; params?: Record<string, unknown>; responseType?: string; headers?: Record<string,string | undefined>; onUploadProgress?: (progress: { loaded: number; total?: number }) => void }
async function request<T>(path: string, method: string, body?: unknown, options: Options = {}) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Use an account API path.')
  const url = new URL('/api' + path, location.origin)
  for (const [key,value] of Object.entries(options.params || {})) if(value!==undefined&&value!==null)url.searchParams.set(key,String(value))
  return new Promise<{data:T;status:number}>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open(method,url.href);xhr.withCredentials=true
    const token=localStorage.getItem('auth_token');if(token)xhr.setRequestHeader('Authorization',`Bearer ${token}`)
    xhr.setRequestHeader('X-Client-Platform','web')
    if(!(body instanceof FormData))xhr.setRequestHeader('Content-Type','application/json')
    xhr.timeout=options.timeout ?? 300000
    if(options.responseType==='blob')xhr.responseType='blob'
    xhr.upload.onprogress=event=>options.onUploadProgress?.({loaded:event.loaded,total:event.lengthComputable?event.total:undefined})
    xhr.onload=()=>{let data:any;try{data=xhr.responseType==='blob'?xhr.response:JSON.parse(xhr.responseText || 'null')}catch{data={error:'Invalid account response.'}}
      if(xhr.status>=200&&xhr.status<300)resolve({data:profileMediaUrls(path,data),status:xhr.status});else reject(Object.assign(new Error(data?.error || 'Account request failed.'),{response:{data,status:xhr.status}}))}
    xhr.onerror=()=>reject(new Error('Unable to reach your account.'));xhr.ontimeout=()=>reject(new Error('Account request timed out.'))
    xhr.send(body instanceof FormData?body:body===undefined?null:JSON.stringify(restoreMediaUrls(body)))
  })
}
export default { get:<T=any>(path:string,options?:Options)=>request<T>(path,'GET',undefined,options),post:<T=any>(path:string,body?:unknown,options?:Options)=>request<T>(path,'POST',body,options),put:<T=any>(path:string,body?:unknown,options?:Options)=>request<T>(path,'PUT',body,options),patch:<T=any>(path:string,body?:unknown,options?:Options)=>request<T>(path,'PATCH',body,options),delete:<T=any>(path:string,options?:Options)=>request<T>(path,'DELETE',undefined,options) }
