import { reactive } from 'vue'
interface Toast { id: string; title?: string; description?: string; type: 'success' | 'error' | 'warning' | 'info' | 'loading'; duration?: number; open: boolean }
const toasts = reactive<Toast[]>([])
function removeToast(id: string) { const index = toasts.findIndex(toast => toast.id === id); if (index >= 0) toasts.splice(index, 1) }
function toast(options: Partial<Toast>) { const id = crypto.randomUUID(); toasts.push({ id, open: true, type: 'info', duration: 5000, ...options }); return id }
const notification = (type: Toast['type']) => (title: string, description?: string, duration = 5000, _category?: string) => toast({ title, description, duration, type })
export function useToast() {
  const showToast = (title: string, type: Toast['type'] = 'info', _category?: string) => toast({ title, type })
  return { toast, showToast, removeToast, success: notification('success'), error: notification('error'), warning: notification('warning'), info: notification('info'), loading: (title: string, description?: string) => toast({ title, description, type: 'loading', duration: Infinity }), updateToast: (id: string, options: Partial<Toast>) => { const item = toasts.find(toast => toast.id === id); if (item) Object.assign(item, options) } }
}
export function useToastStore() { return { ...useToast(), toasts } }
