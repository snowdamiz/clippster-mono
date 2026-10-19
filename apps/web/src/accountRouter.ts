import { computed, defineComponent, h, reactive } from 'vue'
export type RouteLocationRaw =
  | string
  | { path: string; query?: Record<string, string>; hash?: string }
const query = Object.fromEntries(new URLSearchParams(location.search))
if (query.tab === 'accounts') query.section = 'social-accounts'
export const route = reactive({ query, path: location.pathname, fullPath: '/account/profile' })
export function syncAccountRoute() {
  const query = Object.fromEntries(new URLSearchParams(location.search))
  if (query.tab === 'accounts') query.section = 'social-accounts'
  route.query = query
}
function destination(path: string) {
  if (path === '/campaigns') return '/account/campaigns'
  if (path === '/clipper-profile') return '/account/profile'
  if (path === '/clipper-profile/edit') return '/account/profile/edit'
  return path
}
function navigate(path: string, replace = false) {
  const target = destination(path)
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\'))
    throw new Error('Use an application page.')
  if (window.parent !== window && /^\/account(?:[/?#]|$)/.test(target)) {
    window.parent.postMessage({ type: 'clippster-account-navigation', path: target, replace }, location.origin)
  } else if (replace) window.top!.location.replace(target)
  else window.top!.location.href = target
}
export const router = {
  push: (path: string) => navigate(path),
  replace: (path: string) => navigate(path, true),
  back: () => window.top!.history.back()
}
export function useRoute() {
  return route
}
export function useRouter() {
  return router
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $router: typeof router
    $route: typeof route
  }
}
export const RouterLink = defineComponent({
  inheritAttrs: false,
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots, attrs }) {
    const href = computed(() => {
      if (typeof props.to === 'string') return destination(props.to)
      const target = props.to as { path: string; query?: Record<string, string> }
      const query = new URLSearchParams(target.query).toString()
      return destination(target.path) + (query ? '?' + query : '')
    })
    return () => h('a', { ...attrs, href: href.value, target: '_top', onClick: (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      router.push(href.value)
    } }, slots.default?.())
  }
})
