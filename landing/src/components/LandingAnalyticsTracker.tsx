import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackLandingPageView } from '@/services/landingAnalytics'

const STATIC_PUBLIC_PAGES: Record<string, string> = {
  '/': 'home',
  '/pricing': 'pricing',
  '/privacy': 'privacy',
  '/terms': 'terms',
}

function getPublicPageType(pathname: string): string | null {
  if (STATIC_PUBLIC_PAGES[pathname]) return STATIC_PUBLIC_PAGES[pathname]
  if (pathname.startsWith('/clippers/')) return 'clipper_profile'
  if (pathname.startsWith('/orgs/')) return 'organization_profile'
  return null
}

export function LandingAnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    const pageType = getPublicPageType(location.pathname)
    if (!pageType) return

    trackLandingPageView({ page_type: pageType })
  }, [location.hash, location.pathname, location.search])

  return null
}
