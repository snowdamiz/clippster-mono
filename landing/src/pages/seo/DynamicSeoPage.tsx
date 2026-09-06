import { useLocation } from 'react-router-dom'
import { SeoMarketingPage } from '@/seo/SeoMarketingPage'
import { PAGE_BODIES } from '@/seo/pageBodies'
import { getPage } from '@/seo/content'

export function DynamicSeoPage() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, '') || '/'
  const page = getPage(path)
  const sections = PAGE_BODIES[path]
  if (!page || !sections) {
    return <div className="min-h-screen bg-[#0a0a0b] text-zinc-400 flex items-center justify-center">Page not found</div>
  }
  return <SeoMarketingPage path={path} sections={sections} />
}
