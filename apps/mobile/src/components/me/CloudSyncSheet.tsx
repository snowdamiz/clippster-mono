import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { AppIcon } from '@/components/AppIcon'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/button'
import { SharedClipLibrary } from '@/components/inbox/SharedClipLibrary'
import { CLOUD_SYNC_ENABLED, syncAllProjects } from '@/services/cloudSync'
import { getAllCloudSyncMeta } from '@/services/database/cloud-sync-meta'
import { appAlert } from '@/lib/appAlert'
import { tokens } from '@/theme/tokens'

export function CloudSyncSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState(0)
  const [pending, setPending] = useState(0)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [error, setError] = useState(false)
  async function refresh() {
    try {
      const metadata = await getAllCloudSyncMeta()
      setConflicts(metadata.filter((item) => item.sync_status === 'conflict').length)
      setPending(metadata.filter((item) => item.sync_status === 'pending').length)
      const times = metadata.flatMap((item) => (item.last_synced_at ? [item.last_synced_at] : []))
      setLastSync(times.length ? Math.max(...times) : null)
      setError(false)
    } catch {
      setError(true)
    }
  }
  useEffect(() => {
    if (visible) void refresh()
  }, [visible])
  async function sync() {
    setSyncing(true)
    try {
      await syncAllProjects()
      await refresh()
    } catch (failure) {
      appAlert('Sync failed', failure instanceof Error ? failure.message : 'Please try again.')
    } finally {
      setSyncing(false)
    }
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} variant="page" title="Cloud & shared work">
      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-4">
        <AppIcon
          name={CLOUD_SYNC_ENABLED && !pending && !conflicts && !error ? 'CircleCheck' : 'Cloud'}
          size={34}
          color={CLOUD_SYNC_ENABLED ? tokens.colors.success : tokens.colors.muted}
        />
        <View className="flex-1 gap-1">
          <Text className="text-[17px] font-semibold text-foreground">
            {!CLOUD_SYNC_ENABLED
              ? 'Saved on device'
              : error
                ? 'Status unavailable'
                : pending
                  ? 'Changes pending'
                  : conflicts
                    ? 'Review needed'
                    : lastSync
                      ? 'Up to date'
                      : 'Ready to sync'}
          </Text>
          <Text className="text-xs leading-5 text-muted">
            {!CLOUD_SYNC_ENABLED
              ? 'Project cloud sync is not enabled.'
              : lastSync
                ? 'Last synced ' + new Date(lastSync).toLocaleString()
                : 'Your local project status'}
          </Text>
        </View>
        {CLOUD_SYNC_ENABLED ? (
          <Button
            title={syncing ? 'Syncing…' : 'Sync now'}
            variant="outline"
            disabled={syncing}
            onPress={() => void sync()}
          />
        ) : null}
      </View>
      {CLOUD_SYNC_ENABLED && conflicts > 0 ? (
        <View className="gap-2 rounded-[18px] border border-border bg-surface p-4">
          <Text className="text-[17px] font-semibold text-foreground">Sync conflicts · {conflicts}</Text>
          <Text className="text-sm text-muted">
            Sync now to review conflicting versions before replacing your work.
          </Text>
          <Button title="Review conflicts" onPress={() => void sync()} disabled={syncing} />
        </View>
      ) : null}
      <SharedClipLibrary visible={visible} />
    </BottomSheet>
  )
}
