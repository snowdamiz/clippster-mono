import { api } from '@/lib/api'

export interface UserSocialAccount {
  id: number
  platform: string
  platform_user_id: string
  username: string
  display_name: string | null
  profile_image_url: string | null
  is_active: boolean
  connected_at: string
  token_expires_at: string | null
  pfm_account_id: string | null
  inserted_at: string
  updated_at: string
}

export async function listUserSocialAccounts(): Promise<{
  success: boolean
  social_accounts: UserSocialAccount[]
  error?: string
}> {
  return api.get('/user/social-accounts')
}

export async function deleteUserSocialAccount(accountId: number): Promise<{
  success: boolean
  error?: string
}> {
  return api.delete(`/user/social-accounts/${accountId}`)
}
