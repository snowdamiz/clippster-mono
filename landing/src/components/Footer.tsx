import { Twitter, Github, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

type LinkItem = { label: string; href: string; isPage?: boolean }

const links: Record<string, LinkItem[]> = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Full Pricing', href: '/pricing', isPage: true },
    { label: 'Changelog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
  ],
  Resources: [
    { label: 'Docs', href: '#' },
    { label: 'Support', href: '#' },
    { label: 'Community', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
  ],
}

const platforms = ['TikTok', 'YouTube Shorts', 'Instagram Reels', 'X/Twitter', 'Twitch Clips', 'Kick']

export function Footer() {
  return (
    <footer className="border-t border-[#1f1f23]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Platforms */}
        <div className="py-8 border-b border-[#1f1f23]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-zinc-500 mr-2">Export to:</span>
            {platforms.map((platform) => (
              <span 
                key={platform} 
                className="px-3 py-1.5 rounded-lg bg-[#141416] border border-[#1f1f23] text-xs text-zinc-400 hover:border-[rgba(255,255,255,0.1)] hover:text-zinc-300 transition-colors"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>

        <div className="py-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 md:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-5">
              <img 
                src="/logo-icon.svg" 
                alt="Clippster" 
                className="w-8 h-8"
              />
              <img 
                src="/logo.svg" 
                alt="Clippster" 
                className="h-5"
              />
            </Link>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs leading-relaxed">
              AI-powered content creation for the modern creator. Turn your streams into viral clips automatically.
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
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          
          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.isPage ? (
                      <Link 
                        to={item.href} 
                        className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <a 
                        href={item.href} 
                        className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors"
                      >
                        {item.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom */}
        <div className="py-6 border-t border-[#1f1f23] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Clippster. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <a href="#" className="hover:text-cyan-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
