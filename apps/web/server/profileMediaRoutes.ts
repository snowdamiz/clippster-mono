import { Router } from 'express'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Auth } from './auth'
import { requireValue } from './errors'
import { openAsset } from './network'
export function profileMediaRoutes(auth:Auth){
  const router=Router(),active=new Map<string,number>()
  router.get('/profile-media/:kind/:id',async(req,res)=>{
    const kind=String(req.params.kind),id=String(req.params.id),owner=res.locals.session.owner
    requireValue((active.get(owner)||0)<8,429,'Wait for your media previews to finish loading.')
    const api=auth.upstream(auth.token(res.locals.session))
    let url:string | undefined
    if(kind==='avatar'||kind==='portfolio'||kind==='portfolio-thumbnail'){
      const {profile}=await api.get<any>('/user/clipper-profile')
      if(kind==='avatar'){requireValue(id==='self',400,'Invalid avatar.');url=profile?.avatar_url}
      else {const item=profile?.portfolio_clips?.find((clip:any)=>String(clip.id)===id);url=kind==='portfolio'?item?.video_url:item?.thumbnail_url}
    }else if(kind==='social-avatar'){
      const data=await api.get<any>('/user/social-accounts');url=(data.social_accounts || data.accounts)?.find((account:any)=>String(account.id)===id)?.profile_image_url
    }else if(kind==='post'||kind==='post-thumbnail'){
      const match=id.match(/^(personal|organization):(\d+)$/);requireValue(match,400,'Invalid post.')
      const data=await api.get<any>('/user/posts');const item=data.posts?.find((post:any)=>String(post.id)===match![2]&&(post.source || 'personal')===match![1]);url=kind==='post'?item?.media_url:item?.thumbnail_url
    }else if(kind==='public-avatar'){
      requireValue(/^[a-zA-Z0-9-]{1,100}$/.test(id),400,'Invalid public profile.')
      const {profile}=await api.get<any>(`/clippers/${id}`);requireValue(profile?.is_public!==false,404,'Profile not found.');url=profile?.avatar_url
    }
    requireValue(url,404,'Profile media not found.')
    const range=req.headers.range;requireValue(!range||/^bytes=\d*-\d*$/.test(range)&&range.length<80,400,'Invalid media range.')
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
    requireValue((active.get(owner)||0)<8,429,'Wait for your media previews to finish loading.')
    active.set(owner,(active.get(owner)||0)+1)
    const abort=()=>controller.abort();res.on('close',abort)
    try{
      const response=await openAsset(url,controller.signal,range),video=kind==='portfolio'||kind==='post',limit=(video?200:10)*1024**2
      if(Number(response.headers['content-length'] || 0)>limit){response.destroy();requireValue(false,413,'Media preview is too large.')}
      res.status(response.statusCode || 200).set('Cache-Control','private, no-store').type(String(response.headers['content-type'] || (video?'video/mp4':'image/jpeg')))
      for(const key of ['content-length','content-range','accept-ranges'])if(response.headers[key])res.set(key,String(response.headers[key]))
      let bytes=0;await pipeline(response,new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;callback(bytes>limit?new Error('Media preview is too large.'):null,chunk)}}),res,{signal:controller.signal})
    }finally{clearTimeout(timer);res.off('close',abort);active.set(owner,Math.max(0,(active.get(owner)||1)-1))}
  })
  return router
}
