import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import type { Project } from '@clippster/shared-types';
import { getAllProjects, getRawVideoByProjectId } from '@/services/database';
import { pickAndImportLocalVideo } from '@/services/localVideoImport';
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
import { mobileDraftRepository } from '@/editor/persistence/asyncStorageDraftRepository';

interface ProjectRow extends Project {
  platform?: string | null;
  duration?: number | null;
  thumbnailUri?: string | null;
  hasEditorDraft: boolean;
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
  const [sourceUrl, setSourceUrl] = useState('');
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
          const hasEditorDraft = await mobileDraftRepository
            .load('project', project.id)
            .then((draft) => draft != null)
            .catch(() => false);
          return {
            ...project,
            platform: raw?.platform ?? null,
            duration: raw?.duration ?? null,
            hasEditorDraft,
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
    setSourceUrl('');
  }

  function handlePasteUrl() {
    const url = sourceUrl.trim();
    if (!url) return;
    closeCreateModal();
    router.push({ pathname: '/(tabs)/download', params: { source: url } });
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

  const downloads = projects.filter(
    (project) => !project.hasEditorDraft && project.platform != null && project.platform !== 'manual',
  );
  const editorProjects = projects.filter(
    (project) => project.hasEditorDraft || project.platform == null || project.platform === 'manual',
  );

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
          onPress={() => setShowCreate(true)}
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

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-6 px-4 py-4">
          <ProjectCategory
            title="Downloads"
            emptyMessage="Videos downloaded from a URL will appear here."
            items={downloads}
            cardWidth={cardWidth}
            onOpen={(project) => router.push(`/project/${project.id}`)}
            onMenu={openProjectMenu}
          />
          <ProjectCategory
            title="Projects"
            emptyMessage="Uploaded videos and editor projects will appear here."
            items={editorProjects}
            cardWidth={cardWidth}
            onOpen={(project) =>
              project.hasEditorDraft
                ? router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'project', id: project.id } })
                : router.push(`/project/${project.id}`)
            }
            onMenu={openProjectMenu}
          />
        </ScrollView>
      )}

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

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={closeCreateModal}>
        <Pressable className="flex-1 justify-end bg-black/70" onPress={closeCreateModal}>
          <Pressable
            className="rounded-t-3xl border-t border-border bg-background px-4 pb-8 pt-3"
            onPress={() => {}}
          >
            <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
            <Text className="text-xl font-bold text-foreground">New project</Text>
            <Text className="mt-1 text-sm text-muted">
              Paste a video or channel URL, or import a local video file.
            </Text>

            <View className="mt-6 gap-3">
              <Input
                value={sourceUrl}
                onChangeText={setSourceUrl}
                onSubmitEditing={handlePasteUrl}
                placeholder="Paste a video or channel URL"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
              />
              <Button
                title="Continue with URL"
                variant="accent"
                onPress={handlePasteUrl}
                disabled={!sourceUrl.trim() || importing}
              />
            </View>

            <View className="my-5 h-px bg-border" />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import local files"
              onPress={() => void handleImportVideo()}
              disabled={importing}
              className="min-h-14 flex-row items-center gap-4 rounded-xl border border-border bg-surface px-4 active:bg-white/5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <Ionicons name="folder-open-outline" size={22} color={tokens.colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {importing ? 'Importing…' : 'Import local files'}
                </Text>
                <Text className="text-xs text-muted">Choose a video from this device</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tokens.colors.muted} />
            </Pressable>

            <View className="mt-3">
              <Button title="Cancel" variant="ghost" onPress={closeCreateModal} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ProjectCategory({
  title,
  emptyMessage,
  items,
  cardWidth,
  onOpen,
  onMenu,
}: {
  title: string;
  emptyMessage: string;
  items: ProjectRow[];
  cardWidth: number;
  onOpen: (project: ProjectRow) => void;
  onMenu: (project: ProjectRow) => void;
}) {
  return (
    <View>
      <Text className="mb-3 text-base font-bold text-foreground">{title}</Text>
      {items.length === 0 ? (
        <View className="items-center rounded-xl border border-dashed border-border px-5 py-7">
          <Text className="text-center text-sm text-muted">{emptyMessage}</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={{ width: cardWidth }}
              className="overflow-hidden rounded-xl border border-border bg-surface"
              onPress={() => onOpen(item)}
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
                  onPress={() => onMenu(item)}
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
                  {item.platform && item.platform !== 'manual' ? item.platform : 'Local'}
                  {item.duration != null ? ` · ${formatDuration(item.duration)}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
