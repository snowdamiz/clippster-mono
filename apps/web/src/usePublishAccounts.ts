import { ref } from 'vue'
import { WEB_PUBLISH_PLATFORMS } from '@clippster/shared-types'
import { workspaceClient } from './api'
export interface PublishAccount { id: number; platform: string; username?: string; display_name?: string; organizationId?: number }
export function usePublishAccounts() {
  const accounts = ref<PublishAccount[]>([]), loading = ref(false)
  async function load() {
    loading.value = true
    try {
      const permissions = await workspaceClient.get<{ restricted?: boolean; restrictions?: { require_clip_approval?: boolean; allow_personal_social?: boolean; restricting_org_id?: number } }>('/web/account/user/restrictions')
      const personal = permissions.restrictions?.require_clip_approval || permissions.restricted && permissions.restrictions?.allow_personal_social === false ? [] : (await workspaceClient.get<{ social_accounts: PublishAccount[] }>('/web/account/user/social-accounts')).social_accounts
      const organizations = await workspaceClient.get<{ organizations: Array<{ id: number; role: string }> }>('/web/account/organizations')
      const organizationAccounts = await Promise.all(organizations.organizations.map(async organization => {
        const path = ['owner', 'admin'].includes(organization.role) ? 'social-accounts' : 'my-social-accounts'
        const result = await workspaceClient.get<{ accounts: PublishAccount[] }>(`/web/account/organizations/${organization.id}/${path}`)
        return result.accounts.map(account => ({ ...account, organizationId: organization.id }))
      }))
      accounts.value = [...personal, ...organizationAccounts.flat()].filter(account => WEB_PUBLISH_PLATFORMS.includes(account.platform))
    } finally { loading.value = false }
  }
  return { accounts, loading, load }
}
