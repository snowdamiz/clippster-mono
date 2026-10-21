import { onUnmounted } from 'vue'
import type { WebJob, WebWorkspace } from '@clippster/shared-types'
import { workspaceClient } from './api'
export function useWorkspaceJobWaiter(update: (workspace: WebWorkspace) => void) {
  let disposed = false; onUnmounted(() => { disposed = true })
  return async (job: WebJob, progress: (job: WebJob) => void = () => {}) => {
    while (!disposed) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (disposed) break
      const workspace = await workspaceClient.get<WebWorkspace>(`/web/projects/${job.projectId}`)
      if (disposed) break
      update(workspace)
      const current = workspace.jobs.find(value => value.id === job.id)
      if (!current) throw new Error('This job is no longer available.')
      progress(current)
      if (current.status === 'completed') return workspace
      if (['failed', 'cancelled'].includes(current.status)) throw new Error(current.message)
    }
    throw new Error('Workspace closed.')
  }
}
