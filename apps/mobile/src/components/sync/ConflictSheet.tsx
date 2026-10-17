import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/button'

export type ConflictResolution = 'keep_mine' | 'use_cloud' | 'save_copy' | 'defer'

interface ConflictSheetProps {
  visible: boolean
  localSnapshot: CloudProjectSnapshot | null
  serverSnapshot: CloudProjectSnapshot | null
  onResolve: (choice: ConflictResolution) => void
  onDismiss: () => void
}

function summary(snapshot: CloudProjectSnapshot | null) {
  if (!snapshot) return { name: '—', clips: 0, updatedAt: '—' }
  return {
    name: snapshot.project.name,
    clips: snapshot.clips.length,
    updatedAt: new Date(snapshot.project.updated_at).toLocaleString()
  }
}

export function ConflictSheet({ visible, localSnapshot, serverSnapshot, onResolve, onDismiss }: ConflictSheetProps) {
  const local = summary(localSnapshot)
  const server = summary(serverSnapshot)

  return (
    <BottomSheet visible={visible} onClose={onDismiss} variant="page" title="Sync conflict">
      <Text className="text-sm text-muted">
        This project was edited on another device. Choose which version to keep.
      </Text>

      <View className="gap-[17px]">
        <View className="gap-2 rounded-[18px] bg-surface p-4">
          <Text className="text-xs font-semibold uppercase text-muted">Your version</Text>
          <Text className="mt-1 font-medium text-foreground">{local.name}</Text>
          <Text className="text-sm text-muted">{local.clips} clips</Text>
          <Text className="text-xs text-muted">{local.updatedAt}</Text>
        </View>
        <View className="gap-2 rounded-[18px] bg-surface p-4">
          <Text className="text-xs font-semibold uppercase text-muted">Cloud version</Text>
          <Text className="mt-1 font-medium text-foreground">{server.name}</Text>
          <Text className="text-sm text-muted">{server.clips} clips</Text>
          <Text className="text-xs text-muted">{server.updatedAt}</Text>
        </View>
      </View>

      <Button title="Save mine as a copy" onPress={() => onResolve('save_copy')} />
      <Button title="Keep my version" variant="outline" onPress={() => onResolve('keep_mine')} />
      <Button title="Use cloud version" variant="outline" onPress={() => onResolve('use_cloud')} />
      <Button title="Decide later" variant="ghost" onPress={onDismiss} />
    </BottomSheet>
  )
}

export function useConflictSheetResolver() {
  const [state, setState] = useState<{
    visible: boolean
    local: CloudProjectSnapshot | null
    server: CloudProjectSnapshot | null
    resolver: ((choice: ConflictResolution) => void) | null
  }>({ visible: false, local: null, server: null, resolver: null })

  const handler = async (payload: {
    projectId: string
    localSnapshot: CloudProjectSnapshot
    serverSnapshot: CloudProjectSnapshot
  }): Promise<ConflictResolution> => {
    return new Promise((resolve) => {
      setState({
        visible: true,
        local: payload.localSnapshot,
        server: payload.serverSnapshot,
        resolver: resolve
      })
    })
  }

  const sheet = (
    <ConflictSheet
      visible={state.visible}
      localSnapshot={state.local}
      serverSnapshot={state.server}
      onResolve={(choice) => {
        state.resolver?.(choice)
        setState({ visible: false, local: null, server: null, resolver: null })
      }}
      onDismiss={() => {
        state.resolver?.('defer')
        setState({ visible: false, local: null, server: null, resolver: null })
      }}
    />
  )

  return { handler, sheet }
}
