import { onBeforeUnmount, watch } from 'vue'

/** Guard both document unloads and navigation inside the persistent workspace. */
export function useUnsavedChanges(isDirty: () => boolean, _prompt: { title: string; message: string }) {
  const guard = (event: BeforeUnloadEvent) => {
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = ''
  }
  const target = window.top || window
  const routeGuard = (event: Event) => { if (isDirty()) event.preventDefault() }
  target.addEventListener('clippster-before-workspace-navigation', routeGuard)
  watch(isDirty, dirty => {
    target.removeEventListener('beforeunload', guard)
    if (dirty) target.addEventListener('beforeunload', guard)
  }, { immediate: true })
  onBeforeUnmount(() => {
    target.removeEventListener('beforeunload', guard)
    target.removeEventListener('clippster-before-workspace-navigation', routeGuard)
  })
}
