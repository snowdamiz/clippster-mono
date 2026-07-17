import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { DownloadProgressCard } from '@/components/DownloadProgressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Project } from '@clippster/shared-types';
import type { CloudSyncStatus } from '@clippster/cloud-sync-schema';
import { createProject, getAllProjects, getRawVideoByProjectId } from '@/services/database';
import { tokens } from '@/theme/tokens';
import { getProjectSyncStatuses, queueProjectSync, syncAllProjects } from '@/services/cloudSync';
import {
  getDownloadJobs,
  initDownloadQueue,
  retryDownload,
  cancelDownload,
  subscribeDownloadQueue,
  type DownloadJob,
} from '@/services/downloadQueue';

interface ProjectRow extends Project {
  platform?: string | null;
  duration?: number | null;
  syncStatus?: CloudSyncStatus;
}

const SYNC_BADGE_LABEL: Record<CloudSyncStatus, string> = {
  synced: 'Synced',
  pending: 'Pending',
  conflict: 'Conflict',
  'local-only': 'Local',
};

const SYNC_BADGE_COLOR: Record<CloudSyncStatus, string> = {
  synced: 'text-green-400',
  pending: 'text-warning',
  conflict: 'text-red-400',
  'local-only': 'text-muted',
};

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('Untitled project');
  const [creating, setCreating] = useState(false);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    void initDownloadQueue();
    return subscribeDownloadQueue(setJobs);
  }, []);

  const [syncing, setSyncing] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, syncStatuses] = await Promise.all([getAllProjects(), getProjectSyncStatuses()]);
      const enriched = await Promise.all(
        rows.map(async (project) => {
          const raw = await getRawVideoByProjectId(project.id);
          return {
            ...project,
            platform: raw?.platform ?? null,
            duration: raw?.duration ?? null,
            syncStatus: syncStatuses[project.id] ?? 'local-only',
          };
        }),
      );
      setProjects(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await syncAllProjects();
      await loadProjects();
    } finally {
      setSyncing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
      setJobs(getDownloadJobs());
    }, [loadProjects]),
  );

  async function handleCreateProject() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createProject(trimmed);
      const project = (await getAllProjects()).find((p) => p.name === trimmed);
      if (project) {
        await queueProjectSync(project.id);
      }
      setShowCreate(false);
      setNewName('Untitled project');
      await loadProjects();
    } finally {
      setCreating(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Projects" subtitle="Synced across your devices" />
      <DownloadProgressCard
        jobs={jobs}
        onOpenProject={(projectId) => router.push(`/project/${projectId}`)}
        onRetry={(jobId) => void retryDownload(jobId)}
        onCancel={(jobId) => void cancelDownload(jobId)}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerClassName="grow px-4 py-4"
          ListEmptyComponent={
            <View className="items-center rounded-xl border border-dashed border-border px-6 py-12">
              <Text className="text-lg font-semibold text-foreground">No projects yet</Text>
              <Text className="mt-2 text-center text-sm text-muted">
                Download a VOD or import a video to create your first project.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              className="mb-3 rounded-xl border border-border bg-surface px-4 py-4"
              onPress={() => router.push(`/project/${item.id}`)}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                {item.syncStatus ? (
                  <Text className={`text-xs font-medium ${SYNC_BADGE_COLOR[item.syncStatus]}`}>
                    {SYNC_BADGE_LABEL[item.syncStatus]}
                  </Text>
                ) : null}
              </View>
              <Text className="mt-1 text-xs text-muted">
                {item.platform ? `${item.platform} · ` : ''}
                Updated {new Date(item.updated_at).toLocaleString()}
                {item.duration != null ? ` · ${Math.round(item.duration / 60)} min` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}

      <View className="border-t border-border px-4 py-4 gap-2">
        <Button title={syncing ? 'Syncing…' : 'Sync now'} variant="outline" onPress={handleSyncNow} disabled={syncing} />
        <Button title="New project" onPress={() => setShowCreate(true)} />
      </View>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="w-full rounded-xl border border-border bg-surface p-6">
            <Text className="mb-4 text-xl font-bold text-foreground">New project</Text>
            <View className="gap-2">
              <Label>Name</Label>
              <Input value={newName} onChangeText={setNewName} autoFocus placeholder="Project name" />
            </View>
            <View className="mt-6 flex-row gap-3">
              <View className="flex-1">
                <Button title="Cancel" variant="outline" onPress={() => setShowCreate(false)} />
              </View>
              <View className="flex-1">
                <Button title="Create" onPress={handleCreateProject} disabled={creating || !newName.trim()} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
