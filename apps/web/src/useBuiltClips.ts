import { computed, ref, onMounted, watch } from 'vue'
import type { WebProject, WebClip } from '@clippster/shared-types'
import type { ClipBuild } from '@/services/database/types'
import { workspaceClient, webApiPath, downloadPath } from './api'
export function useBuiltClips() {
  const projects = ref<WebProject[]>([]), loading = ref(true), error = ref('')
  const search = ref(''), ratio = ref('all'), projectFilter = ref('all'), status = ref('all'), sort = ref('newest'), view = ref('folders'), folder = ref<string | null>(null)
  const selected = ref<string[]>([])
  const page = ref(1)
  async function load() { try { error.value = ''; projects.value = (await workspaceClient.get<{ projects: WebProject[] }>('/web/projects')).projects } catch (cause) { error.value = String(cause) } finally { loading.value = false } }
  const items = computed(() => projects.value.flatMap(project => project.clips.flatMap(clip => (clip.builds || []).map((build, index) => {
    const base = `${webApiPath}/projects/${project.id}/clips/${clip.id}`
    const native: ClipBuild = { id: build.id, clip_id: clip.id, aspect_ratios: JSON.stringify([build.aspectRatio]), quality: null, frame_rate: null, output_format: build.format, include_subtitles: clip.captions, file_path: `${downloadPath(project.id, clip.id)}?buildId=${build.id}`, output_paths: null, thumbnail_path: null, file_size: null, duration: build.duration || clip.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0), build_number: index + 1, status: 'completed', error_message: null, progress: 100, organization_id: build.organizationId || null, organization_name: null, campaign_id: build.campaignId || null, campaign_name: null, branding_profile_id: null, branding_type: build.campaignId ? 'campaign' : build.organizationId ? 'org' : 'personal', is_published: !!build.publishedAt, published_at: build.publishedAt ? build.publishedAt / 1000 : null, started_at: build.completedAt / 1000, completed_at: build.completedAt / 1000, created_at: build.completedAt / 1000 }
    return { id: build.id, project, clip, build, native, base, thumbnail: `${base}/builds/${build.id}/thumbnail`, playback: `${base}/playback?buildId=${build.id}`, download: native.file_path }
  }))))
  const filtered = computed(() => items.value.filter(item => (!search.value || `${item.clip.name} ${item.project.name} ${item.clip.subtitleWords?.map(word => word.word).join(' ') || ''}`.toLowerCase().includes(search.value.toLowerCase())) && (ratio.value === 'all' || item.build.aspectRatio === ratio.value) && (projectFilter.value === 'all' || item.project.id === projectFilter.value) && (status.value === 'all' || (status.value === 'published') === !!item.build.publishedAt)).sort((a, b) => sort.value === 'name' ? a.clip.name.localeCompare(b.clip.name) : (a.build.completedAt - b.build.completedAt) * (sort.value === 'oldest' ? 1 : -1)))
  const folders = computed(() => projects.value.map(project => ({ project, items: filtered.value.filter(item => item.project.id === project.id) })).filter(value => value.items.length))
  const visible = computed(() => folder.value ? filtered.value.filter(item => item.project.id === folder.value) : filtered.value)
  const totalPages = computed(() => Math.max(1, Math.ceil(visible.value.length / 12)))
  const paginated = computed(() => visible.value.slice((page.value - 1) * 12, page.value * 12))
  watch([search, ratio, projectFilter, status, sort, folder, view], () => { page.value = 1; selected.value = [] })
  watch(totalPages, value => { if (page.value > value) page.value = value })
  function toggle(id: string) { selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id] }
  async function remove(ids: string[]) {
    try { error.value = ''; for (const id of ids) { const item = items.value.find(value => value.id === id); if (item) await workspaceClient.delete(`${item.base.replace(webApiPath, '/web')}/builds/${id}`) }; selected.value = []; await load() } catch (cause) { await load(); error.value = String(cause) }
  }
  function download(url: string) { const link = document.createElement('a'); link.href = url; link.download = ''; link.click() }
  onMounted(load)
  return { projects, loading, error, search, ratio, projectFilter, status, sort, view, folder, items, filtered, folders, visible, paginated, page, totalPages, selected, toggle, remove, load, download }
}
export type BuiltClipItem = ReturnType<typeof useBuiltClips>['items']['value'][number]
