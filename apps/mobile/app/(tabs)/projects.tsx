import { AppIcon } from '@/components/AppIcon'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { ScreenHeader } from '@/components/ScreenHeader'
import { WorkspaceActions } from '@/components/navigation/WorkspaceActions'
import { DownloadProgressCard } from '@/components/DownloadProgressCard'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Tabs } from '@/components/ui/tabs'
import { MenuRow } from '@/components/navigation/MenuRow'
import { useAccount } from '@/context/AccountContext'
import type { Project } from '@clippster/shared-types'
import { getAllProjects, getRawVideoByProjectId } from '@/services/database'
import { tokens } from '@/theme/tokens'
import { deleteProjectEverywhere } from '@/services/cloudSync'
import {
  backfillProjectThumbnail,
  getDownloadJobs,
  initDownloadQueue,
  retryDownload,
  cancelDownload,
  removeDownload,
  subscribeDownloadQueue,
  type DownloadJob
} from '@/services/downloadQueue'
import { appAlert } from '@/lib/appAlert'
import { mobileDraftRepository } from '@/editor/persistence/asyncStorageDraftRepository'

interface ProjectRow extends Project {
  platform?: string | null
  duration?: number | null
  thumbnailUri?: string | null
  hasEditorDraft: boolean
}

function toLocalImageUri(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
    return path
  }
  return `file://${path}`
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ''
  const mins = Math.round(seconds / 60)
  return `${mins} min`
}

export default function ProjectsScreen() {
  const { requireSubscription } = useAccount()
  const [libraryTab, setLibraryTab] = useState('uploads')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [menuProject, setMenuProject] = useState<ProjectRow | null>(null)

  useEffect(() => {
    void initDownloadQueue()
    return subscribeDownloadQueue(setJobs)
  }, [])

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getAllProjects()
      const enriched = await Promise.all(
        rows.map(async (project) => {
          const raw = await getRawVideoByProjectId(project.id)
          const jobThumb = getDownloadJobs().find((job) => job.projectId === project.id)?.thumbnailUrl
          const hasEditorDraft = await mobileDraftRepository
            .load('project', project.id)
            .then((draft) => draft != null)
            .catch(() => false)
          return {
            ...project,
            platform: raw?.platform ?? null,
            duration: raw?.duration ?? null,
            hasEditorDraft,
            thumbnailUri: toLocalImageUri(project.thumbnail_path ?? raw?.thumbnail_path ?? jobThumb ?? null)
          }
        })
      )
      setProjects(enriched)

      void Promise.all(
        enriched.map(async (project) => {
          if (project.thumbnailUri) return
          const raw = await getRawVideoByProjectId(project.id)
          if (!raw?.file_path) return
          const jobThumb = getDownloadJobs().find((job) => job.projectId === project.id)?.thumbnailUrl
          const thumbPath = await backfillProjectThumbnail(project.id, raw.file_path, jobThumb)
          if (!thumbPath) return
          setProjects((current) =>
            current.map((row) => (row.id === project.id ? { ...row, thumbnailUri: toLocalImageUri(thumbPath) } : row))
          )
        })
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadProjects()
      setJobs(getDownloadJobs())
    }, [loadProjects])
  )

  useEffect(() => {
    if (jobs.some((job) => job.status === 'complete' && job.projectId)) {
      void loadProjects()
    }
  }, [jobs, loadProjects])

  function openProjectMenu(project: ProjectRow) {
    setMenuProject(project)
  }

  function handleEditProject() {
    if (!menuProject) return
    const projectId = menuProject.id
    setMenuProject(null)
    router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'project', id: projectId } })
  }

  async function handleDetectClips() {
    if (!menuProject) return
    const projectId = menuProject.id
    setMenuProject(null)
    const allowed = await requireSubscription({
      context: 'Detect clips with AI',
      type: 'ai',
      aiOnly: true
    })
    if (!allowed) return
    router.push(`/project/${projectId}?detect=1`)
  }

  function handleDeleteProject() {
    if (!menuProject) return
    const project = menuProject
    setMenuProject(null)
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
              await deleteProjectEverywhere(project.id)
              await loadProjects()
            })()
          }
        }
      ]
    )
  }

  const downloads = projects.filter(
    (project) => !project.hasEditorDraft && project.platform != null && project.platform !== 'manual'
  )
  const editorProjects = projects.filter(
    (project) => project.hasEditorDraft || project.platform == null || project.platform === 'manual'
  )

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader showLogo rightAction={<WorkspaceActions />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 17 }}>
        <DownloadProgressCard
          jobs={jobs}
          onOpenProject={(id) => router.push(`/project/${id}`)}
          onRetry={(id) => void retryDownload(id)}
          onCancel={(id) => void cancelDownload(id)}
          onRemove={(id) => void removeDownload(id)}
        />
        {editorProjects.some((project) => project.hasEditorDraft) ? (
          <View className="gap-3">
            <Text className="text-[17px] font-semibold text-foreground">Continue editing</Text>
            {editorProjects
              .filter((project) => project.hasEditorDraft)
              .slice(0, 1)
              .map((project) => (
                <Pressable
                  key={project.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'project', id: project.id } })
                  }
                  className="min-h-[86px] flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-3"
                >
                  <View className="h-[58px] w-[72px] items-center justify-center overflow-hidden rounded-[10px] bg-surfaceMuted">
                    {project.thumbnailUri ? (
                      <Image source={{ uri: project.thumbnailUri }} style={{ width: 72, height: 58 }} />
                    ) : (
                      <AppIcon name="Film" size={24} color={tokens.colors.muted} />
                    )}
                  </View>
                  <View className="flex-1 gap-1">
                    <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                      {project.name}
                    </Text>
                    <Text className="text-xs text-muted">Draft · Saved on this device</Text>
                  </View>
                  <AppIcon name="ChevronRight" size={20} color={tokens.colors.muted} />
                </Pressable>
              ))}
          </View>
        ) : null}
        <Text className="text-[17px] font-semibold text-foreground">Your library</Text>
        <Tabs
          items={[
            { key: 'uploads', label: 'Uploads' },
            { key: 'downloads', label: 'Downloads' }
          ]}
          value={libraryTab}
          onChange={setLibraryTab}
        />
        {loading ? (
          <ActivityIndicator color={tokens.colors.accent} />
        ) : (
          <ProjectCategory
            title=""
            emptyMessage={
              libraryTab === 'uploads'
                ? 'Videos imported from your phone and editor drafts will appear here.'
                : 'Videos downloaded from a URL will appear here.'
            }
            items={libraryTab === 'uploads' ? editorProjects : downloads}
            onOpen={(project) =>
              project.hasEditorDraft
                ? router.push({ pathname: '/edit/[kind]/[id]', params: { kind: 'project', id: project.id } })
                : router.push(`/project/${project.id}`)
            }
            onMenu={openProjectMenu}
          />
        )}
        <MenuRow
          icon="Share2"
          title="Shared clips"
          subtitle="Clips from your organizations"
          onPress={() => router.push('/(tabs)/inbox')}
        />
      </ScrollView>

      <BottomSheet
        visible={menuProject != null}
        onClose={() => setMenuProject(null)}
        title="Project options"
        subtitle={menuProject?.name}
        secondaryAction={{ title: 'Cancel', onPress: () => setMenuProject(null), variant: 'ghost' }}
      >
        <MenuRow icon="Film" title="Open in editor" subtitle="Resume your draft" onPress={handleEditProject} />
        <MenuRow
          icon="Sparkles"
          title="Detect clips"
          subtitle="Find moments with AI"
          onPress={() => void handleDetectClips()}
        />
        <MenuRow icon="Trash2" title="Delete project" destructive onPress={handleDeleteProject} />
      </BottomSheet>

    </View>
  )
}

