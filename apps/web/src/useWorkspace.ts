import { ref, onUnmounted, computed } from 'vue'
import type { WebWorkspace, WebClipInput } from '@clippster/shared-types'
import { projects, upload, errorMessage } from './api'
export function useWorkspace() {
  const workspace = ref<WebWorkspace | null>(null)
  const error = ref('')
  const saving = ref(false)
  const uploadProgress = ref<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const activeJob = computed(() =>
    workspace.value?.jobs.find((job) => ['running', 'queued'].includes(job.status))
  )
  const busy = computed(() => saving.value || uploadProgress.value !== null || !!activeJob.value)
  async function poll(id: string, run: number) {
    try {
      const updated = await projects.get(id)
      if (run !== generation) return
      workspace.value = updated
      const latest = updated.jobs[0]
      if (latest?.status === 'failed') error.value = latest.message
    } catch (cause) {
      if (run === generation) error.value = errorMessage(cause)
    } finally {
      if (run === generation)
        timer = setTimeout(() => void poll(id, run), activeJob.value ? 2500 : 15_000)
    }
  }
  async function open(id: string) {
    close()
    error.value = ''
    const run = generation
    const result = await projects.get(id)
    if (run !== generation) return
    workspace.value = result
    if (run === generation) timer = setTimeout(() => void poll(id, run), 2500)
  }
  function close() {
    generation++
    clearTimeout(timer)
    workspace.value = null
  }
  async function action(operation: (id: string) => Promise<unknown>) {
    if (!workspace.value || saving.value) return
    const id = workspace.value.project.id
    const run = ++generation
    clearTimeout(timer)
    saving.value = true
    error.value = ''
    try {
      await operation(id)
      const updated = await projects.get(id)
      if (run === generation) workspace.value = updated
    } catch (cause) {
      if (run === generation) error.value = errorMessage(cause)
      throw cause
    } finally {
      saving.value = false
      if (run === generation) timer = setTimeout(() => void poll(id, run), 1000)
    }
  }
  async function uploadSource(file: File) {
    if (file.size > 2 * 1024 ** 3) {
      error.value = 'Choose a video smaller than 2 GB.'
      return
    }
    uploadProgress.value = 0
    try {
      await action((id) =>
        upload(id, file, (value) => {
          uploadProgress.value = value
        })
      )
    } finally {
      uploadProgress.value = null
    }
  }
  onUnmounted(close)
  return {
    workspace,
    error,
    busy,
    activeJob,
    uploadProgress,
    open,
    close,
    action,
    uploadSource,
    saveClip: (input: WebClipInput, id?: string, revision?: number) =>
      action((projectId) => projects.saveClip(projectId, input, id, revision))
  }
}
