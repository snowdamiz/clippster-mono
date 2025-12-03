import { useState, useEffect } from 'react'
import { Menu, X, Apple, Monitor } from 'lucide-react'
import { useOS } from '../hooks/useOS'

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '#pricing', label: 'Pricing' },
]

// TODO: Replace with actual download URLs
const DOWNLOAD_URLS = {
  mac: '#download-mac',
  windows: '#download-windows',
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const os = useOS()
  
  const primaryOS = os === 'windows' ? 'windows' : 'mac'
  const secondaryOS = primaryOS === 'mac' ? 'windows' : 'mac'

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-black/90 backdrop-blur-xl border-b border-white/10 sm:bg-transparent sm:border-b-0' : ''
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-3 sm:py-4">
        <div
          className={`flex items-center justify-between sm:py-3 sm:px-5 sm:rounded-full transition-all duration-300 ${
            isScrolled 
              ? 'sm:bg-black/80 sm:backdrop-blur-xl sm:border sm:border-white/10' 
              : 'bg-transparent'
          }`}
        >
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <img 
              src="/logo-icon.svg" 
              alt="Clippster" 
              className="w-8 h-8 group-hover:scale-105 transition-transform"
            />
            <img 
              src="/logo.svg" 
              alt="Clippster" 
              className="h-5"
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-neutral-400 hover:text-white transition-colors text-sm"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Download Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <a
              href={DOWNLOAD_URLS[secondaryOS]}
              className="p-2 text-neutral-400 hover:text-white transition-colors"
              title={`Download for ${secondaryOS === 'mac' ? 'Mac' : 'Windows'}`}
            >
              {secondaryOS === 'mac' ? (
                <Apple className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
            </a>
            <a
              href={DOWNLOAD_URLS[primaryOS]}
              className="px-4 py-2 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
            >
              {primaryOS === 'mac' ? (
                <Apple className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
              Download
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mx-6 mt-1 p-4 rounded-2xl bg-black/95 backdrop-blur-xl border border-white/10">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-3 text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
              <a
                href={DOWNLOAD_URLS[primaryOS]}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {primaryOS === 'mac' ? (
                  <Apple className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                Download for {primaryOS === 'mac' ? 'Mac' : 'Windows'}
              </a>
              <a
                href={DOWNLOAD_URLS[secondaryOS]}
                className="flex items-center justify-center gap-2 px-4 py-3 text-neutral-400 hover:text-white rounded-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {secondaryOS === 'mac' ? (
                  <Apple className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                {secondaryOS === 'mac' ? 'Mac' : 'Windows'} version
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