function ProjectCategory({
  title,
  emptyMessage,
  items,
  onOpen,
  onMenu
}: {
  title: string
  emptyMessage: string
  items: ProjectRow[]
  onOpen: (project: ProjectRow) => void
  onMenu: (project: ProjectRow) => void
}) {
  return (
    <View>
      {title ? <Text className="mb-3 text-base font-bold text-foreground">{title}</Text> : null}
      {items.length === 0 ? (
        <View className="items-center rounded-xl border border-dashed border-border px-5 py-7">
          <Text className="text-center text-sm text-muted">{emptyMessage}</Text>
        </View>
      ) : (
        <View>
          {items.map((item) => (
            <View
              key={item.id}
              className="mb-2 flex-row items-center rounded-[14px] border border-border bg-surface p-2"
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpen(item)}
                className="flex-1 flex-row items-center gap-3"
              >
                <View className="h-[58px] w-[72px] items-center justify-center overflow-hidden rounded-[10px] bg-surfaceMuted">
                  {item.thumbnailUri ? (
                    <Image source={{ uri: item.thumbnailUri }} style={{ width: 72, height: 58 }} />
                  ) : (
                    <AppIcon name="Film" size={22} color={tokens.colors.muted} />
                  )}
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text numberOfLines={2} className="text-sm font-semibold text-foreground">
                    {item.name}
                  </Text>
                  <Text className="text-xs text-muted">
                    {[item.platform, formatDuration(item.duration), 'On device'].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <AppIcon name="ChevronRight" size={18} color={tokens.colors.muted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Options for ${item.name}`}
                onPress={() => onMenu(item)}
                className="min-h-11 min-w-11 items-center justify-center"
              >
                <AppIcon name="EllipsisVertical" size={18} color={tokens.colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
