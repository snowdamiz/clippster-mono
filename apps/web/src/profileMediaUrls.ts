import { webApiPath } from './api'
const originals=new Map<string,string>()
function proxy(url:string,kind:string,id:string|number){if(!/^https:\/\//.test(url))return url;const reference=`${webApiPath}/profile-media/${kind}/${encodeURIComponent(id)}?v=${encodeURIComponent(url.split('/').at(-1)!.split('?')[0])}`;originals.set(reference,url);if(originals.size>512)originals.delete(originals.keys().next().value!);return reference}
export function restoreMediaUrls(value:any):any {if(typeof value==='string')return originals.get(value)||value;if(Array.isArray(value))return value.map(restoreMediaUrls);if(value&&typeof value==='object'&&!(value instanceof FormData))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,restoreMediaUrls(item)]));return value}
export function profileMediaUrls(path:string,data:any){
  if(!data||typeof data!=='object')return data
  const profile=data.profile
  if(profile&&path.startsWith('/user/clipper-profile')){if(profile.avatar_url)profile.avatar_url=proxy(profile.avatar_url,'avatar','self');for(const clip of profile.portfolio_clips || []){if(clip.video_url)clip.video_url=proxy(clip.video_url,'portfolio',clip.id);if(clip.thumbnail_url)clip.thumbnail_url=proxy(clip.thumbnail_url,'portfolio-thumbnail',clip.id)}}
  if(path==='/user/clipper-profile/avatar'&&data.avatar_url)data.avatar_url=proxy(data.avatar_url,'avatar','self')
  if(path.startsWith('/user/clipper-profile/portfolio-clips'))for(const clip of data.portfolio_clips || (data.portfolio_clip?[data.portfolio_clip]:[])){if(clip.video_url)clip.video_url=proxy(clip.video_url,'portfolio',clip.id);if(clip.thumbnail_url)clip.thumbnail_url=proxy(clip.thumbnail_url,'portfolio-thumbnail',clip.id)}
  for(const account of data.accounts || data.social_accounts || [])if(account.profile_image_url)account.profile_image_url=proxy(account.profile_image_url,'social-avatar',account.id)
  if(path.startsWith('/user/posts'))for(const post of data.posts || (data.post?[data.post]:[])){const id=`${post.source || 'personal'}:${post.id}`;if(post.media_url)post.media_url=proxy(post.media_url,'post',id);if(post.thumbnail_url)post.thumbnail_url=proxy(post.thumbnail_url,'post-thumbnail',id)}
  const generated=path.match(/^\/user\/posts\/(\d+)\/generate-thumbnail$/)
  if(generated&&data.thumbnail_url)data.thumbnail_url=data.post?.thumbnail_url || proxy(data.thumbnail_url,'post-thumbnail',`personal:${generated[1]}`)
  for(const entry of data.entries || [])if(entry.profile?.avatar_url&&entry.profile.slug)entry.profile.avatar_url=proxy(entry.profile.avatar_url,'public-avatar',entry.profile.slug)
  if(/^\/user\/clipper-profile\/portfolio-clips\/\d+\/presigned-url$/.test(path)&&data.url)data.url=proxy(data.url,'portfolio',path.split('/')[4])
  return data
}
