import { nextTick } from 'vue'
const queues = new Map<string, Promise<void>>()
/** Timeline, captions and text share the same revisioned project records. */
export function queueWorkspaceMutation(projectId: string, operation: () => Promise<void>) {
  const task = (queues.get(projectId) || Promise.resolve()).catch(() => {}).then(async () => { await operation(); await nextTick() })
  queues.set(projectId, task)
  task.finally(() => { if (queues.get(projectId) === task) queues.delete(projectId) }).catch(() => {})
  return task
}
export async function flushWorkspaceMutations(projectId: string) { await queues.get(projectId); await nextTick() }
