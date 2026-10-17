import { reactive } from 'vue'
import api from './nativeAccountApi'
import { useToast } from './toasts'
const preferences=reactive<Record<string,any>>({time_format_preference:'12hr',toast_enabled:true,toast_duration:5000,toast_position:'bottom-right',toast_sound_enabled:false,toast_background_enabled:true,notify_livestream:true,notify_clips:true,notify_downloads:true,notify_projects:true,notify_social:true,notify_organization:true,notify_system:true,completed_tours:{}})
const state=reactive({preferences,saving:false,get is24Hour(){return preferences.time_format_preference==='24hr'},get toastEnabled(){return preferences.toast_enabled},get toastDuration(){return preferences.toast_duration},get toastPosition(){return preferences.toast_position},get toastSoundEnabled(){return preferences.toast_sound_enabled},get toastBackgroundEnabled(){return preferences.toast_background_enabled},
  async loadPreferences(){const {data}=await api.get('/user/preferences');if(data.success&&data.preferences)Object.assign(preferences,data.preferences)},
  async updatePreference(key:string,value:unknown,_user?:string,_token?:string){state.saving=true;try{const {data}=await api.patch('/user/preferences',{[key]:value});if(!data.success)throw new Error(data.error || 'Unable to save preferences.');Object.assign(preferences,data.preferences || {[key]:value});return true}catch(error:any){useToast().error('Could not save preference',error.message);return false}finally{state.saving=false}}
})
export function useUserPreferencesStore(){return state}
