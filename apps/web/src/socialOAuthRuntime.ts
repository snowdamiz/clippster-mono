export async function openSocialOAuth(authUrl:string) {
  const url=new URL(authUrl)
  if(url.protocol!=='https:')throw new Error('Use a secure social connection URL.')
  const popup=window.open(url.href,'clippster-social-connect','popup,width=650,height=800')
  if(!popup)throw new Error('Allow popups to connect your social account.')
}
