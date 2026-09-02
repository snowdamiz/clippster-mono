import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DownloadProgressCard } from '@/components/DownloadProgressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccount } from '@/context/AccountContext';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { Project } from '@clippster/shared-types';
import { createProject, getAllProjects, getRawVideoByProjectId } from '@/services/database';
import { pickAndImportLocalVideo, recordAndImportLocalVideo } from '@/services/localVideoImport';
import { tokens } from '@/theme/tokens';
import { deleteProjectEverywhere } from '@/services/cloudSync';
import {
  backfillProjectThumbnail,
  getDownloadJobs,
  initDownloadQueue,
  retryDownload,
  cancelDownload,
  removeDownload,
  subscribeDownloadQueue,
  type DownloadJob,
} from '@/services/downloadQueue';
import { appAlert } from '@/lib/appAlert';

interface ProjectRow extends Project {
  platform?: string | null;
  duration?: number | null;
  thumbnailUri?: string | null;
}

function toLocalImageUri(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
    return path;
  }
  return `file://${path}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export default function ProjectsScreen() {
  const { requireSubscription } = useAccount();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = (windowWidth - 32 - 12) / 2;
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('Untitled project');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [menuProject, setMenuProject] = useState<ProjectRow | null>(null);

  useEffect(() => {
    void initDownloadQueue();
    return subscribeDownloadQueue(setJobs);
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAllProjects();
      const enriched = await Promise.all(
        rows.map(async (project) => {
          const raw = await getRawVideoByProjectId(project.id);
          const jobThumb = getDownloadJobs().find((job) => job.projectId === project.id)?.thumbnailUrl;
          return {
            ...project,
            platform: raw?.platform ?? null,
            duration: raw?.duration ?? null,
            thumbnailUri: toLocalImageUri(
              project.thumbnail_path ?? raw?.thumbnail_path ?? jobThumb ?? null,
            ),
          };
        }),
      );
      setProjects(enriched);

      void Promise.all(
        enriched.map(async (project) => {
          if (project.thumbnailUri) return;
          const raw = await getRawVideoByProjectId(project.id);
          if (!raw?.file_path) return;
          const jobThumb = getDownloadJobs().find((job) => job.projectId === project.id)?.thumbnailUrl;
          const thumbPath = await backfillProjectThumbnail(project.id, raw.file_path, jobThumb);
          if (!thumbPath) return;
          setProjects((current) =>
            current.map((row) =>
              row.id === project.id
                ? { ...row, thumbnailUri: toLocalImageUri(thumbPath) }
                : row,
            ),
          );
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
      setJobs(getDownloadJobs());
    }, [loadProjects]),
  );

  useEffect(() => {
    if (jobs.some((job) => job.status === 'complete' && job.projectId)) {
      void loadProjects();
    }
  }, [jobs, loadProjects]);

  function closeCreateModal() {
    setShowCreate(false);
    setNewName('Untitled project');
  }

  async function handleCreateEmptyProject() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const allowed = await requireSubscription({
      context: 'Create a new project',
      type: 'project',
    });
    if (!allowed) return;
    setCreating(true);
    try {
      await createProject(trimmed);
      closeCreateModal();
      await loadProjects();
    } finally {
      setCreating(false);
    }
  }

  async function handleRecordVideo() {
    const allowed = await requireSubscription({
      context: 'Record a video',
      type: 'project',
    });
    if (!allowed) return;

    setImporting(true);
    try {
      const projectId = await recordAndImportLocalVideo();
      if (projectId) {
        closeCreateModal();
        router.push(`/project/${projectId}`);
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleImportVideo() {
    const allowed = await requireSubscription({
      context: 'Import a local video',
      type: 'project',
    });
    if (!allowed) return;

    setImporting(true);
    try {
      const projectId = await pickAndImportLocalVideo();
      if (projectId) {
        closeCreateModal();
        router.push(`/project/${projectId}`);
      }
    } finally {
      setImporting(false);
    }
  }

  function openProjectMenu(project: ProjectRow) {
    setMenuProject(project);
  }

  function handleEditProject() {
    if (!menuProject) return;
    const projectId = menuProject.id;
    setMenuProject(null);
    router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'project', id: projectId } });
  }

  async function handleDetectClips() {
    if (!menuProject) return;
    const projectId = menuProject.id;
    setMenuProject(null);
    const allowed = await requireSubscription({
      context: 'Detect clips with AI',
      type: 'ai',
      aiOnly: true,
    });
    if (!allowed) return;
    router.push(`/project/${projectId}?detect=1`);
  }

  function handleDeleteProject() {
    if (!menuProject) return;
    const project = menuProject;
    setMenuProject(null);
    appAlert(
      'Delete project',
      `Delete “${project.name}”? Built clips stay in Clips. Unbuilt clips and the downloaded video are removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteProjectEverywhere(project.id);
              await loadProjects();
            })();
          },
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader showLogo />

      <DownloadProgressCard
        jobs={jobs}
        onOpenProject={(projectId) => router.push(`/project/${projectId}`)}
        onRetry={(jobId) => void retryDownload(jobId)}
        onCancel={(jobId) => void cancelDownload(jobId)}
        onRemove={(jobId) => void removeDownload(jobId)}
      />

      <View className="px-4 pt-4">
        <Pressable
          onPress={() => router.push('/(tabs)/download')}
          className="flex-row items-center gap-4 rounded-xl border border-border bg-surface p-4 active:bg-white/5"
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Ionicons name="add" size={32} color={tokens.colors.primaryForeground} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">New project</Text>
            <Text className="text-sm text-muted">Download a VOD or import from your device</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={tokens.colors.muted} />
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-between px-4">
        <Text className="text-sm font-semibold text-foreground">Your projects</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerClassName="px-4 py-4 gap-3"
          ListEmptyComponent={
            <View className="items-center rounded-xl border border-dashed border-border px-6 py-12">
              <Ionicons name="film-outline" size={40} color={tokens.colors.muted} />
              <Text className="mt-3 text-lg font-semibold text-foreground">No projects yet</Text>
              <Text className="mt-2 text-center text-sm text-muted">
                Tap New project to download a stream VOD or import a video from your library.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={{ width: cardWidth }}
              className="overflow-hidden rounded-xl border border-border bg-surface"
              onPress={() => router.push(`/project/${item.id}`)}
            >
              <View
                className="items-center justify-center bg-surfaceMuted"
                style={{ width: cardWidth, aspectRatio: 16 / 9 }}
              >
                {item.thumbnailUri ? (
                  <Image
                    source={{ uri: item.thumbnailUri }}
                    style={{ width: cardWidth, aspectRatio: 16 / 9 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="play-circle-outline" size={28} color={tokens.colors.muted} />
                )}
                <Pressable
                  onPress={() => openProjectMenu(item)}
                  hitSlop={8}
                  className="absolute right-1.5 top-1.5 h-8 w-8 items-center justify-center rounded-full bg-black/60"
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color="#ffffff" />
                </Pressable>
              </View>
              <View className="gap-0.5 p-2">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-xs text-muted">
                  {item.platform ? `${item.platform}` : 'Local'}
                  {item.duration != null ? ` · ${formatDuration(item.duration)}` : ''}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <View className="border-t border-border px-4 py-3">
        <Button title="Import local video" variant="outline" onPress={() => setShowCreate(true)} />
      </View>

      <Modal
        visible={menuProject != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuProject(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/70" onPress={() => setMenuProject(null)}>
          <Pressable className="rounded-t-2xl border-t border-border bg-background px-4 pb-8 pt-4" onPress={() => {}}>
            <Text className="mb-1 text-lg font-semibold text-foreground" numberOfLines={1}>
              {menuProject?.name}
            </Text>
            <Text className="mb-4 text-xs text-muted">Project options</Text>
            <Pressable
              onPress={handleEditProject}
              className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-white/5"
            >
              <Ionicons name="film-outline" size={20} color={tokens.colors.foreground} />
              <Text className="text-sm font-medium text-foreground">Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleDetectClips()}
              className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-white/5"
            >
              <Ionicons name="sparkles-outline" size={20} color={tokens.colors.foreground} />
              <Text className="text-sm font-medium text-foreground">Detect clips</Text>
            </Pressable>
            <Pressable
              onPress={handleDeleteProject}
              className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-white/5"
            >
              <Ionicons name="trash-outline" size={20} color={tokens.colors.destructive} />
              <Text className="text-sm font-medium text-destructive">Delete</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuProject(null)}
              className="mt-2 items-center rounded-lg border border-border py-3"
            >
              <Text className="text-sm font-semibold text-foreground">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={closeCreateModal}>
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <ScrollView className="max-h-[90%] w-full" contentContainerClassName="grow justify-center">
            <View className="w-full overflow-hidden rounded-xl border border-border bg-surface">
              <View className="h-[3px] bg-accent" />
              <View className="p-6">
                <Text className="text-xl font-bold text-foreground">New video</Text>
                <Text className="mt-2 text-sm text-muted">
                  Record with your camera, pick a clip from your phone, or download a stream from Create.
                </Text>

                <View className="mt-6 gap-2">
                  <Button
                    title={importing ? 'Opening…' : 'Record video'}
                    onPress={() => void handleRecordVideo()}
                    disabled={importing || creating}
                  />
                  <Button
                    title={importing ? 'Importing…' : 'Choose from camera roll'}
                    variant="outline"
                    onPress={() => void handleImportVideo()}
                    disabled={importing || creating}
                  />
                </View>

                <View className="my-6 flex-row items-center gap-3">
                  <Separator className="flex-1" />
                  <Text className="text-xs text-muted">or</Text>
                  <Separator className="flex-1" />
                </View>

                <View className="gap-2">
                  <Label>Empty project</Label>
                  <Input value={newName} onChangeText={setNewName} placeholder="Project name" />
                  <Button
                    title="Create empty project"
                    variant="outline"
                    onPress={handleCreateEmptyProject}
                    disabled={creating || importing || !newName.trim()}
                  />
                </View>

                <View className="mt-4">
                  <Button title="Cancel" variant="ghost" onPress={closeCreateModal} />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
