import { computed, ref, watch, type Ref } from 'vue'
import type { ManualFramingConfig } from '@clippster/shared-types'

/** Snapshot commands coalesce pointer/slider changes into one undoable edit. */
export function usePOIHistory(config: Ref<ManualFramingConfig>) {
  const past: string[] = [], future: string[] = [], revision = ref(0)
  let current = JSON.stringify(config.value), restoring = false, pending = false
  const canUndo = computed(() => { revision.value; JSON.stringify(config.value); return past.length > 0 || pending })
  const canRedo = computed(() => { revision.value; return future.length > 0 })
  function commit() {
    if (!pending) return
    past.push(current); if (past.length > 100) past.shift()
    current = JSON.stringify(config.value); future.length = 0; pending = false; revision.value++
  }
  watch(config, () => { if (!restoring) { pending = JSON.stringify(config.value) !== current; revision.value++ } }, { deep: true, flush: 'sync' })
  function restore(value: string) { restoring = true; config.value = JSON.parse(value); current = value; restoring = false; revision.value++ }
  function undo() { commit(); const value = past.pop(); if (value) { future.push(current); restore(value) } }
  function redo() { const value = future.pop(); if (value) { past.push(current); restore(value) } }
  return { canUndo, canRedo, commit, undo, redo }
}
