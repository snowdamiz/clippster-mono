import { reactive } from 'vue'
import type { AuthUser } from '@clippster/shared-types'
import api from './nativeAccountApi'
async function accountAction(path:string,body:unknown){try{const {data}=await api.post(path,body);if(data.success){if(data.token)localStorage.setItem('auth_token',data.token);if(data.user){account.user={...account.user,...data.user};localStorage.setItem('user',JSON.stringify(account.user));localStorage.setItem('auth_provider',data.user.provider || 'email')}window.parent.postMessage({type:'clippster-account-refresh'},location.origin)}return {...data,pendingEmail:data.pending_email,otpRequired:data.otp_required===true,convertingFromOauth:data.converting_from_oauth===true}}catch(error:any){return {success:false,error:error.response?.data?.error || error.message}}}
const account = reactive({ user: null as AuthUser | null, get isAuthenticated() { return !!this.user },get token(){return localStorage.getItem('auth_token') || ''},get email(){return this.user?.email || ''},get authProvider(){return localStorage.getItem('auth_provider') || 'email'},getAuthToken:()=>localStorage.getItem('auth_token') || '',
  changePassword:(current_password:string,new_password:string)=>accountAction('/account/change-password',{current_password,new_password}),
  changeEmail:(new_email:string,options:Record<string,unknown>)=>accountAction('/account/change-email',{new_email,...(options.newPassword?{new_password:options.newPassword}:{password:options.password})}),
  verifyEmailChangeOtp:(otp:string)=>accountAction('/account/verify-email-change-otp',{otp}),
  resendEmailChangeVerification:()=>accountAction('/account/resend-email-change',{}),
  async switchGoogleAccount():Promise<any>{const {data}=await api.get('/auth/google/switch',{params:{web:true,origin:location.origin}});if(!data.success||!data.url)return data;window.top!.location.href=data.url;return new Promise(()=>{})}
})
export function setWorkspaceAccount(user: AuthUser | null) { account.user = user }
export function useAuthStore() { return account }
