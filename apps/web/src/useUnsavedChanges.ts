import { onBeforeUnmount, watch } from 'vue'

/** Embedded account navigation unloads the document, so use the browser guard. */
export function useUnsavedChanges(isDirty: () => boolean, _prompt: { title: string; message: string }) {
  const guard = (event: BeforeUnloadEvent) => {
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = ''
  }
  const target = window.top || window
  watch(isDirty, dirty => {
    target.removeEventListener('beforeunload', guard)
    if (dirty) target.addEventListener('beforeunload', guard)
  }, { immediate: true })
  onBeforeUnmount(() => target.removeEventListener('beforeunload', guard))
}
