import { useEffect } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { SocialAccountsManager } from '@/components/organization/SocialAccountsManager'
import { Globe } from 'lucide-react'

export function OrgSocial() {
  const { loadOrganization } = useOrganization()
  useEffect(() => { loadOrganization() }, [loadOrganization])
  return (
    <PageLayout icon={Globe} title="Social Accounts" description="Manage connected social media accounts">
      <SocialAccountsManager />
    </PageLayout>
  )
}
