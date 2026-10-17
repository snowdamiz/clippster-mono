import { reactive } from 'vue'
import { workspaceClient } from './api'
const permissions = reactive({ isRestricted: false, allowAi: true, allowHiringBrowse: false })
export function usePermissionsStore() { return permissions }
export async function refreshWorkspacePermissions() {
  const result = await workspaceClient.get<{ restricted?: boolean; restrictions?: { allow_ai?: boolean; allow_hiring_browse?: boolean } }>('/web/account/user/restrictions')
  permissions.isRestricted = result.restricted === true; permissions.allowAi = result.restrictions?.allow_ai !== false
  permissions.allowHiringBrowse = result.restrictions?.allow_hiring_browse !== false
}
