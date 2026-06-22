import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';

export type ConflictResolution = 'keep_mine' | 'use_cloud' | 'save_copy';

interface ConflictSheetProps {
  visible: boolean;
  localSnapshot: CloudProjectSnapshot | null;
  serverSnapshot: CloudProjectSnapshot | null;
  onResolve: (choice: ConflictResolution) => void;
  onDismiss: () => void;
}

function summary(snapshot: CloudProjectSnapshot | null) {
  if (!snapshot) return { name: '—', clips: 0, updatedAt: '—' };
  return {
    name: snapshot.project.name,
    clips: snapshot.clips.length,
    updatedAt: new Date(snapshot.project.updated_at).toLocaleString(),
  };
}

export function ConflictSheet({
  visible,
  localSnapshot,
  serverSnapshot,
  onResolve,
  onDismiss,
}: ConflictSheetProps) {
  const local = summary(localSnapshot);
  const server = summary(serverSnapshot);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="gap-4 rounded-t-2xl bg-background p-6">
          <Text className="text-xl font-semibold text-foreground">Sync conflict</Text>
          <Text className="text-sm text-muted">
            This project was edited on another device. Choose which version to keep.
          </Text>

          <View className="flex-row gap-3">
            <View className="flex-1 rounded-lg border border-border p-3">
              <Text className="text-xs font-semibold uppercase text-muted">Your version</Text>
              <Text className="mt-1 font-medium text-foreground">{local.name}</Text>
              <Text className="text-sm text-muted">{local.clips} clips</Text>
              <Text className="text-xs text-muted">{local.updatedAt}</Text>
            </View>
            <View className="flex-1 rounded-lg border border-border p-3">
              <Text className="text-xs font-semibold uppercase text-muted">Cloud version</Text>
              <Text className="mt-1 font-medium text-foreground">{server.name}</Text>
              <Text className="text-sm text-muted">{server.clips} clips</Text>
              <Text className="text-xs text-muted">{server.updatedAt}</Text>
            </View>
          </View>

          <Button title="Keep mine" onPress={() => onResolve('keep_mine')} />
          <Button title="Use cloud" variant="outline" onPress={() => onResolve('use_cloud')} />
          <Button title="Save mine as copy" variant="outline" onPress={() => onResolve('save_copy')} />
          <Pressable onPress={onDismiss}>
            <Text className="text-center text-sm text-muted">Decide later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function useConflictSheetResolver() {
  const [state, setState] = useState<{
    visible: boolean;
    local: CloudProjectSnapshot | null;
    server: CloudProjectSnapshot | null;
    resolver: ((choice: ConflictResolution) => void) | null;
  }>({ visible: false, local: null, server: null, resolver: null });

  const handler = async (payload: {
    projectId: string;
    localSnapshot: CloudProjectSnapshot;
    serverSnapshot: CloudProjectSnapshot;
  }): Promise<ConflictResolution> => {
    return new Promise((resolve) => {
      setState({
        visible: true,
        local: payload.localSnapshot,
        server: payload.serverSnapshot,
        resolver: resolve,
      });
    });
  };

  const sheet = (
    <ConflictSheet
      visible={state.visible}
      localSnapshot={state.local}
      serverSnapshot={state.server}
      onResolve={(choice) => {
        state.resolver?.(choice);
        setState({ visible: false, local: null, server: null, resolver: null });
      }}
      onDismiss={() => {
        state.resolver?.('use_cloud');
        setState({ visible: false, local: null, server: null, resolver: null });
      }}
    />
  );

  return { handler, sheet };
}
