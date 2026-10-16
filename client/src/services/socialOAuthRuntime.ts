import { invoke } from '@tauri-apps/api/core'
export async function openSocialOAuth(authUrl: string) { await invoke('start_social_oauth', { authUrl }) }
