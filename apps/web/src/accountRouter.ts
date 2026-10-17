import { computed, defineComponent, h, reactive } from 'vue'
export type RouteLocationRaw =
  | string
  | { path: string; query?: Record<string, string>; hash?: string }
const query = Object.fromEntries(new URLSearchParams(location.search))
if (query.tab === 'accounts') query.section = 'social-accounts'
export const route = reactive({ query, path: location.pathname, fullPath: '/account/profile' })
function destination(path: string) {
  if (path === '/campaigns') return '/account/campaigns'
  if (path === '/clipper-profile') return '/account/profile'
  return path
}
export const router = {
  push: (path: string) => {
    const target = destination(path)
    if (!target.startsWith('/') || target.startsWith('//'))
      throw new Error('Use an application page.')
    window.top!.location.href = target
  },
  replace: (path: string) => {
    window.top!.location.replace(destination(path))
  },
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
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots }) {
    const href = computed(() => {
      if (typeof props.to === 'string') return destination(props.to)
      const target = props.to as { path: string; query?: Record<string, string> }
      const query = new URLSearchParams(target.query).toString()
      return destination(target.path) + (query ? '?' + query : '')
    })
    return () => h('a', { href: href.value, target: '_top' }, slots.default?.())
  }
})
