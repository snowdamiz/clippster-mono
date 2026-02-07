import { useState, useEffect } from 'react'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import { listSocialAccounts, deleteSocialAccount } from '@/services/socialAccountsApi'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import type { SocialAccount } from '@/types/organization'
import { Globe, Trash2, Instagram } from 'lucide-react'

export function SocialAccountsManager() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { organizationId } = useOrganization()
  const toast = useToast()

  const load = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listSocialAccounts(organizationId, true)
      if (result.success) setAccounts(result.accounts)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [organizationId])

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteSocialAccount(organizationId, deleteTarget.id)
      if (result.success) {
        setAccounts(prev => prev.filter(a => a.id !== deleteTarget.id))
        toast.success('Account removed')
      }
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  const getPlatformIcon = (platform: string) => {
    if (platform === 'instagram') return Instagram
    return Globe
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />)}</div>
  if (accounts.length === 0) return <EmptyState icon={Globe} title="No Social Accounts" description="Connect social accounts to enable posting and scheduling" />

  return (
    <>
      <div className="space-y-3">
        {accounts.map(account => {
          const PlatformIcon = getPlatformIcon(account.platform)
          return (
            <div key={account.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <Avatar src={account.profile_image_url} name={account.display_name || account.username} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <PlatformIcon className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-medium text-white">@{account.username}</span>
                  <Badge variant={account.is_active ? 'success' : 'default'}>{account.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {account.display_name && <p className="text-xs text-zinc-500 mt-0.5">{account.display_name}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(account)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )
        })}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Social Account"
        description={`Are you sure you want to remove @${deleteTarget?.username}? This will disconnect the account.`}
        confirmText="Remove"
        loading={deleting}
      />
    </>
  )
}
