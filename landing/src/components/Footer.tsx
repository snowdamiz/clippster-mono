import { Twitter, Github, MessageCircle, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { trackLandingEvent } from '@/services/landingAnalytics'

type LinkItem = { label: string; href: string; isPage?: boolean }

const links: Record<string, LinkItem[]> = {
  Solutions: [
    { label: 'AI Clipping Tool', href: '/clipping-tool', isPage: true },
    { label: 'Live Stream Clipping', href: '/live-stream-clipping', isPage: true },
    { label: 'Video Editor', href: '/video-editor', isPage: true },
    { label: 'Clipping Campaigns', href: '/clipping-campaigns', isPage: true },
    { label: 'For Organizations', href: '/for-organizations', isPage: true },
    { label: 'Social Posting', href: '/social-posting', isPage: true },
    { label: 'Clip Analytics', href: '/clip-analytics', isPage: true },
    { label: 'Design Studio', href: '/design-studio', isPage: true },
  ],
  Platforms: [
    { label: 'Twitch', href: '/platforms/twitch', isPage: true },
    { label: 'Kick', href: '/platforms/kick', isPage: true },
    { label: 'YouTube', href: '/platforms/youtube', isPage: true },
    { label: 'Pump.fun', href: '/platforms/pumpfun', isPage: true },
    { label: 'X', href: '/platforms/x', isPage: true },
    { label: 'Rumble', href: '/platforms/rumble', isPage: true },
  ],
  Compare: [
    { label: 'vs Opus Clip', href: '/vs/opus-clip', isPage: true },
    { label: 'vs Eklipse', href: '/vs/eklipse', isPage: true },
    { label: 'vs Streamladder', href: '/vs/streamladder', isPage: true },
    { label: 'vs Medal', href: '/vs/medal', isPage: true },
    { label: 'vs Powder', href: '/vs/powder', isPage: true },
    { label: 'Pricing', href: '/pricing', isPage: true },
  ],
  Authority: [
    { label: 'Methodology', href: '/methodology', isPage: true },
    { label: 'Editorial', href: '/authors/clippster-editorial', isPage: true },
    { label: 'Live vs VOD case study', href: '/case-studies/live-clipping-vs-vod-queue', isPage: true },
    { label: 'Campaign case study', href: '/case-studies/org-campaign-clipper-workflow', isPage: true },
    { label: 'Clippers', href: '/clippers', isPage: true },
    { label: 'Organizations', href: '/orgs', isPage: true },
    { label: 'Privacy', href: '/privacy', isPage: true },
    { label: 'Terms', href: '/terms', isPage: true },
  ],
}

const platforms = ['TikTok', 'YouTube Shorts', 'Instagram Reels', 'X']

export function Footer() {
  return (
    <footer className="border-t border-[#1f1f23]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="py-8 border-b border-[#1f1f23]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-zinc-500 mr-2">Publish to:</span>
            {platforms.map((platform) => (
              <span
                key={platform}
                className="px-3 py-1.5 rounded-lg bg-[#141416] border border-[#1f1f23] text-xs text-zinc-400"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>

        <div className="py-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-5">
              <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
              <img src="/logo.svg" alt="Clippster" className="h-5" />
            </Link>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs leading-relaxed">
              Desktop clipping studio for streamers and clipper teams. Clip live, edit locally, and schedule
              posts to Instagram, TikTok, X, and YouTube.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Twitter, label: 'Twitter' },
                { icon: Github, label: 'GitHub' },
                { icon: MessageCircle, label: 'Discord' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-10 h-10 rounded-[10px] bg-[#141416] border border-[#1f1f23] flex items-center justify-center text-zinc-500 hover:text-cyan-400 hover:border-[rgba(255,255,255,0.1)] transition-colors"
                  onClick={() =>
                    trackLandingEvent('landing_external_link_click', {
                      source: 'footer_social',
                      button_label: label,
                    })
                  }
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.href}
                      className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors"
                      onClick={() =>
                        trackLandingEvent(
                          item.href === '/pricing' ? 'landing_pricing_click' : 'landing_nav_click',
                          {
                            source: 'footer_link',
                            button_label: item.label,
                            path: item.href,
                          },
                        )
                      }
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="py-6 border-t border-[#1f1f23] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Clippster. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <Link to="/guides/how-to-clip-twitch-streams" className="hover:text-cyan-400 transition-colors">
              Guides
            </Link>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors"
              onClick={() =>
                trackLandingEvent('landing_cta_click', {
                  source: 'footer_bottom',
                  button_label: 'Organization Portal',
                  path: '/dashboard',
                })
              }
            >
              <Building2 className="w-3 h-3" />
              Organization Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
